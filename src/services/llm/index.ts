/**
 * LLM Service 统一入口
 */

// 类型导出
export type {
  Message,
  LLMConfig,
  LLMOptions,
  LLMResponse,
  LLMUsage,
  LLMProvider,
  LLMProviderType,
  ProviderMeta,
  ModelMeta,
  StreamChunk,
  LLMStream,
} from "./types";

// Provider 注册表
export { PROVIDER_REGISTRY } from "./types";

// 配置管理
export { getLLMConfig, setLLMConfig, resetLLMConfig } from "./config";

// Providers
export { 
  AnthropicProvider, 
  OpenAIProvider,
  GeminiProvider,
  MoonshotProvider,
  DeepSeekProvider,
  GroqProvider,
  OpenRouterProvider,
  OllamaProvider,
} from "./providers";

// ============ 统一调用接口 ============

import type { Message, LLMOptions, LLMResponse, LLMProvider, LLMStream } from "./types";
import { getLLMConfig } from "./config";
import { 
  AnthropicProvider, 
  OpenAIProvider,
  GeminiProvider,
  MoonshotProvider,
  DeepSeekProvider,
  GroqProvider,
  OpenRouterProvider,
  OllamaProvider,
} from "./providers";

/**
 * 根据当前配置创建 Provider 实例
 */
export function createProvider(): LLMProvider {
  const rawConfig = getLLMConfig();

  console.log('[AI Debug] createProvider() called', {
    provider: rawConfig.provider,
    model: rawConfig.model,
    hasApiKey: !!rawConfig.apiKey,
    apiKeyLength: rawConfig.apiKey?.length || 0,
    baseUrl: rawConfig.baseUrl,
  });

  // Ollama 不需要 API Key
  if (!rawConfig.apiKey && rawConfig.provider !== "ollama") {
    console.error('[AI Debug] No API key found for', rawConfig.provider);
    throw new Error("请先配置 API Key");
  }

  // 处理自定义模型：当 model === "custom" 时使用 customModelId
  const config = {
    ...rawConfig,
    model: rawConfig.model === "custom" && rawConfig.customModelId 
      ? rawConfig.customModelId 
      : rawConfig.model,
  };

  console.log('[AI Debug] Final config:', {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "moonshot":
      return new MoonshotProvider(config);
    case "deepseek":
      return new DeepSeekProvider(config);
    case "groq":
      return new GroqProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    default:
      console.error('[AI Debug] Unsupported provider:', config.provider);
      throw new Error(`不支持的 AI 提供商: ${config.provider}`);
  }
}

/**
 * 调用 LLM (统一入口)
 */
export async function callLLM(
  messages: Message[],
  options?: LLMOptions
): Promise<LLMResponse> {
  console.log('[AI Debug] callLLM() called with', messages.length, 'messages');
  
  try {
    const provider = createProvider();
    const config = getLLMConfig();
    const finalOptions = {
      ...options,
      temperature: options?.temperature ?? config.temperature,
    };
    console.log('[AI Debug] Provider created, calling provider.call()');
    const response = await provider.call(messages, finalOptions);
    console.log('[AI Debug] Provider.call() returned successfully');
    return response;
  } catch (error) {
    console.error('[AI Debug] Error in callLLM():', error);
    throw error;
  }
}

/**
 * 流式调用 LLM (统一入口)
 * 返回 AsyncGenerator，逐块 yield 内容
 */
export async function* callLLMStream(
  messages: Message[],
  options?: LLMOptions
): LLMStream {
  const provider = createProvider();
  const config = getLLMConfig();
  const finalOptions = {
    ...options,
    temperature: options?.temperature ?? config.temperature,
  };
  
  // 检查 Provider 是否支持流式
  if (!provider.stream) {
    // 降级：不支持流式的 Provider 一次性返回
    const response = await provider.call(messages, finalOptions);
    yield { type: "text", text: response.content };
    if (response.usage) {
      yield {
        type: "usage",
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
      };
    }
    return;
  }
  
  // 使用 Provider 的流式方法
  yield* provider.stream(messages, finalOptions);
}
