/**
 * Rust Agent 前端接口
 * 
 * 调用 Tauri Rust 后端的 Agent 命令
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============ 类型定义 ============

export type AgentStatus = 
  | "idle" 
  | "running" 
  | "waiting_approval" 
  | "completed" 
  | "error" 
  | "aborted";

export type AgentType = 
  | "coordinator" 
  | "planner" 
  | "executor" 
  | "editor" 
  | "researcher" 
  | "writer" 
  | "organizer" 
  | "reporter";

export type TaskIntent = 
  | "chat" 
  | "edit" 
  | "create" 
  | "organize" 
  | "search" 
  | "complex";

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  success: boolean;
  content: string;
  error?: string;
}

export interface PlanStep {
  id: string;
  description: string;
  agent: AgentType;
  completed: boolean;
  result?: string;
}

export interface Plan {
  steps: PlanStep[];
  current_step: number;
}

export interface RagResult {
  file_path: string;
  content: string;
  score: number;
  heading?: string;
}

export interface ResolvedLink {
  link_name: string;
  file_path: string;
  content: string;
}

export interface AgentConfig {
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  max_plan_iterations?: number;
  max_steps?: number;
  auto_approve?: boolean;
  locale?: string;
}

export interface TaskContext {
  workspace_path: string;
  active_note_path?: string;
  active_note_content?: string;
  file_tree?: string;
  rag_results?: RagResult[];
  resolved_links?: ResolvedLink[];
}

// ============ 事件类型 ============

export type AgentEventType = 
  | "status_change"
  | "message_chunk"
  | "tool_call"
  | "tool_result"
  | "plan_created"
  | "step_started"
  | "step_completed"
  | "complete"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: unknown;
}

export interface StatusChangeEvent {
  type: "status_change";
  data: { status: AgentStatus };
}

export interface MessageChunkEvent {
  type: "message_chunk";
  data: { content: string; agent: AgentType };
}

export interface ToolCallEvent {
  type: "tool_call";
  data: { tool: ToolCall };
}

export interface ToolResultEvent {
  type: "tool_result";
  data: { result: ToolResult };
}

export interface PlanCreatedEvent {
  type: "plan_created";
  data: { plan: Plan };
}

export interface StepStartedEvent {
  type: "step_started";
  data: { step: PlanStep; index: number };
}

export interface StepCompletedEvent {
  type: "step_completed";
  data: { step: PlanStep; index: number };
}

export interface CompleteEvent {
  type: "complete";
  data: { result: string };
}

export interface ErrorEvent {
  type: "error";
  data: { message: string };
}

// ============ 事件处理器类型 ============

export type AgentEventHandler = (event: AgentEvent) => void;

// ============ API 函数 ============

/**
 * 启动 Agent 任务
 */
export async function startTask(
  config: AgentConfig,
  task: string,
  context: TaskContext
): Promise<void> {
  await invoke("agent_start_task", { config, task, context });
}

/**
 * 中止 Agent 任务
 */
export async function abortTask(): Promise<void> {
  await invoke("agent_abort");
}

/**
 * 获取 Agent 状态
 */
export async function getStatus(): Promise<AgentStatus> {
  return await invoke("agent_get_status");
}

/**
 * 用户回答后继续任务
 */
export async function continueWithAnswer(answer: string): Promise<void> {
  await invoke("agent_continue_with_answer", { answer });
}

/**
 * 监听 Agent 事件
 */
export async function onAgentEvent(
  handler: AgentEventHandler
): Promise<UnlistenFn> {
  return await listen<AgentEvent>("agent-event", (event) => {
    handler(event.payload);
  });
}

// ============ 辅助函数 ============

/**
 * 从 AI 配置创建 AgentConfig
 */
export function createAgentConfig(aiConfig: {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}): AgentConfig {
  return {
    provider: aiConfig.provider,
    model: aiConfig.model,
    api_key: aiConfig.apiKey,
    base_url: aiConfig.baseUrl,
    temperature: aiConfig.temperature ?? 0.7,
    max_tokens: aiConfig.maxTokens ?? 4096,
    max_plan_iterations: 3,
    max_steps: 10,
    auto_approve: false,
    locale: "zh-CN",
  };
}
