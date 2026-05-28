export type AiMode = "local_basic" | "prompt_only" | "custom_api" | "local_model";

export type LegacyAiMode = AiMode | "off";

export type LLMProvider =
  | "openai_compatible"
  | "openai"
  | "deepseek"
  | "qwen"
  | "openrouter"
  | "anthropic"
  | "gemini"
  | "moonshot"
  | "zhipu"
  | "ollama";

export interface AiSettings {
  mode: AiMode;
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCallResult {
  content: string;
  provider: LLMProvider;
  model: string;
  raw?: unknown;
  usage?: unknown;
}

export type LlmResponse = LLMCallResult;

export interface ProviderConfig {
  provider: LLMProvider;
  label: string;
  description: string;
  defaultBaseUrl: string;
  modelPlaceholder: string;
  apiKeyPlaceholder: string;
  adapter: "openai_compatible" | "anthropic" | "gemini" | "placeholder";
}
