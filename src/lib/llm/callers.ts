import type { AiSettings, LLMCallResult, LlmRequest, LLMProvider, StreamingCallback } from "./types";
import { getProviderConfig } from "./settings";
import {
  buildAnthropicEndpoint,
  buildGeminiEndpoint,
  buildGeminiStreamEndpoint,
  buildOpenAIEndpoint,
  getSystemAndMessages,
  requestJson,
  requestStream,
} from "./request";

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
    throw new Error("LLM provider returned empty content or an unknown format.");
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

async function streamOpenAICompatible(
  request: LlmRequest,
  settings: AiSettings,
  onStream: StreamingCallback,
): Promise<LLMCallResult> {
  const stream = await requestStream(
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
        stream: true,
      }),
    },
    settings.apiKey,
    "openai_compatible",
    onStream,
  );

  if (!stream.content.trim()) {
    throw new Error("LLM provider returned empty content or an unknown format.");
  }

  return {
    content: stream.content,
    provider: settings.provider,
    model: settings.model,
    raw: stream.raw,
    usage: stream.usage,
  };
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
    throw new Error("Anthropic returned empty content or an unknown format.");
  }

  return {
    content,
    provider: settings.provider,
    model: settings.model,
    raw,
    usage: record.usage,
  };
}

async function streamAnthropic(
  request: LlmRequest,
  settings: AiSettings,
  onStream: StreamingCallback,
): Promise<LLMCallResult> {
  const { system, messages } = getSystemAndMessages(request);
  const stream = await requestStream(
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
        stream: true,
      }),
    },
    settings.apiKey,
    "anthropic",
    onStream,
  );

  if (!stream.content.trim()) {
    throw new Error("Anthropic returned empty content or an unknown format.");
  }

  return {
    content: stream.content,
    provider: settings.provider,
    model: settings.model,
    raw: stream.raw,
    usage: stream.usage,
  };
}

async function callGemini(
  request: LlmRequest,
  settings: AiSettings,
): Promise<LLMCallResult> {
  const { system, messages } = getSystemAndMessages(request);
  const prompt = [
    system ? `System requirements:\n${system}` : "",
    ...messages.map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "User"}:\n${message.content}`,
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
    throw new Error("Gemini returned empty content or an unknown format.");
  }

  return {
    content,
    provider: settings.provider,
    model: settings.model,
    raw,
    usage: record.usageMetadata,
  };
}

async function streamGemini(
  request: LlmRequest,
  settings: AiSettings,
  onStream: StreamingCallback,
): Promise<LLMCallResult> {
  const { system, messages } = getSystemAndMessages(request);
  const prompt = [
    system ? `System requirements:\n${system}` : "",
    ...messages.map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "User"}:\n${message.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  const stream = await requestStream(
    buildGeminiStreamEndpoint(
      settings.baseUrl,
      settings.model,
      settings.apiKey,
    ),
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
    "gemini",
    onStream,
  );

  if (!stream.content.trim()) {
    throw new Error("Gemini returned empty content or an unknown format.");
  }

  return {
    content: stream.content,
    provider: settings.provider,
    model: settings.model,
    raw: stream.raw,
    usage: stream.usage,
  };
}

export function dispatchCall(
  request: LlmRequest,
  settings: AiSettings,
): Promise<LLMCallResult> {
  const config = getProviderConfig(settings.provider);
  if (config.adapter === "anthropic") {
    return callAnthropic(request, settings);
  }
  if (config.adapter === "gemini") {
    return callGemini(request, settings);
  }
  return callOpenAICompatible(request, settings);
}

export function dispatchStream(
  request: LlmRequest,
  settings: AiSettings,
  onStream: StreamingCallback,
): Promise<LLMCallResult> {
  const config = getProviderConfig(settings.provider);
  if (config.adapter === "anthropic") {
    return streamAnthropic(request, settings, onStream);
  }
  if (config.adapter === "gemini") {
    return streamGemini(request, settings, onStream);
  }
  return streamOpenAICompatible(request, settings, onStream);
}
