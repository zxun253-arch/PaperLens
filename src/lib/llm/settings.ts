import { getAllSettings } from "../db/settings";
import type { AiMode, AiSettings, LLMProvider, ProviderConfig } from "./types";

export const AI_MODE_STORAGE_KEY = "AI_MODE";
export const LLM_PROVIDER_STORAGE_KEY = "LLM_PROVIDER";
export const LLM_BASE_URL_STORAGE_KEY = "LLM_BASE_URL";
export const LLM_API_KEY_STORAGE_KEY = "LLM_API_KEY";
export const LLM_MODEL_STORAGE_KEY = "LLM_MODEL";

export const aiModeLabels: Record<AiMode, string> = {
  local_basic: "本地基础模式",
  prompt_only: "Prompt 辅助模式",
  custom_api: "自定义大模型 API 模式",
  local_model: "本地模型模式",
};

export const aiModeDescriptions: Record<AiMode, string> = {
  local_basic:
    "不需要 API，不需要服务器。可使用 PDF 解析、论文分块、本地分析、Prompt、笔记和 Markdown / Word 导出。",
  prompt_only:
    "不需要 API，不需要服务器。根据论文分块生成 Prompt，复制到外部 AI 网页使用，再把结果粘贴回 App 保存。",
  custom_api:
    "用户自己选择服务商并填写 API Key，App 在本地调用用户配置的大模型 API。",
  local_model: "后续预留 Ollama / LM Studio，本阶段仅作为占位选项。",
};

export const providerConfigs: Record<LLMProvider, ProviderConfig> = {
  openai_compatible: {
    provider: "openai_compatible",
    label: "OpenAI-compatible 通用接口",
    description:
      "适合兼容 OpenAI Chat Completions 格式的服务。Base URL 通常形如 https://api.example.com/v1。",
    defaultBaseUrl: "",
    modelPlaceholder: "例如：deepseek-chat / qwen-plus / gpt-4.1-mini",
    apiKeyPlaceholder: "请输入对应服务商的 API Key",
    adapter: "openai_compatible",
  },
  openai: {
    provider: "openai",
    label: "OpenAI",
    description:
      "复用 OpenAI-compatible 接口。请以 OpenAI 控制台中的模型名和额度为准。",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "例如：gpt-4.1-mini",
    apiKeyPlaceholder: "sk-...",
    adapter: "openai_compatible",
  },
  deepseek: {
    provider: "deepseek",
    label: "DeepSeek",
    description:
      "通常可走 OpenAI-compatible 格式。Base URL 和模型名以 DeepSeek 控制台为准。",
    defaultBaseUrl: "https://api.deepseek.com",
    modelPlaceholder: "例如：deepseek-chat",
    apiKeyPlaceholder: "请输入 DeepSeek API Key",
    adapter: "openai_compatible",
  },
  qwen: {
    provider: "qwen",
    label: "Qwen / 通义千问",
    description:
      "建议使用阿里云百炼 OpenAI-compatible 接口。具体模型名以百炼控制台为准。",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelPlaceholder: "例如：qwen-plus",
    apiKeyPlaceholder: "请输入阿里云百炼 API Key",
    adapter: "openai_compatible",
  },
  openrouter: {
    provider: "openrouter",
    label: "OpenRouter",
    description: "复用 OpenAI-compatible 接口。模型名通常包含服务商前缀。",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelPlaceholder: "例如：openai/gpt-4o-mini",
    apiKeyPlaceholder: "请输入 OpenRouter API Key",
    adapter: "openai_compatible",
  },
  anthropic: {
    provider: "anthropic",
    label: "Claude / Anthropic",
    description: "使用独立 Anthropic Messages API 格式。",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    modelPlaceholder: "例如：claude-3-5-haiku-latest",
    apiKeyPlaceholder: "请输入 Anthropic API Key",
    adapter: "anthropic",
  },
  gemini: {
    provider: "gemini",
    label: "Gemini / Google AI",
    description: "使用独立 Gemini generateContent API 格式。",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelPlaceholder: "例如：gemini-1.5-flash",
    apiKeyPlaceholder: "请输入 Google AI API Key",
    adapter: "gemini",
  },
  moonshot: {
    provider: "moonshot",
    label: "Moonshot / Kimi",
    description:
      "优先按 OpenAI-compatible 接口调用。请以 Moonshot 控制台为准。",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    modelPlaceholder: "例如：moonshot-v1-8k",
    apiKeyPlaceholder: "请输入 Moonshot API Key",
    adapter: "openai_compatible",
  },
  zhipu: {
    provider: "zhipu",
    label: "智谱 GLM",
    description: "优先按 OpenAI-compatible 接口调用。请以智谱控制台为准。",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelPlaceholder: "例如：glm-4-flash",
    apiKeyPlaceholder: "请输入智谱 API Key",
    adapter: "openai_compatible",
  },
  ollama: {
    provider: "ollama",
    label: "Ollama / 本地模型，后续支持",
    description: "本阶段仅占位，后续支持 Ollama / LM Studio。",
    defaultBaseUrl: "http://localhost:11434",
    modelPlaceholder: "例如：llama3.1",
    apiKeyPlaceholder: "本地模型通常不需要 API Key",
    adapter: "placeholder",
  },
};

export const providerOptions = Object.values(providerConfigs);

function normalizeAiMode(value: string | null | undefined): AiMode {
  if (
    value === "local_basic" ||
    value === "prompt_only" ||
    value === "custom_api" ||
    value === "local_model"
  ) {
    return value;
  }

  if (value === "off") return "local_basic";
  if (value === "local-key") return "custom_api";
  return "local_basic";
}

function normalizeProvider(value: string | null | undefined): LLMProvider {
  if (value && value in providerConfigs) {
    return value as LLMProvider;
  }
  return "openai_compatible";
}

export function getProviderConfig(provider: LLMProvider) {
  return providerConfigs[provider];
}

export async function getCurrentAiSettings(): Promise<AiSettings> {
  const settings = await getAllSettings();
  const mode = normalizeAiMode(
    settings[AI_MODE_STORAGE_KEY] ?? settings.LLM_MODE,
  );
  const provider = normalizeProvider(settings[LLM_PROVIDER_STORAGE_KEY]);

  return {
    mode,
    provider,
    baseUrl: settings[LLM_BASE_URL_STORAGE_KEY] ?? "",
    apiKey: settings[LLM_API_KEY_STORAGE_KEY] ?? "",
    model: settings[LLM_MODEL_STORAGE_KEY] ?? "",
  };
}

export function getAiModeDescription(mode: AiMode) {
  return aiModeDescriptions[mode];
}

export function isAiEnabled(settings: Pick<AiSettings, "mode">) {
  return settings.mode === "custom_api";
}

export function isPromptOnlyMode(settings: Pick<AiSettings, "mode">) {
  return settings.mode === "prompt_only";
}

export function isCustomApiMode(settings: Pick<AiSettings, "mode">) {
  return settings.mode === "custom_api";
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
