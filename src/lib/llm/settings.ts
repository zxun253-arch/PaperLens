import { getAllSettings } from "../db/settings";
import type { AiMode, AiSettings, LLMProvider, ProviderConfig } from "./types";
import { getApiKey } from "../keychain";

export const AI_MODE_STORAGE_KEY = "AI_MODE";
export const LLM_PROVIDER_STORAGE_KEY = "LLM_PROVIDER";
export const LLM_BASE_URL_STORAGE_KEY = "LLM_BASE_URL";
export const LLM_API_KEY_STORAGE_KEY = "LLM_API_KEY";
export const LLM_MODEL_STORAGE_KEY = "LLM_MODEL";

export const API_ONLY_MODE: AiMode = "custom_api";

export const aiModeLabels: Record<AiMode, string> = {
  local_basic: "本地基础模式",
  prompt_only: "Prompt 辅助模式",
  custom_api: "自定义大模型 API 模式",
  local_model: "本地模型模式",
};

export const aiModeDescriptions: Record<AiMode, string> = {
  local_basic: "仅使用本地分析、笔记和导出能力。",
  prompt_only: "生成 Prompt 后复制到外部 AI 工具使用。",
  custom_api: "接入自定义 API 后，在 App 内使用论文分析能力。",
  local_model: "预留本地模型模式。",
};

export const providerConfigs: Record<LLMProvider, ProviderConfig> = {
  openai_compatible: {
    provider: "openai_compatible",
    label: "OpenAI-compatible 通用接口",
    description: "兼容 OpenAI Chat Completions 格式的服务。",
    defaultBaseUrl: "",
    defaultModel: "",
    commonModels: [],
    modelPlaceholder: "例如：deepseek-chat / qwen-plus / gpt-5.5",
    apiKeyPlaceholder: "请输入对应服务商的 API Key",
    adapter: "openai_compatible",
  },
  openai: {
    provider: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API。",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.5",
    commonModels: ["gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.2", "gpt-5.2-pro", "o3-pro", "gpt-5-codex-mini"],
    modelPlaceholder: "例如：gpt-5.5",
    apiKeyPlaceholder: "sk-...",
    adapter: "openai_compatible",
  },
  deepseek: {
    provider: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek OpenAI-compatible API。",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    commonModels: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
    modelPlaceholder: "例如：deepseek-v4-flash",
    apiKeyPlaceholder: "请输入 DeepSeek API Key",
    adapter: "openai_compatible",
  },
  qwen: {
    provider: "qwen",
    label: "Qwen / 通义千问",
    description: "阿里云百炼 OpenAI-compatible API。",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen3.6-plus",
    commonModels: ["qwen3.6-plus", "qwen3.6-max", "qwen3-plus", "qwen3-max", "qwen3-coder-plus", "qwen-turbo-latest", "qwen-plus-latest"],
    modelPlaceholder: "例如：qwen3.6-plus",
    apiKeyPlaceholder: "请输入阿里云百炼 API Key",
    adapter: "openai_compatible",
  },
  openrouter: {
    provider: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter OpenAI-compatible API。",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-5.5",
    commonModels: ["openai/gpt-5.5", "openai/gpt-5.2", "openai/gpt-5.1", "anthropic/claude-sonnet-4-6", "anthropic/claude-opus-4-8", "deepseek/deepseek-v4-flash", "deepseek/deepseek-v4-pro", "google/gemini-2.5-pro", "qwen/qwen3.6-plus", "meta-llama/llama-4-scout"],
    modelPlaceholder: "例如：openai/gpt-5.5",
    apiKeyPlaceholder: "请输入 OpenRouter API Key",
    adapter: "openai_compatible",
  },
  anthropic: {
    provider: "anthropic",
    label: "Claude / Anthropic",
    description: "Anthropic Messages API adapter。",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    commonModels: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5", "claude-opus-4-7"],
    modelPlaceholder: "例如：claude-sonnet-4-6",
    apiKeyPlaceholder: "请输入 Anthropic API Key",
    adapter: "anthropic",
  },
  gemini: {
    provider: "gemini",
    label: "Gemini / Google AI",
    description: "Google Gemini generateContent API adapter。",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-pro",
    commonModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
    modelPlaceholder: "例如：gemini-2.5-pro",
    apiKeyPlaceholder: "请输入 Google AI API Key",
    adapter: "gemini",
  },
  moonshot: {
    provider: "moonshot",
    label: "Moonshot / Kimi",
    description: "Moonshot OpenAI-compatible API。",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    commonModels: ["kimi-k2.6", "kimi-k2.5", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
    modelPlaceholder: "例如：kimi-k2.6",
    apiKeyPlaceholder: "请输入 Moonshot API Key",
    adapter: "openai_compatible",
  },
  zhipu: {
    provider: "zhipu",
    label: "智谱 GLM",
    description: "智谱 OpenAI-compatible API。",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5",
    commonModels: ["glm-5", "glm-5.1", "glm-4.7-flash", "glm-4.7", "glm-4.5", "glm-4-0520", "glm-4-air", "glm-4-flash"],
    modelPlaceholder: "例如：glm-5",
    apiKeyPlaceholder: "请输入智谱 API Key",
    adapter: "openai_compatible",
  },
  siliconflow: {
    provider: "siliconflow",
    label: "SiliconFlow / 硅基流动",
    description: "硅基流动 SiliconCloud OpenAI-compatible API。",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    commonModels: ["deepseek-ai/DeepSeek-V4-Flash", "deepseek-ai/DeepSeek-V4-Pro", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "Qwen/Qwen3.6-Plus", "Pro/deepseek-ai/DeepSeek-V4", "Pro/deepseek-ai/DeepSeek-R1"],
    modelPlaceholder: "例如：deepseek-ai/DeepSeek-V4-Flash",
    apiKeyPlaceholder: "请输入 SiliconFlow API Key",
    adapter: "openai_compatible",
  },
  yi: {
    provider: "yi",
    label: "零一万物 Yi",
    description: "零一万物 OpenAI-compatible API。",
    defaultBaseUrl: "https://api.lingyiwanwu.com/v1",
    defaultModel: "yi-lightning",
    commonModels: ["yi-lightning", "yi-lightning-lite", "yi-large", "yi-large-turbo", "yi-medium"],
    modelPlaceholder: "例如：yi-lightning",
    apiKeyPlaceholder: "请输入零一万物 API Key",
    adapter: "openai_compatible",
  },
  baichuan: {
    provider: "baichuan",
    label: "百川智能",
    description: "百川智能 OpenAI-compatible API。",
    defaultBaseUrl: "https://api.baichuan-ai.com/v1",
    defaultModel: "Baichuan4-Turbo",
    commonModels: ["Baichuan4-Turbo", "Baichuan4", "Baichuan3-Turbo"],
    modelPlaceholder: "例如：Baichuan4-Turbo",
    apiKeyPlaceholder: "请输入百川 API Key",
    adapter: "openai_compatible",
  },
  minimax: {
    provider: "minimax",
    label: "MiniMax",
    description: "MiniMax OpenAI-compatible API。",
    defaultBaseUrl: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-M3",
    commonModels: ["MiniMax-M3", "MiniMax-Text-01", "MiniMax-M2.7", "abab7", "abab6.5s"],
    modelPlaceholder: "例如：MiniMax-M3",
    apiKeyPlaceholder: "请输入 MiniMax API Key",
    adapter: "openai_compatible",
  },
  groq: {
    provider: "groq",
    label: "Groq",
    description: "Groq 极速推理 API（OpenAI-compatible）。",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-4-scout-17b",
    commonModels: ["llama-4-scout-17b", "llama-4-maverick-17b", "deepseek-r1-distill-llama-70b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    modelPlaceholder: "例如：llama-4-scout-17b",
    apiKeyPlaceholder: "请输入 Groq API Key",
    adapter: "openai_compatible",
  },
  together: {
    provider: "together",
    label: "Together AI",
    description: "Together AI OpenAI-compatible API。",
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    commonModels: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-V4-Flash", "meta-llama/Llama-4-Scout-17B-16E-Instruct", "meta-llama/Llama-4-Maverick-17B-128E-Instruct", "Qwen/Qwen3.6-Plus"],
    modelPlaceholder: "例如：deepseek-ai/DeepSeek-V3",
    apiKeyPlaceholder: "请输入 Together AI API Key",
    adapter: "openai_compatible",
  },
  doubao: {
    provider: "doubao",
    label: "火山引擎 / 豆包",
    description: "火山引擎大模型 API（OpenAI-compatible）。",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-0-pro",
    commonModels: ["doubao-seed-2-0-pro", "doubao-seed-2-0-lite", "doubao-seed-2-0-mini", "doubao-seed-2-0-code-preview", "doubao-1-5-pro-32k", "doubao-1-5-lite-32k"],
    modelPlaceholder: "例如：doubao-seed-2-0-pro",
    apiKeyPlaceholder: "请输入火山引擎 API Key",
    adapter: "openai_compatible",
  },
  spark: {
    provider: "spark",
    label: "讯飞星火",
    description: "讯飞星火认知大模型 API。",
    defaultBaseUrl: "https://spark-api-open.xf-yun.com/v1",
    defaultModel: "4.0Ultra",
    commonModels: ["4.0Ultra", "4.0Turbo", "3.5Turbo", "lite"],
    modelPlaceholder: "例如：4.0Ultra",
    apiKeyPlaceholder: "请输入讯飞星火 API Key",
    adapter: "openai_compatible",
  },
  ernie: {
    provider: "ernie",
    label: "百度文心一言",
    description: "百度千帆大模型 API（OpenAI-compatible）。",
    defaultBaseUrl: "https://qianfan.baidubce.com/v2",
    defaultModel: "ernie-5.1",
    commonModels: ["ernie-5.1", "ernie-4.5-8k", "ernie-4.0-8k", "ernie-3.5-8k", "ernie-lite-8k"],
    modelPlaceholder: "例如：ernie-5.1",
    apiKeyPlaceholder: "请输入百度千帆 API Key",
    adapter: "openai_compatible",
  },
  hunyuan: {
    provider: "hunyuan",
    label: "腾讯混元",
    description: "腾讯混元大模型 API（OpenAI-compatible）。",
    defaultBaseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbos-latest",
    commonModels: ["hunyuan-turbos-latest", "hunyuan-turbo", "hunyuan-large", "hunyuan-standard", "hunyuan-lite"],
    modelPlaceholder: "例如：hunyuan-turbos-latest",
    apiKeyPlaceholder: "请输入腾讯混元 API Key",
    adapter: "openai_compatible",
  },
  stepfun: {
    provider: "stepfun",
    label: "阶跃星辰",
    description: "阶跃星辰 Step API（OpenAI-compatible）。",
    defaultBaseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-2-16k",
    commonModels: ["step-2-16k", "step-3.7-flash", "step-3.5-flash", "step-1-8k", "step-1-flash"],
    modelPlaceholder: "例如：step-2-16k",
    apiKeyPlaceholder: "请输入阶跃星辰 API Key",
    adapter: "openai_compatible",
  },
  perplexity: {
    provider: "perplexity",
    label: "Perplexity",
    description: "Perplexity API（OpenAI-compatible）。",
    defaultBaseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-reasoning-pro",
    commonModels: ["sonar-reasoning-pro", "sonar-reasoning", "sonar-pro", "sonar", "sonar-deep-research"],
    modelPlaceholder: "例如：sonar-reasoning-pro",
    apiKeyPlaceholder: "请输入 Perplexity API Key",
    adapter: "openai_compatible",
  },
  mistral: {
    provider: "mistral",
    label: "Mistral AI",
    description: "Mistral AI API（OpenAI-compatible）。",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-2512",
    commonModels: ["mistral-large-2512", "mistral-medium-3.5", "mistral-small-4", "codestral-2512", "open-mistral-nemo"],
    modelPlaceholder: "例如：mistral-large-2512",
    apiKeyPlaceholder: "请输入 Mistral AI API Key",
    adapter: "openai_compatible",
  },
  cohere: {
    provider: "cohere",
    label: "Cohere",
    description: "Cohere API。",
    defaultBaseUrl: "https://api.cohere.com/v2",
    defaultModel: "command-r7b-12-2024",
    commonModels: ["command-r7b-12-2024", "command-a-03-2025", "command-light"],
    modelPlaceholder: "例如：command-r7b-12-2024",
    apiKeyPlaceholder: "请输入 Cohere API Key",
    adapter: "openai_compatible",
  },
  opencode: {
    provider: "opencode",
    label: "OpenCode",
    description: "OpenCode AI Gateway（OpenAI-compatible）。",
    defaultBaseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4-flash",
    commonModels: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v3-0324", "deepseek-r1-0528", "qwen3.6-plus"],
    modelPlaceholder: "例如：deepseek-v4-flash",
    apiKeyPlaceholder: "请输入 OpenCode API Key",
    adapter: "openai_compatible",
  },
};

export const providerOptions = Object.values(providerConfigs);

function normalizeAiMode(saved: string | null | undefined): AiMode {
  if (
    saved &&
    ["local_basic", "prompt_only", "custom_api", "local_model"].includes(saved)
  ) {
    return saved as AiMode;
  }
  return "local_basic";
}

function normalizeProvider(value: string | null | undefined): LLMProvider {
  if (value && value in providerConfigs) return value as LLMProvider;
  return "openai_compatible";
}

export function getProviderConfig(provider: LLMProvider) {
  return providerConfigs[provider];
}

export async function getCurrentAiSettings(): Promise<AiSettings> {
  const settings = await getAllSettings();
  const provider = normalizeProvider(settings[LLM_PROVIDER_STORAGE_KEY]);

  // Try OS keychain first, fall back to DB for backward compatibility
  let apiKey = await getApiKey(provider).catch(() => {
    console.warn("Keychain unavailable, falling back to DB stored key");
    return "";
  });
  if (!apiKey) {
    apiKey = settings[LLM_API_KEY_STORAGE_KEY] ?? "";
  }

  return {
    mode: normalizeAiMode(settings[AI_MODE_STORAGE_KEY]),
    provider,
    baseUrl: settings[LLM_BASE_URL_STORAGE_KEY] ?? "",
    apiKey,
    model: settings[LLM_MODEL_STORAGE_KEY] ?? "",
  };
}

export function getAiModeDescription(mode: AiMode) {
  return aiModeDescriptions[mode];
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
