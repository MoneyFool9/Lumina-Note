/**
 * Rust Agent React Hook
 * 
 * 提供 React 组件使用 Rust Agent 的便捷接口
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AgentStatus,
  AgentType,
  AgentConfig,
  TaskContext,
  AgentEvent,
  Plan,
  PlanStep,
  ToolCall,
  ToolResult,
  startTask,
  abortTask,
  continueWithAnswer,
  onAgentEvent,
  createAgentConfig,
} from "./index";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  agent?: AgentType;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface RustAgentState {
  status: AgentStatus;
  messages: Message[];
  currentPlan: Plan | null;
  currentStep: PlanStep | null;
  error: string | null;
  isStreaming: boolean;
}

export interface UseRustAgentReturn {
  state: RustAgentState;
  start: (task: string, context: TaskContext) => Promise<void>;
  abort: () => Promise<void>;
  answer: (response: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * 使用 Rust Agent 的 React Hook
 */
export function useRustAgent(
  aiConfig: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  },
  options?: {
    autoApprove?: boolean;
    maxSteps?: number;
  }
): UseRustAgentReturn {
  const [state, setState] = useState<RustAgentState>({
    status: "idle",
    messages: [],
    currentPlan: null,
    currentStep: null,
    error: null,
    isStreaming: false,
  });

  // 用于累积流式消息
  const streamingContentRef = useRef<string>("");
  const currentAgentRef = useRef<AgentType>("coordinator");

  // 监听 Agent 事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await onAgentEvent((event: AgentEvent) => {
        handleEvent(event);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 处理事件
  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "status_change": {
        const { status } = event.data as { status: AgentStatus };
        setState((prev) => ({ ...prev, status }));
        
        // 如果状态变为 completed 或 error，结束流式输出
        if (status === "completed" || status === "error" || status === "aborted") {
          // 添加累积的流式内容作为消息
          if (streamingContentRef.current) {
            setState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: streamingContentRef.current,
                  agent: currentAgentRef.current,
                },
              ],
              isStreaming: false,
            }));
            streamingContentRef.current = "";
          }
        }
        break;
      }

      case "message_chunk": {
        const { content, agent } = event.data as { content: string; agent: AgentType };
        streamingContentRef.current += content;
        currentAgentRef.current = agent;
        
        setState((prev) => ({ ...prev, isStreaming: true }));
        break;
      }

      case "tool_call": {
        const { tool } = event.data as { tool: ToolCall };
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "tool",
              content: `调用工具: ${tool.name}`,
              toolCall: tool,
            },
          ],
        }));
        break;
      }

      case "tool_result": {
        const { result } = event.data as { result: ToolResult };
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "tool",
              content: result.success ? result.content : `错误: ${result.error}`,
              toolResult: result,
            },
          ],
        }));
        break;
      }

      case "plan_created": {
        const { plan } = event.data as { plan: Plan };
        setState((prev) => ({ ...prev, currentPlan: plan }));
        break;
      }

      case "step_started": {
        const { step } = event.data as { step: PlanStep; index: number };
        setState((prev) => ({ ...prev, currentStep: step }));
        break;
      }

      case "step_completed": {
        const { step } = event.data as { step: PlanStep; index: number };
        setState((prev) => ({
          ...prev,
          currentStep: null,
          currentPlan: prev.currentPlan
            ? {
                ...prev.currentPlan,
                steps: prev.currentPlan.steps.map((s) =>
                  s.id === step.id ? { ...s, completed: true } : s
                ),
              }
            : null,
        }));
        break;
      }

      case "complete": {
        const { result } = event.data as { result: string };
        // 完成时添加最终结果
        if (result && !streamingContentRef.current.includes(result)) {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: result,
                agent: "reporter",
              },
            ],
            isStreaming: false,
          }));
        }
        streamingContentRef.current = "";
        break;
      }

      case "error": {
        const { message } = event.data as { message: string };
        setState((prev) => ({
          ...prev,
          error: message,
          isStreaming: false,
        }));
        streamingContentRef.current = "";
        break;
      }
    }
  }, []);

  // 启动任务
  const start = useCallback(
    async (task: string, context: TaskContext) => {
      // 重置状态
      setState((prev) => ({
        ...prev,
        status: "running",
        error: null,
        currentPlan: null,
        currentStep: null,
        messages: [
          ...prev.messages,
          { role: "user", content: task },
        ],
      }));
      streamingContentRef.current = "";

      // 创建配置
      const config: AgentConfig = {
        ...createAgentConfig(aiConfig),
        auto_approve: options?.autoApprove ?? false,
        max_steps: options?.maxSteps ?? 10,
      };

      try {
        await startTask(config, task, context);
      } catch (e) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [aiConfig, options]
  );

  // 中止任务
  const abort = useCallback(async () => {
    try {
      await abortTask();
      setState((prev) => ({ ...prev, status: "aborted" }));
    } catch (e) {
      console.error("Failed to abort:", e);
    }
  }, []);

  // 用户回答
  const answer = useCallback(async (response: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "user", content: response }],
    }));
    
    try {
      await continueWithAnswer(response);
    } catch (e) {
      console.error("Failed to continue:", e);
    }
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      currentPlan: null,
      currentStep: null,
      error: null,
    }));
    streamingContentRef.current = "";
  }, []);

  return {
    state,
    start,
    abort,
    answer,
    clearMessages,
  };
}
