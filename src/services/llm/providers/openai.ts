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

    console.log('[AI Debug] OpenAI Provider call()', {
      url,
      model: this.config.model,
      messagesCount: messages.length,
      hasApiKey: !!this.config.apiKey,
    });

    const requestBody = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
      stream: false,  // 显式禁用流式，某些 API 代理需要
    };

    console.log('[AI Debug] Request body:', {
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      // 打印每条消息的角色和内容长度
      messages: requestBody.messages.map((m, i) => ({
        index: i,
        role: m.role,
        contentLength: m.content.length,
        contentPreview: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
      })),
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });

      console.log('[AI Debug] Fetch response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[AI Debug] API error response:', error);
        throw new Error(`OpenAI API 错误 (${response.status}): ${error}`);
      }

      console.log('[AI Debug] Parsing JSON response...');
      const data = await response.json();
      console.log('[AI Debug] RAW API Response:', JSON.stringify(data, null, 2));
      
      console.log('[AI Debug] Response parsed:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length || 0,
        hasUsage: !!data.usage,
        firstChoice: data.choices?.[0],
      });

      // 兼容多种 API 响应格式
      const message = data.choices?.[0]?.message;
      const delta = data.choices?.[0]?.delta; // 有些代理返回 delta 而不是 message
      
      // 尝试多种字段名获取内容
      const content = 
        message?.content ||  // 标准 OpenAI 格式
        delta?.content ||    // 流式格式（部分代理错误使用）
        message?.text ||     // 某些代理的格式
        data.choices?.[0]?.text || // 老版本 OpenAI 格式
        "";
        
      console.log('[AI Debug] Extracted content:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
        fullMessage: message,
        fullDelta: delta,
        rawChoice: data.choices?.[0],
      });

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
    } catch (error) {
      console.error('[AI Debug] OpenAI Provider error:', error);
      console.error('[AI Debug] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[AI Debug] Error message:', error instanceof Error ? error.message : String(error));
      
      // 特别检查网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[AI Debug] This is a fetch error, possibly CORS or network issue');
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('[AI Debug] Request was aborted (timeout or manual cancel)');
      }
      
      throw error;
    }
  }
}
