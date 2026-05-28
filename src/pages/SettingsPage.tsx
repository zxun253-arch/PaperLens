import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { setSetting } from "../lib/db/settings";
import {
  AI_MODE_STORAGE_KEY,
  LLM_API_KEY_STORAGE_KEY,
  LLM_BASE_URL_STORAGE_KEY,
  LLM_MODEL_STORAGE_KEY,
  LLM_PROVIDER_STORAGE_KEY,
  aiModeDescriptions,
  aiModeLabels,
  getCurrentAiSettings,
  getProviderConfig,
  maskApiKey,
  providerOptions,
  testAiConnection,
} from "../lib/llm";
import type { AiMode, LLMProvider } from "../lib/llm";

const aiModeOptions: AiMode[] = [
  "local_basic",
  "prompt_only",
  "custom_api",
  "local_model",
];

export function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("openai_compatible");
  const [mode, setMode] = useState<AiMode>("local_basic");
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCustomApi = mode === "custom_api";
  const providerConfig = useMemo(() => getProviderConfig(provider), [provider]);
  const modeHint = useMemo(() => aiModeDescriptions[mode], [mode]);

  useEffect(() => {
    getCurrentAiSettings()
      .then((settings) => {
        setBaseUrl(settings.baseUrl);
        setApiKey(settings.apiKey);
        setModel(settings.model);
        setMode(settings.mode);
        setProvider(settings.provider);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "读取设置失败。");
      });
  }, []);

  const saveSettings = async (nextApiKey = apiKey) => {
    await Promise.all([
      setSetting(AI_MODE_STORAGE_KEY, mode),
      setSetting("LLM_MODE", mode),
      setSetting(LLM_PROVIDER_STORAGE_KEY, provider),
      setSetting(LLM_BASE_URL_STORAGE_KEY, baseUrl),
      setSetting(LLM_API_KEY_STORAGE_KEY, nextApiKey),
      setSetting(LLM_MODEL_STORAGE_KEY, model),
    ]);
  };

  const handleProviderChange = (nextProvider: LLMProvider) => {
    const config = getProviderConfig(nextProvider);
    setProvider(nextProvider);
    if (config.defaultBaseUrl) {
      setBaseUrl(config.defaultBaseUrl);
    }
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);

    try {
      await saveSettings();
      setMessage("设置已保存到本地数据库。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存设置失败。");
    }
  };

  const handleClearApiKey = async () => {
    setMessage(null);
    setError(null);

    try {
      setApiKey("");
      await saveSettings("");
      setMessage("API Key 已清除。");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "清除 API Key 失败。");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);
    setError(null);

    try {
      await saveSettings();
      const result = await testAiConnection();
      if (result.ok) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "测试连接失败。");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="设置"
        description="配置处理模式和可选大模型 API。未配置 API 时，文献透镜仍可使用本地分析、Prompt、笔记和导出功能。"
      />

      <div className="max-w-4xl space-y-6">
        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">处理模式</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            文献透镜默认本地优先。只有选择“自定义大模型 API 模式”并填写自己的配置后，App 才会在本机发起模型请求。
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {aiModeOptions.map((option) => (
              <label
                className={[
                  "flex cursor-pointer items-start gap-3 rounded border p-4 transition",
                  mode === option
                    ? "border-cyan-700 bg-cyan-50"
                    : "border-slate-200 hover:border-cyan-700",
                ].join(" ")}
                key={option}
              >
                <input
                  checked={mode === option}
                  className="mt-1"
                  name="ai-mode"
                  onChange={() => setMode(option)}
                  type="radio"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {aiModeLabels[option]}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {aiModeDescriptions[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">模式说明</h2>
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {modeHint}
          </div>
          {mode === "local_model" ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              本地模型模式后续支持 Ollama / LM Studio。本阶段不会调用本地模型。
            </div>
          ) : null}
        </div>

        <div
          className={[
            "rounded border border-slate-200 bg-white p-6 shadow-sm",
            isCustomApi ? "" : "opacity-70",
          ].join(" ")}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                自定义大模型 API
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                API Key 当前仅保存在本机，用于个人本地版；请勿在公共电脑中保存密钥。不同服务商的 API 地址、模型名称和计费方式可能不同，请以对应服务商控制台为准。
              </p>
              {apiKey ? (
                <p className="mt-2 text-xs text-slate-500">
                  当前已保存密钥：{maskApiKey(apiKey)}
                </p>
              ) : null}
            </div>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isCustomApi || isTesting}
              onClick={handleTestConnection}
              type="button"
            >
              {isTesting ? "测试中..." : "测试连接"}
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">模型服务商</span>
              <select
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                disabled={!isCustomApi}
                onChange={(event) => handleProviderChange(event.target.value as LLMProvider)}
                value={provider}
              >
                {providerOptions.map((option) => (
                  <option key={option.provider} value={option.provider}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                {providerConfig.description}
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                API Base URL
              </span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                disabled={!isCustomApi}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={providerConfig.defaultBaseUrl || "https://api.example.com/v1"}
                type="url"
                value={baseUrl}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">API Key</span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                disabled={!isCustomApi}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={providerConfig.apiKeyPlaceholder}
                type="password"
                value={apiKey}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Model Name</span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                disabled={!isCustomApi}
                onChange={(event) => setModel(event.target.value)}
                placeholder={providerConfig.modelPlaceholder}
                type="text"
                value={model}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800"
              onClick={handleSave}
              type="button"
            >
              保存设置
            </button>
            <button
              className="rounded border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!apiKey}
              onClick={handleClearApiKey}
              type="button"
            >
              清除 API Key
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
