//! 图节点实现
//! 
//! 每个节点代表一个智能体的处理逻辑

use crate::agent::types::*;
use crate::agent::llm_client::LlmClient;
use crate::agent::tools::{get_tools_for_agent, ToolRegistry};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

/// 节点处理结果
pub struct NodeResult {
    pub state: GraphState,
    pub next_node: Option<String>,
}

/// 协调器节点 - 理解用户意图
pub async fn coordinator_node(
    app: &AppHandle,
    llm: &LlmClient,
    mut state: GraphState,
) -> Result<NodeResult, String> {
    let _ = app.emit("agent-event", AgentEvent::StatusChange {
        status: AgentStatus::Running,
    });

    // 构建系统提示
    let system_prompt = format!(
        r#"你是 Lumina，一个智能笔记助手。分析用户的请求，判断任务类型。

任务类型：
- chat: 简单聊天、问答，不需要操作笔记
- edit: 编辑现有笔记
- create: 创建新笔记
- organize: 整理、移动、删除文件
- search: 搜索、研究信息
- complex: 复杂任务，需要多步骤完成

当前工作区：{}
当前笔记：{}

请用 JSON 格式回复：
{{"intent": "chat|edit|create|organize|search|complex", "reason": "判断理由"}}
"#,
        state.workspace_path,
        state.active_note_path.as_deref().unwrap_or("无")
    );

    // 构建消息
    let messages = vec![
        Message {
            role: MessageRole::System,
            content: system_prompt,
            name: None,
            tool_call_id: None,
        },
        Message {
            role: MessageRole::User,
            content: state.user_task.clone(),
            name: None,
            tool_call_id: None,
        },
    ];

    // 调用 LLM
    let response = llm.call(&messages, None).await?;
    
    // 发送 token 使用量
    let _ = app.emit("agent-event", AgentEvent::TokenUsage {
        prompt_tokens: response.prompt_tokens,
        completion_tokens: response.completion_tokens,
        total_tokens: response.total_tokens,
    });

    // 解析意图
    let intent = parse_intent(&response.content);
    state.intent = intent.clone();

    // 发送意图分析结果作为一条完整的消息
    // 使用 AgentMessage 事件来确保消息被单独保存
    let intent_message = format!("🎯 意图分析：{:?}\n📍 路由到：{}", 
        intent,
        match intent {
            TaskIntent::Chat => "reporter（直接回复）",
            TaskIntent::Edit => "editor（编辑笔记）",
            TaskIntent::Create => "writer（创建笔记）",
            TaskIntent::Organize => "organizer（整理文件）",
            TaskIntent::Search => "researcher（搜索研究）",
            TaskIntent::Complex => "planner（复杂任务规划）",
        }
    );
    
    // 发送完整消息事件
    let _ = app.emit("agent-event", AgentEvent::IntentAnalysis {
        intent: format!("{:?}", intent),
        route: match intent {
            TaskIntent::Chat => "reporter".to_string(),
            TaskIntent::Edit => "editor".to_string(),
            TaskIntent::Create => "writer".to_string(),
            TaskIntent::Organize => "organizer".to_string(),
            TaskIntent::Search => "researcher".to_string(),
            TaskIntent::Complex => "planner".to_string(),
        },
        message: intent_message,
    });

    // 决定下一个节点
    let next_node = match intent {
        TaskIntent::Chat => Some("reporter".to_string()),
        TaskIntent::Edit => Some("editor".to_string()),
        TaskIntent::Create => Some("writer".to_string()),
        TaskIntent::Organize => Some("organizer".to_string()),
        TaskIntent::Search => Some("researcher".to_string()),
        TaskIntent::Complex => Some("planner".to_string()),
    };

    state.goto = next_node.clone().unwrap_or_default();

    Ok(NodeResult {
        state,
        next_node,
    })
}

/// 规划器节点 - 分解复杂任务
pub async fn planner_node(
    app: &AppHandle,
    llm: &LlmClient,
    mut state: GraphState,
) -> Result<NodeResult, String> {
    let system_prompt = format!(
        r#"你是任务规划专家。将复杂任务分解为可执行的步骤。

每个步骤需要指定执行者：
- editor: 编辑笔记
- researcher: 搜索研究
- writer: 创建内容
- organizer: 文件整理

请用 JSON 格式回复：
{{
  "steps": [
    {{"id": "1", "description": "步骤描述", "agent": "editor|researcher|writer|organizer"}}
  ]
}}

当前任务：{}
工作区：{}
"#,
        state.user_task,
        state.workspace_path
    );

    let messages = vec![
        Message {
            role: MessageRole::System,
            content: system_prompt,
            name: None,
            tool_call_id: None,
        },
        Message {
            role: MessageRole::User,
            content: state.user_task.clone(),
            name: None,
            tool_call_id: None,
        },
    ];

    let response = llm.call(&messages, None).await?;
    
    // 发送 token 使用量
    let _ = app.emit("agent-event", AgentEvent::TokenUsage {
        prompt_tokens: response.prompt_tokens,
        completion_tokens: response.completion_tokens,
        total_tokens: response.total_tokens,
    });

    // 解析计划
    if let Some(plan) = parse_plan(&response.content) {
        let _ = app.emit("agent-event", AgentEvent::PlanCreated {
            plan: plan.clone(),
        });
        state.current_plan = Some(plan);
        state.current_step_index = 0;
        state.goto = "executor".to_string();
    } else {
        // 无法解析计划，直接交给 reporter
        state.goto = "reporter".to_string();
    }

    state.plan_iterations += 1;
    let next = state.goto.clone();

    Ok(NodeResult {
        state,
        next_node: Some(next),
    })
}

/// 执行器节点 - 执行计划中的当前步骤
pub async fn executor_node(
    app: &AppHandle,
    _llm: &LlmClient,
    mut state: GraphState,
) -> Result<NodeResult, String> {
    let plan = state.current_plan.as_ref()
        .ok_or("No plan found")?;
    
    if state.current_step_index >= plan.steps.len() {
        // 所有步骤完成
        state.goto = "reporter".to_string();
        return Ok(NodeResult {
            state,
            next_node: Some("reporter".to_string()),
        });
    }

    let step = &plan.steps[state.current_step_index];
    
    let _ = app.emit("agent-event", AgentEvent::StepStarted {
        step: step.clone(),
        index: state.current_step_index,
    });

    // 根据步骤的 agent 类型路由
    let next_node = match step.agent {
        AgentType::Editor => "editor",
        AgentType::Researcher => "researcher",
        AgentType::Writer => "writer",
        AgentType::Organizer => "organizer",
        _ => "reporter",
    };

    state.goto = next_node.to_string();

    Ok(NodeResult {
        state,
        next_node: Some(next_node.to_string()),
    })
}

/// 编辑器节点
pub async fn editor_node(
    app: &AppHandle,
    llm: &LlmClient,
    state: GraphState,
) -> Result<NodeResult, String> {
    agent_worker_node(app, llm, state, AgentType::Editor, "editor").await
}

/// 研究员节点
pub async fn researcher_node(
    app: &AppHandle,
    llm: &LlmClient,
    state: GraphState,
) -> Result<NodeResult, String> {
    agent_worker_node(app, llm, state, AgentType::Researcher, "researcher").await
}

/// 写作者节点
pub async fn writer_node(
    app: &AppHandle,
    llm: &LlmClient,
    state: GraphState,
) -> Result<NodeResult, String> {
    agent_worker_node(app, llm, state, AgentType::Writer, "writer").await
}

/// 整理者节点
pub async fn organizer_node(
    app: &AppHandle,
    llm: &LlmClient,
    state: GraphState,
) -> Result<NodeResult, String> {
    agent_worker_node(app, llm, state, AgentType::Organizer, "organizer").await
}

/// 通用工作节点
async fn agent_worker_node(
    app: &AppHandle,
    llm: &LlmClient,
    mut state: GraphState,
    agent_type: AgentType,
    agent_name: &str,
) -> Result<NodeResult, String> {
    let tools = get_tools_for_agent(agent_name);
    let tool_registry = ToolRegistry::new(state.workspace_path.clone());

    // 构建上下文
    let mut context_parts = vec![];
    
    if let Some(ref content) = state.active_note_content {
        context_parts.push(format!("当前笔记内容:\n{}", content));
    }
    
    if !state.rag_results.is_empty() {
        let rag_text: Vec<String> = state.rag_results.iter()
            .map(|r| format!("文件: {}\n{}", r.file_path, r.content))
            .collect();
        context_parts.push(format!("相关笔记:\n{}", rag_text.join("\n---\n")));
    }

    let context = if context_parts.is_empty() {
        String::new()
    } else {
        context_parts.join("\n\n")
    };

    let system_prompt = build_agent_prompt(agent_name, &state.workspace_path, &context);

    let mut messages = vec![
        Message {
            role: MessageRole::System,
            content: system_prompt,
            name: None,
            tool_call_id: None,
        },
        Message {
            role: MessageRole::User,
            content: state.user_task.clone(),
            name: None,
            tool_call_id: None,
        },
    ];

    // 添加之前的观察
    for obs in &state.observations {
        messages.push(Message {
            role: MessageRole::Tool,
            content: obs.clone(),
            name: None,
            tool_call_id: Some("prev".to_string()),
        });
    }

    // 多轮工具调用循环
    let max_iterations = 10; // 防止无限循环
    let mut iteration = 0;
    
    loop {
        iteration += 1;
        if iteration > max_iterations {
            // 超过最大迭代次数，强制结束
            state.observations.push("[系统] 达到最大工具调用次数，自动结束".to_string());
            break;
        }
        
        // 调用 LLM（非流式，工作节点不需要流式输出给用户）
        let response = llm.call(&messages, Some(&tools)).await?;
        
        // 发送 token 使用量
        let _ = app.emit("agent-event", AgentEvent::TokenUsage {
            prompt_tokens: response.prompt_tokens,
            completion_tokens: response.completion_tokens,
            total_tokens: response.total_tokens,
        });

        // 解析工具调用
        let tool_calls = parse_tool_calls(&response.content);
        
        if tool_calls.is_none() || tool_calls.as_ref().map(|tc| tc.is_empty()).unwrap_or(true) {
            // 没有工具调用，LLM 认为任务完成
            break;
        }
        
        let tool_calls = tool_calls.unwrap();
        let mut should_complete = false;
        
        for tool_call in tool_calls {
            // 发送工具调用事件
            let _ = app.emit("agent-event", AgentEvent::ToolCall {
                tool: tool_call.clone(),
            });

            // 执行工具
            let result = tool_registry.execute(&tool_call).await;

            // 发送工具结果事件
            let _ = app.emit("agent-event", AgentEvent::ToolResult {
                result: result.clone(),
            });

            // 检查是否完成
            if tool_call.name == "attempt_completion" {
                if let Some(result_text) = tool_call.params.get("result").and_then(|v| v.as_str()) {
                    state.final_result = Some(result_text.to_string());
                    state.goto = "end".to_string();
                    return Ok(NodeResult {
                        state,
                        next_node: None, // 结束
                    });
                }
                should_complete = true;
            }

            // 添加到观察
            let observation = format!(
                "[{}] {}",
                tool_call.name,
                if result.success { &result.content } else { result.error.as_deref().unwrap_or("Unknown error") }
            );
            state.observations.push(observation.clone());
            
            // 将工具结果添加到消息历史，使用 User role（更兼容）
            messages.push(Message {
                role: MessageRole::User,
                content: format!("工具 {} 执行结果：\n{}", tool_call.name, 
                    if result.success { &result.content } else { result.error.as_deref().unwrap_or("Unknown error") }
                ),
                name: None,
                tool_call_id: None,
            });
        }
        
        if should_complete {
            break;
        }
    }

    // 如果有计划，继续执行下一步
    if state.current_plan.is_some() {
        state.current_step_index += 1;
        state.goto = "executor".to_string();
        let next = state.goto.clone();
        Ok(NodeResult {
            state,
            next_node: Some(next),
        })
    } else {
        // 没有计划，直接报告
        state.goto = "reporter".to_string();
        let next = state.goto.clone();
        Ok(NodeResult {
            state,
            next_node: Some(next),
        })
    }
}

/// 报告者节点 - 汇总结果
pub async fn reporter_node(
    app: &AppHandle,
    llm: &LlmClient,
    mut state: GraphState,
) -> Result<NodeResult, String> {
    // 如果已经有最终结果，直接返回
    if let Some(ref result) = state.final_result {
        let _ = app.emit("agent-event", AgentEvent::Complete {
            result: result.clone(),
        });
        let _ = app.emit("agent-event", AgentEvent::StatusChange {
            status: AgentStatus::Completed,
        });
        return Ok(NodeResult {
            state,
            next_node: None,
        });
    }

    // 根据意图决定回复风格
    let system_prompt = if state.intent == TaskIntent::Chat && state.observations.is_empty() {
        // 简单聊天模式 - 使用自然对话风格
        format!(
            r#"你是 Lumina，一个友好的笔记助手。请用自然、亲切的语言回复用户。
不要使用"任务完成"之类的格式化语言，就像朋友聊天一样回复。

当前工作区：{}
当前笔记：{}

**重要**：输出时请确保：
- 每个段落之间使用空行分隔
- 使用 Markdown 格式（如 **粗体**、列表等）
- 表格要正确格式化，每行独占一行
"#,
            state.workspace_path,
            state.active_note_path.as_deref().unwrap_or("无")
        )
    } else {
        // 任务完成模式 - 汇总执行结果
        let observations_text = state.observations.join("\n");
        format!(
            r#"你是任务报告专家。根据执行结果，向用户总结任务完成情况。

用户任务：{}

执行结果：
{}

请用友好的语言总结任务完成情况。

**输出格式要求**：
1. 使用 Markdown 格式输出
2. 每个段落、标题、列表项之间必须有换行符分隔
3. 表格格式示例：
| 列1 | 列2 |
|-----|-----|
| 值1 | 值2 |
4. 列表使用 - 或数字编号，每项独占一行
5. 不要把所有内容挤在一行
"#,
            state.user_task,
            observations_text
        )
    };

    let mut messages = vec![
        Message {
            role: MessageRole::System,
            content: system_prompt,
            name: None,
            tool_call_id: None,
        },
    ];
    
    // 对于简单聊天，添加用户消息
    if state.intent == TaskIntent::Chat {
        messages.push(Message {
            role: MessageRole::User,
            content: state.user_task.clone(),
            name: None,
            tool_call_id: None,
        });
    }

    let request_id = format!("reporter-{}", chrono::Utc::now().timestamp_millis());
    let response = llm.call_stream(
        app,
        &request_id,
        &messages,
        None,
        AgentType::Reporter,
    ).await?;

    state.final_result = Some(response.clone());

    let _ = app.emit("agent-event", AgentEvent::Complete {
        result: response,
    });
    let _ = app.emit("agent-event", AgentEvent::StatusChange {
        status: AgentStatus::Completed,
    });

    Ok(NodeResult {
        state,
        next_node: None,
    })
}

// ============ 辅助函数 ============

fn parse_intent(response: &str) -> TaskIntent {
    let response_lower = response.to_lowercase();
    
    if response_lower.contains("\"intent\"") {
        if response_lower.contains("\"edit\"") {
            return TaskIntent::Edit;
        } else if response_lower.contains("\"create\"") {
            return TaskIntent::Create;
        } else if response_lower.contains("\"organize\"") {
            return TaskIntent::Organize;
        } else if response_lower.contains("\"search\"") {
            return TaskIntent::Search;
        } else if response_lower.contains("\"complex\"") {
            return TaskIntent::Complex;
        } else if response_lower.contains("\"chat\"") {
            return TaskIntent::Chat;
        }
    }
    
    TaskIntent::Chat
}

fn parse_plan(response: &str) -> Option<Plan> {
    // 尝试解析 JSON
    if let Ok(json) = serde_json::from_str::<Value>(response) {
        if let Some(steps) = json.get("steps").and_then(|v| v.as_array()) {
            let plan_steps: Vec<PlanStep> = steps.iter()
                .filter_map(|s| {
                    let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("1").to_string();
                    let description = s.get("description").and_then(|v| v.as_str())?.to_string();
                    let agent_str = s.get("agent").and_then(|v| v.as_str()).unwrap_or("editor");
                    let agent = match agent_str {
                        "researcher" => AgentType::Researcher,
                        "writer" => AgentType::Writer,
                        "organizer" => AgentType::Organizer,
                        _ => AgentType::Editor,
                    };
                    Some(PlanStep {
                        id,
                        description,
                        agent,
                        completed: false,
                        result: None,
                    })
                })
                .collect();
            
            if !plan_steps.is_empty() {
                return Some(Plan {
                    steps: plan_steps,
                    current_step: 0,
                });
            }
        }
    }
    
    None
}

fn parse_tool_calls(response: &str) -> Option<Vec<ToolCall>> {
    // 解析 XML 格式的工具调用
    let mut calls = Vec::new();
    
    // 简单的 XML 解析
    let tool_names = ["read_note", "edit_note", "create_note", "list_notes", 
                      "search_notes", "move_note", "delete_note", "ask_user", "attempt_completion"];
    
    for name in &tool_names {
        let start_tag = format!("<{}>", name);
        let end_tag = format!("</{}>", name);
        
        let mut search_from = 0;
        while let Some(start) = response[search_from..].find(&start_tag) {
            let abs_start = search_from + start;
            if let Some(end) = response[abs_start..].find(&end_tag) {
                let content = &response[abs_start + start_tag.len()..abs_start + end];
                
                // 解析参数
                let mut params = std::collections::HashMap::new();
                
                // 解析 <param>value</param> 格式
                for param in &["path", "old_string", "new_string", "content", "query", 
                              "limit", "from_path", "to_path", "question", "result"] {
                    let param_start = format!("<{}>", param);
                    let param_end = format!("</{}>", param);
                    
                    if let Some(ps) = content.find(&param_start) {
                        if let Some(pe) = content[ps..].find(&param_end) {
                            let value = &content[ps + param_start.len()..ps + pe];
                            params.insert(param.to_string(), serde_json::Value::String(value.to_string()));
                        }
                    }
                }
                
                calls.push(ToolCall {
                    id: format!("call_{}", calls.len()),
                    name: name.to_string(),
                    params,
                });
                
                search_from = abs_start + end + end_tag.len();
            } else {
                break;
            }
        }
    }
    
    if calls.is_empty() {
        None
    } else {
        Some(calls)
    }
}

fn build_agent_prompt(agent_name: &str, workspace: &str, context: &str) -> String {
    let role_desc = match agent_name {
        "editor" => "你是 Lumina 的笔记编辑专家，擅长精确编辑和优化笔记内容。",
        "researcher" => "你是 Lumina 的研究专家，擅长深度搜索和分析笔记库中的信息。",
        "writer" => "你是 Lumina 的写作专家，擅长创建高质量、结构清晰的笔记内容。",
        "organizer" => "你是 Lumina 的文件整理专家，擅长组织目录结构和管理笔记文件。",
        _ => "你是 Lumina 智能笔记助手。",
    };

    let tools_info = match agent_name {
        "editor" => "read_note, edit_note, search_notes, grep_search, semantic_search, attempt_completion",
        "researcher" => "read_note, list_notes, search_notes, grep_search, semantic_search, get_backlinks, attempt_completion",
        "writer" => "read_note, create_note, edit_note, list_notes, search_notes, attempt_completion",
        "organizer" => "list_notes, move_note, delete_note, create_note, read_note, attempt_completion",
        _ => "read_note, edit_note, create_note, list_notes, search_notes, attempt_completion",
    };

    format!(
        r#"{role_desc}

你的专长：
- 深入理解笔记内容和结构
- 优化 Markdown 格式和排版
- 整理和重构笔记组织
- 发现笔记间的关联

====

工作区路径：{workspace}

{context}

====

TOOL USE

你可以使用一组工具来完成用户的任务。**在任何涉及笔记内容、结构或文件操作的任务中，优先选择使用工具来完成，而不是仅在对话中给出结果。**

总体原则：
- 只要任务可能影响笔记文件、目录结构、数据库或需要读取现有内容，就应该调用相应工具。
- 即使仅凭思考也能回答，如果使用工具能让结果更完整、更可复用（例如写入笔记文件），也应偏向使用工具。
- 只有在任务**明确与笔记系统无关**，且不需要保存或读取任何文件时，才可以只用 attempt_completion 直接回答。

# 工具调用格式

使用 XML 标签格式调用工具：

<tool_name>
<param1>value1</param1>
<param2>value2</param2>
</tool_name>

示例 - 读取笔记:
<read_note>
<path>notes/daily/2024-01-15.md</path>
</read_note>

示例 - 编辑笔记:
<edit_note>
<path>notes/daily/2024-01-15.md</path>
<old_string>原内容</old_string>
<new_string>新内容</new_string>
</edit_note>

示例 - 列出目录（可递归）:
<list_notes>
<path>.</path>
<recursive>true</recursive>
</list_notes>

✅ **你可以使用的工具**：{tools_info}

====

RULES

1. 所有文件路径必须相对于笔记库根目录
2. **修改文件前必须先用 read_note 读取确认当前内容**
3. 不要询问不必要的信息，直接根据上下文行动
4. 你的目标是完成任务，而不是进行对话
5. **完成任务后必须使用 attempt_completion 工具**
6. 禁止以 "好的"、"当然"、"没问题" 等寒暄开头
7. 每次工具调用后必须等待结果确认
8. 如果遇到错误，尝试其他方法而不是放弃
9. 保持输出简洁，避免冗长解释
10. **可以连续多次调用工具**来完成复杂任务，不要在第一次工具调用后就停止

# 编辑 vs 创建文件

- **修改现有文件**：必须使用 edit_note，使用精确的 old_string/new_string
  - 先 read_note 获取当前内容
  - old_string 必须与原文完全匹配
  - 只替换需要修改的部分
  
- **创建新文件**：使用 create_note
  - 仅用于创建不存在的文件
  
- **禁止**：用 create_note 覆盖已存在的文件

# 工具使用优先级

1. **需要读/写/搜索笔记 → 必须使用工具**
2. **创作类任务且与笔记相关 → 优先写入文件**
3. **不确定是否需要工具时 → 先用 read_note / list_notes 探查**
4. 宁可多一步只读类工具调用，也不要完全不使用工具

====

CAPABILITIES

你可以：
1. 读取笔记库中的任意 Markdown 文件
2. 创建新的笔记文件
3. 编辑现有笔记（精确的查找替换）
4. 列出目录结构和文件（支持递归）
5. 完成任务并提供总结

你不能：
1. 访问笔记库之外的文件
2. 执行系统命令
3. 访问网络资源

====

OBJECTIVE

完成用户的任务。使用工具时要精确、高效。任务完成后使用 attempt_completion 报告结果。
"#,
        role_desc = role_desc,
        workspace = workspace,
        context = if context.is_empty() { "(无上下文)" } else { context },
        tools_info = tools_info
    )
}
