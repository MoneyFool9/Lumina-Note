/**
 * OpenAI Provider
 * 兼容所有 OpenAI API 格式的服务
 */

import type { Message, LLMConfig, LLMOptions, LLMResponse, LLMProvider } from "../types";

export class OpenAIProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async call(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    const url = `${baseUrl}/chat/completions`;

    const requestBody = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
      stream: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API 错误 (${response.status}): ${error}`);
    }

    const data = await response.json();

    // 兼容多种 API 响应格式
    const message = data.choices?.[0]?.message;
    const delta = data.choices?.[0]?.delta;
    
    const content = 
      message?.content ||
      delta?.content ||
      message?.text ||
      data.choices?.[0]?.text ||
      "";

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  }
}
