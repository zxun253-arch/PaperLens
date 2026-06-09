import type { LlmErrorType } from "../../types/paper";

export function sanitizeErrorText(message: string, apiKey?: string) {
  let text = message;
  if (apiKey?.trim()) {
    text = text.split(apiKey).join("[API_KEY]");
  }
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
    .replace(/[?&]key=[A-Za-z0-9_-]+/gi, "$1key=***"); // Gemini URL key
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
    message.includes("配置") ||
    message.includes("缺失")
  ) {
    return "missing_config";
  }
  if (message.includes("暂未") || message.includes("unsupported")) {
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
    message.includes("未授权") ||
    message.includes("permission") ||
    message.includes("unauthorized")
  ) {
    return "auth_error";
  }
  if (
    message.includes("404") ||
    message.includes("endpoint") ||
    message.includes("接口地址") ||
    message.includes("不存在")
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
    message.includes("empty content")
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

export function extractErrorMessage(data: unknown) {
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

export function formatHttpError(status: number, data: unknown) {
  const details = extractErrorMessage(data);
  const suffix = details ? `: ${details}` : ".";

  if (status === 401 || status === 403) {
    return `鉴权失败，请检查 API Key 或权限${suffix}`;
  }
  if (status === 404) {
    return `接口地址或模型不存在，请检查 Base URL 和 Model Name${suffix}`;
  }
  if (status === 429) {
    return `请求被限流，请稍后重试或检查服务商额度${suffix}`;
  }
  if (status === 402) {
    return `账户余额或额度不足，请检查服务商控制台${suffix}`;
  }
  if (status >= 500) {
    return `服务商接口暂时不可用，请稍后重试${suffix}`;
  }
  return `模型请求失败，HTTP ${status}${suffix}`;
}
