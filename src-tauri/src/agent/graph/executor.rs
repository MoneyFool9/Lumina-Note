//! 图执行器
//! 
//! 执行多智能体图

use crate::agent::types::*;
use crate::agent::llm_client::LlmClient;
use crate::agent::graph::nodes::*;
use tauri::{AppHandle, Emitter};

/// 图执行器
pub struct GraphExecutor {
    config: AgentConfig,
    llm: LlmClient,
}

impl GraphExecutor {
    pub fn new(config: AgentConfig) -> Self {
        let llm = LlmClient::new(config.clone());
        Self { config, llm }
    }

    /// 执行图
    pub async fn run(
        &self,
        app: &AppHandle,
        initial_state: GraphState,
    ) -> Result<GraphState, String> {
        let mut state = initial_state;
        let mut current_node = "coordinator".to_string();
        let mut iterations = 0;
        let max_iterations = self.config.max_steps * 2;

        while iterations < max_iterations {
            iterations += 1;

            // 执行当前节点
            let result = self.execute_node(app, &current_node, state).await?;
            state = result.state;

            // 检查是否结束
            match result.next_node {
                Some(next) if next != "end" => {
                    current_node = next;
                }
                _ => {
                    // 结束
                    break;
                }
            }

            // 检查错误状态
            if state.status == AgentStatus::Error {
                break;
            }
        }

        if iterations >= max_iterations {
            state.error = Some("Max iterations reached".to_string());
            state.status = AgentStatus::Error;
            let _ = app.emit("agent-event", AgentEvent::Error {
                message: "Max iterations reached".to_string(),
            });
        }

        Ok(state)
    }

    /// 执行单个节点
    async fn execute_node(
        &self,
        app: &AppHandle,
        node_name: &str,
        state: GraphState,
    ) -> Result<NodeResult, String> {
        match node_name {
            "coordinator" => coordinator_node(app, &self.llm, state).await,
            "planner" => planner_node(app, &self.llm, state).await,
            "executor" => executor_node(app, &self.llm, state).await,
            "editor" => editor_node(app, &self.llm, state).await,
            "researcher" => researcher_node(app, &self.llm, state).await,
            "writer" => writer_node(app, &self.llm, state).await,
            "organizer" => organizer_node(app, &self.llm, state).await,
            "reporter" => reporter_node(app, &self.llm, state).await,
            _ => Err(format!("Unknown node: {}", node_name)),
        }
    }

    /// 中止执行
    pub fn abort(&self) {
        // TODO: 实现中止机制
    }
}
