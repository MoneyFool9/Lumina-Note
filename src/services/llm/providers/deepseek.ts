/**
 * DeepSeek Provider
 * 支持 DeepSeek R1 的 reasoning_content + 流式传输
 * 
 * 使用 Tauri HTTP 客户端（Rust reqwest）发送流式请求，
 * 绕过 WebView 的 HTTP/2 协议问题，提高稳定性
 */

import type { Message, LLMConfig, LLMOptions, LLMResponse, LLMProvider, LLMStream, StreamChunk } from "../types";
import { tauriFetch } from "@/lib/tauriFetch";

export class DeepSeekProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 非流式调用（用于普通 call() 和 Function Calling）
   * 流式调用请使用 stream() 方法
   */
  async call(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";
    const isReasonerModel = this.config.model.includes("reasoner");

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: isReasonerModel ? 1.0 : (options?.temperature ?? 0.7),
      max_tokens: options?.maxTokens || 8192,
      stream: false,
    };

    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = "auto";
    }

    const response = await tauriFetch({
      url: `${baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      timeout_secs: 120,
    });

    if (response.error) {
      throw new Error(`DeepSeek API 请求失败: ${response.error}`);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`DeepSeek API 错误 (${response.status}): ${response.body}`);
    }

    const data = JSON.parse(response.body);
    const message = data.choices[0]?.message;

    let content = "";
    if (message) {
      if (message.reasoning_content) {
        content += `<thinking>\n${message.reasoning_content}\n</thinking>\n\n`;
      }
      content += message.content || "";
    }

    const toolCalls = message?.tool_calls?.map((tc: {
      id: string;
      function: { name: string; arguments: string };
    }) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      content,
      toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  }

  /**
   * 流式调用 DeepSeek API（使用 Tauri 流式，更稳定）
   */
  async *stream(messages: Message[], options?: LLMOptions): LLMStream {
    const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";
    const isReasonerModel = this.config.model.includes("reasoner");

    const requestBody = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: isReasonerModel ? 1.0 : (options?.temperature ?? 0.7),
      max_tokens: options?.maxTokens || 8192,
      stream: true,
      stream_options: { include_usage: true },
    };

    // 使用异步队列来桥接回调和 AsyncGenerator
    type QueueItem = StreamChunk | { type: "done" } | { type: "error"; error: string };
    const queue: QueueItem[] = [];
    let resolveNext: (() => void) | null = null;
    let streamDone = false;
    let streamError: string | null = null;

    // 监听 Tauri 事件来获取原始 SSE 数据
    const { listen } = await import("@tauri-apps/api/event");
    const { invoke } = await import("@tauri-apps/api/core");
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    console.log("[DeepSeek Stream] Starting stream with requestId:", requestId);
    
    const unlisten = await listen<{
      request_id: string;
      chunk: string;
      done: boolean;
      error?: string;
    }>("llm-stream-chunk", (event) => {
      const { request_id, chunk, done, error } = event.payload;
      
      console.log("[DeepSeek Stream] Event received:", { request_id, done, error, chunkLength: chunk?.length });
      
      // 只处理当前请求的事件
      if (request_id !== requestId) {
        console.log("[DeepSeek Stream] Ignoring event for different request");
        return;
      }
      
      if (error) {
        queue.push({ type: "error", error });
        streamDone = true;
      } else if (done) {
        queue.push({ type: "done" });
        streamDone = true;
      } else if (chunk) {
        // 解析 SSE JSON 数据
        try {
          const data = JSON.parse(chunk);
          const delta = data.choices?.[0]?.delta;

          // 处理 reasoning_content (DeepSeek R1)
          if (delta?.reasoning_content) {
            queue.push({ type: "reasoning", text: delta.reasoning_content });
          }

          // 处理正常文本内容
          if (delta?.content) {
            queue.push({ type: "text", text: delta.content });
          }

          // 处理 usage
          if (data.usage) {
            queue.push({
              type: "usage",
              inputTokens: data.usage.prompt_tokens || 0,
              outputTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            });
          }
        } catch {
          // JSON 解析失败，跳过
        }
      }

      // 唤醒等待的 generator
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });

    // 启动流式请求
    console.log("[DeepSeek Stream] Invoking llm_fetch_stream...");
    invoke("llm_fetch_stream", {
      requestId,
      request: {
        url: `${baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        timeout_secs: 300,
      },
    }).then(() => {
      console.log("[DeepSeek Stream] invoke completed");
    }).catch((e) => {
      console.error("[DeepSeek Stream] invoke error:", e);
      streamError = String(e);
      streamDone = true;
      if (resolveNext) resolveNext();
    });

    try {
      // Generator 循环
      while (true) {
        // 如果队列有数据，取出并 yield
        while (queue.length > 0) {
          const item = queue.shift()!;
          if (item.type === "done") {
            return;
          }
          if (item.type === "error") {
            yield { type: "error", error: item.error };
            return;
          }
          yield item as StreamChunk;
        }

        // 如果流已结束且队列为空，退出
        if (streamDone && queue.length === 0) {
          if (streamError) {
            yield { type: "error", error: streamError };
          }
          return;
        }

        // 等待新数据
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
          // 设置超时，避免永久阻塞
          setTimeout(() => {
            if (resolveNext === resolve) {
              resolveNext = null;
              resolve();
            }
          }, 100);
        });
      }
    } finally {
      unlisten();
    }
  }
}
