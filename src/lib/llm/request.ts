import { fetch } from "@tauri-apps/plugin-http";
import type {
  AiSettings,
  LlmRequest,
  ProviderConfig,
  StreamingCallback,
} from "./types";
import { formatHttpError, sanitizeErrorText } from "./errors";

const DEFAULT_TIMEOUT_MS = 45_000;

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildOpenAIEndpoint(baseUrl: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.endsWith("/chat/completions")) return normalized;
  return `${normalized}/chat/completions`;
}

export function buildAnthropicEndpoint(baseUrl: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.endsWith("/messages")) return normalized;
  return `${normalized}/messages`;
}

export function buildGeminiEndpoint(baseUrl: string, model: string, apiKey: string) {
  const normalized = trimSlash(baseUrl.trim());
  if (normalized.includes(":generateContent")) return normalized;
  return `${normalized}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export function buildGeminiStreamEndpoint(
  baseUrl: string,
  model: string,
  apiKey: string,
) {
  const endpoint = buildGeminiEndpoint(baseUrl, model, apiKey).replace(
    ":generateContent",
    ":streamGenerateContent",
  );
  return endpoint.includes("alt=")
    ? endpoint
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}alt=sse`;
}

export function ensureSettings(settings: AiSettings) {
  if (!settings.provider) {
    throw new Error("Please select an LLM provider.");
  }
  if (!settings.baseUrl.trim()) {
    throw new Error("Please enter API Base URL.");
  }
  if (!settings.model.trim()) {
    throw new Error("Please enter Model Name.");
  }
  if (!settings.apiKey.trim()) {
    throw new Error("Please enter API Key.");
  }
}

export function getSystemAndMessages(request: LlmRequest) {
  const system =
    request.messages.find((message) => message.role === "system")?.content ?? "";
  const messages = request.messages.filter(
    (message) => message.role !== "system",
  );
  return { system, messages };
}

export async function requestJson<T>(
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
      throw new Error("Request timed out. Please check the network, Base URL, or provider status.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Network request failed. Please check the network, Base URL, provider endpoint, or desktop permissions.",
      );
    }
    if (error instanceof Error) {
      throw new Error(sanitizeErrorText(error.message, apiKey));
    }
    throw new Error("LLM request failed. Please check provider settings.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractOpenAICompatibleStreamChunk(data: unknown) {
  const record = data as {
    choices?: Array<{
      delta?: { content?: string };
      message?: { content?: string };
      text?: string;
    }>;
    usage?: unknown;
  };

  return {
    text:
      record.choices
        ?.map(
          (choice) =>
            choice.delta?.content ?? choice.message?.content ?? choice.text ?? "",
        )
        .join("") ?? "",
    usage: record.usage,
  };
}

function extractAnthropicStreamChunk(data: unknown) {
  const record = data as {
    type?: string;
    delta?: { text?: string };
    content_block?: { text?: string };
    content?: Array<{ type?: string; text?: string }>;
    usage?: unknown;
  };

  if (record.delta?.text) {
    return { text: record.delta.text, usage: record.usage };
  }
  if (record.type === "content_block_start" && record.content_block?.text) {
    return { text: record.content_block.text, usage: record.usage };
  }
  return {
    text:
      record.content
        ?.map((item) =>
          item.type === "text" || !item.type ? (item.text ?? "") : "",
        )
        .join("") ?? "",
    usage: record.usage,
  };
}

function extractGeminiStreamChunk(data: unknown) {
  const record = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: unknown;
  };

  return {
    text:
      record.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "",
    usage: record.usageMetadata,
  };
}

function extractStreamChunk(
  adapter: Exclude<ProviderConfig["adapter"], "placeholder">,
  data: unknown,
) {
  if (adapter === "anthropic") return extractAnthropicStreamChunk(data);
  if (adapter === "gemini") return extractGeminiStreamChunk(data);
  return extractOpenAICompatibleStreamChunk(data);
}

export async function requestStream(
  url: string,
  init: RequestInit,
  apiKey: string,
  adapter: Exclude<ProviderConfig["adapter"], "placeholder">,
  onStream: StreamingCallback,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ content: string; raw: unknown[]; usage?: unknown }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const raw: unknown[] = [];
  let content = "";
  let usage: unknown;

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let data: unknown = text;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      throw new Error(
        sanitizeErrorText(formatHttpError(response.status, data), apiKey),
      );
    }

    if (!response.body) {
      throw new Error("LLM provider did not return a readable stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawSseData = false;

    const emitText = (text: string) => {
      if (!text) return;
      content += text;
      onStream(text);
    };

    const processData = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === "[DONE]") return;

      try {
        const data = JSON.parse(trimmed) as unknown;
        raw.push(data);
        const chunk = extractStreamChunk(adapter, data);
        if (chunk.usage) usage = chunk.usage;
        emitText(chunk.text);
      } catch {
        emitText(value);
      }
    };

    const processBuffer = (flush = false) => {
      const lines = buffer.split(/\r?\n/);
      buffer = flush ? "" : (lines.pop() ?? "");

      for (const line of lines) {
        if (line.startsWith("data:")) {
          sawSseData = true;
          processData(line.slice(5));
        }
      }

      if (flush && !sawSseData && lines.length > 0) {
        emitText(lines.join("\n"));
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      processBuffer();
    }

    buffer += decoder.decode();
    processBuffer(true);

    return { content, raw, usage };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("LLM request timed out. Please check the network, Base URL, or provider status.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Network request failed. Please check the network, Base URL, provider endpoint, or desktop permissions.",
      );
    }
    if (error instanceof Error) {
      throw new Error(sanitizeErrorText(error.message, apiKey));
    }
    throw new Error("LLM streaming request failed. Please check provider settings.");
  } finally {
    window.clearTimeout(timeout);
  }
}
