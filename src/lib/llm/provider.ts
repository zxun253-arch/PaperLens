import { createLlmCallLog } from "../db/llmCallLogs";
import {
  getCurrentAiSettings,
  getProviderConfig,
  providerConfigs,
} from "./settings";
import type {
  AiConnectionTestResult,
  AiSettings,
  LLMCallResult,
  LlmRequest,
  StreamingCallback,
} from "./types";
import {
  classifyLlmError,
  sanitizeErrorText,
  sanitizeLlmMessage,
} from "./errors";
import { ensureSettings } from "./request";
import { dispatchCall, dispatchStream } from "./callers";

export { sanitizeLlmMessage, classifyLlmError };

export async function callLLM(
  request: LlmRequest,
  settings?: AiSettings,
): Promise<LLMCallResult> {
  const currentSettings = settings ?? (await getCurrentAiSettings());
  if (currentSettings.mode !== "custom_api") {
    throw new Error("LLM calls are only available in Custom API mode. Please enable it in Settings.");
  }
  ensureSettings(currentSettings);

  const config = providerConfigs[currentSettings.provider];
  if (config.adapter === "placeholder") {
    throw new Error(
      "Provider is not fully implemented. Please use the OpenAI-compatible adapter.",
    );
  }

  return dispatchCall(request, currentSettings);
}

export async function streamLLM(
  request: LlmRequest,
  onStream: StreamingCallback,
  settings?: AiSettings,
): Promise<LLMCallResult> {
  const currentSettings = settings ?? (await getCurrentAiSettings());
  if (currentSettings.mode !== "custom_api") {
    throw new Error("LLM calls are only available in Custom API mode. Please enable it in Settings.");
  }
  ensureSettings(currentSettings);

  const config = providerConfigs[currentSettings.provider];
  if (config.adapter === "placeholder") {
    throw new Error(
      "Provider is not fully implemented. Please use the OpenAI-compatible adapter.",
    );
  }

  return dispatchStream(request, currentSettings, onStream);
}

export async function testAiConnection(): Promise<AiConnectionTestResult> {
  const settings = await getCurrentAiSettings();
  const config = getProviderConfig(settings.provider);
  const testedAt = new Date().toISOString();

  try {
    if (config.adapter === "placeholder") {
      throw new Error(
        "Provider is not fully implemented. Please use the OpenAI-compatible adapter.",
      );
    }

    const result = await callLLM(
      {
        messages: [
          { role: "system", content: "You are a connection test assistant." },
          { role: "user", content: "请回复 OK" },
        ],
        temperature: 0,
        maxTokens: 16,
      },
      settings,
    );

    const message = `Connection successful: ${config.label} / ${result.model}`;
    await createLlmCallLog({
      provider: settings.provider,
      adapter: config.adapter,
      model: settings.model,
      base_url: settings.baseUrl,
      action: "test_connection",
      status: "success",
      message,
    });

    return {
      ok: true,
      message,
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
        : "Connection test failed.";

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
