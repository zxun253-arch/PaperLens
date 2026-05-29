import { createLlmCallLog } from "../db/llmCallLogs";
import type { LlmErrorType } from "../../types/paper";
import {
  getCurrentAiSettings,
  getProviderConfig,
  providerConfigs,
} from "./settings";
import type {
  AiConnectionTestResult,
  AiSettings,
  LLMCallResult,
  LLMProvider,
  LlmRequest,
} from "./types";

const DEFAULT_TIMEOUT_MS = 45_000;

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sanitizeErrorText(message: string, apiKey?: string) {
  let text = message;
  if (apiKey?.trim()) {
    text = text.split(apiKey).join("[API_KEY]");
  }
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");
}

export function sanitizeLlmMessage(message: string, apiKey?: string) {
  return sanitizeErrorText(message, apiKey).slice(0, 500);
}

export function classifyLlmError(error: unknown): LlmErrorType {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (
    message.includes("api key") ||
    message.includes("base url") ||
    message.includes("model name") ||
    message.includes("配置")
  ) {
    return "missing_config";
  }
  if (
    message.includes("暂未") ||
    message.includes("unsupported") ||
    message.includes("placeholder")
  ) {
    return "unsupported_provider";
  }
  if (
    message.includes("timeout") ||
    message.includes("超时") ||
    message.includes("abort")
  ) {
    return "timeout";
  }
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("鉴权") ||
    message.includes("permission")
  ) {
    return "auth_error";
  }
  if (
    message.includes("404") ||
    message.includes("endpoint") ||
    message.includes("接口地址")
  ) {
    return "endpoint_error";
  }
  if (message.includes("model") || message.includes("模型")) {
    return "model_error";
  }
  if (
    message.includes("429") ||
    message.includes("限流") ||
    message.includes("rate")
  ) {
    return "rate_limit";
  }
  if (
    message.includes("402") ||
    message.includes("quota") ||
    message.includes("余额") ||
    message.includes("额度")
  ) {
    return "quota_error";
  }
  if (
    message.includes("格式") ||
    message.includes("format") ||
    message.includes("空内容")
  ) {
    return "response_format_error";
  }
  if (
    message.includes("网络") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "network_error";
  }
  return "unknown_error";
}

function ensureSettings(settings: AiSettings) {
  if (settings.mode !== "custom_api") {
    throw new Error("当前不是自定义大模型 API 模式，不会调用模型。");
  }

  if (!settings.provider) {
    throw new Error("请选择模型服务商。");
  }

  if (settings.provider === "ollama") {
    throw new Error("Ollama / 本地模型模式当前暂未完整实现，请等待后续支持。");
  }

  if (!settings.baseUrl.trim()) {
    throw new Error("请填写 API Base URL。");
  }

  if (!settings.model.trim()) {
    throw new Error("请填写 Model Name。");
  }

  if (!settings.apiKey.trim()) {
    throw new Error("请填写 API Key。");
  }
}

function buildOpenAIEndpoint(baseUrl: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.endsWith("/chat/completions")) return normalized;
  return `${normalized}/chat/completions`;
}

function buildAnthropicEndpoint(baseUrl: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.endsWith("/messages")) return normalized;
  return `${normalized}/messages`;
}

function buildGeminiEndpoint(baseUrl: string, model: string, apiKey: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.includes(":generateContent")) return normalized;
  return `${normalized}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(
        sanitizeErrorText(formatHttpError(response.status, data), apiKey),
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查网络、Base URL 或服务商状态。");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "网络请求失败，请检查网络连接、Base URL、服务商接口或桌面环境访问权限。",
      );
    }
    if (error instanceof Error) {
      throw new Error(sanitizeErrorText(error.message, apiKey));
    }
    throw new Error("模型请求失败，请检查服务商配置。");
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.message === "string") return errorRecord.message;
    if (typeof errorRecord.type === "string") return errorRecord.type;
  }
  if (typeof record.message === "string") return record.message;
  return "";
}

function formatHttpError(status: number, data: unknown) {
  const details = extractErrorMessage(data);
  const suffix = details ? `：${details}` : "。";

  if (status === 401 || status === 403)
    return `鉴权失败，请检查 API Key 或权限${suffix}`;
  if (status === 404)
    return `接口地址或模型不存在，请检查 Base URL 和 Model Name${suffix}`;
  if (status === 429) return `请求被限流，请稍后重试或检查服务商额度${suffix}`;
  if (status === 402) return `账户余额或额度不足，请检查服务商控制台${suffix}`;
  if (status >= 500) return `服务商接口暂时不可用，请稍后重试${suffix}`;
  return `模型请求失败，HTTP ${status}${suffix}`;
}

function getSystemAndMessages(request: LlmRequest) {
  const system =
    request.messages.find((message) => message.role === "system")?.content ??
    "";
  const messages = request.messages.filter(
    (message) => message.role !== "system",
  );
  return { system, messages };
}

function parseOpenAICompatibleResponse(
  raw: unknown,
  provider: LLMProvider,
  model: string,
): LLMCallResult {
  const record = raw as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    usage?: unknown;
  };
  const content =
    record.choices?.[0]?.message?.content ?? record.choices?.[0]?.text ?? "";

  if (!content.trim()) {
    throw new Error("服务商返回了空内容或未知格式。");
  }

  return {
    content,
    provider,
    model,
    raw,
    usage: record.usage,
  };
}

async function callOpenAICompatible(
  request: LlmRequest,
  settings: AiSettings,
): Promise<LLMCallResult> {
  const raw = await requestJson<unknown>(
    buildOpenAIEndpoint(settings.baseUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
      }),
    },
    settings.apiKey,
  );

  return parseOpenAICompatibleResponse(raw, settings.provider, settings.model);
}

async function callAnthropic(
  request: LlmRequest,
  settings: AiSettings,
): Promise<LLMCallResult> {
  const { system, messages } = getSystemAndMessages(request);
  const raw = await requestJson<unknown>(
    buildAnthropicEndpoint(settings.baseUrl),
    {
      method: "POST",
      headers: {
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.2,
        system: system || undefined,
        messages: messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      }),
    },
    settings.apiKey,
  );
  const record = raw as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: unknown;
  };
  const content =
    record.content
      ?.map((item) =>
        item.type === "text" || !item.type ? (item.text ?? "") : "",
      )
      .join("")
      .trim() ?? "";

  if (!content) {
    throw new Error("Anthropic 返回了空内容或未知格式。");
  }

  return {
    content,
    provider: settings.provider,
    model: settings.model,
    raw,
    usage: record.usage,
  };
}

async function callGemini(
  request: LlmRequest,
  settings: AiSettings,
): Promise<LLMCallResult> {
  const { system, messages } = getSystemAndMessages(request);
  const prompt = [
    system ? `系统要求：\n${system}` : "",
    ...messages.map(
      (message) =>
        `${message.role === "assistant" ? "助手" : "用户"}：\n${message.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await requestJson<unknown>(
    buildGeminiEndpoint(settings.baseUrl, settings.model, settings.apiKey),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    },
    settings.apiKey,
  );
  const record = raw as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: unknown;
  };
  const content =
    record.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!content) {
    throw new Error("Gemini 返回了空内容或未知格式。");
  }

  return {
    content,
    provider: settings.provider,
    model: settings.model,
    raw,
    usage: record.usageMetadata,
  };
}

export async function callLLM(
  request: LlmRequest,
  settings?: AiSettings,
): Promise<LLMCallResult> {
  const currentSettings = settings ?? (await getCurrentAiSettings());
  ensureSettings(currentSettings);

  const config = providerConfigs[currentSettings.provider];
  if (config.adapter === "placeholder") {
    throw new Error(
      "该服务商当前暂未完整实现，请使用 OpenAI-compatible 通用接口或等待后续支持。",
    );
  }

  if (config.adapter === "anthropic") {
    return callAnthropic(request, currentSettings);
  }

  if (config.adapter === "gemini") {
    return callGemini(request, currentSettings);
  }

  return callOpenAICompatible(request, currentSettings);
}

export async function testAiConnection(): Promise<AiConnectionTestResult> {
  const settings = await getCurrentAiSettings();
  const config = getProviderConfig(settings.provider);
  const testedAt = new Date().toISOString();

  try {
    if (settings.mode !== "custom_api") {
      throw new Error("请先切换到自定义大模型 API 模式。");
    }

    if (config.adapter === "placeholder") {
      throw new Error(
        "该服务商当前暂未完整实现，请使用 OpenAI-compatible 通用接口或等待后续支持。",
      );
    }

    const result = await callLLM(
      {
        messages: [
          { role: "system", content: "你是连接测试助手。" },
          { role: "user", content: "请只回复 OK" },
        ],
        temperature: 0,
        maxTokens: 16,
      },
      settings,
    );

    await createLlmCallLog({
      provider: settings.provider,
      adapter: config.adapter,
      model: settings.model,
      base_url: settings.baseUrl,
      action: "test_connection",
      status: "success",
      message: `连接成功：${config.label} / ${result.model}`,
    });

    return {
      ok: true,
      message: `连接成功：${config.label} / ${result.model}`,
      testedAt,
      provider: settings.provider,
      model: result.model,
      adapter: config.adapter,
      requestSent: true,
      responseOk: true,
    };
  } catch (error) {
    const errorType = classifyLlmError(error);
    const message =
      error instanceof Error
        ? sanitizeErrorText(error.message, settings.apiKey)
        : "测试连接失败。";

    await createLlmCallLog({
      provider: settings.provider,
      adapter: config.adapter,
      model: settings.model,
      base_url: settings.baseUrl,
      action: "test_connection",
      status: "failed",
      error_type: errorType,
      message: sanitizeLlmMessage(message, settings.apiKey),
    });

    return {
      ok: false,
      message,
      testedAt,
      provider: settings.provider,
      model: settings.model,
      adapter: config.adapter,
      requestSent:
        errorType !== "missing_config" && errorType !== "unsupported_provider",
      responseOk: false,
      errorType,
    };
  }
}
