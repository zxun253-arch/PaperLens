import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../components/Toast";
import { formatDate } from "../utils/format";
import { clearLlmCallLogs, listRecentLlmCallLogs } from "../lib/db/llmCallLogs";
import { getDatabase } from "../lib/db/database";
import { setSetting } from "../lib/db/settings";
import { storeApiKey } from "../lib/keychain";
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
import type { AiConnectionTestResult, AiMode, LLMProvider } from "../lib/llm";
import type { LlmCallLog, LlmErrorType } from "../types/paper";

const aiModeOptions: AiMode[] = [
  "local_basic",
  "prompt_only",
  "custom_api",
  "local_model",
];

const errorTypeLabels: Record<LlmErrorType, string> = {
  missing_config: "配置缺失",
  unsupported_provider: "服务商暂未支持",
  network_error: "网络错误",
  auth_error: "鉴权失败",
  endpoint_error: "接口地址错误",
  model_error: "模型名称错误",
  rate_limit: "请求被限流",
  quota_error: "额度不足",
  response_format_error: "返回格式异常",
  timeout: "请求超时",
  unknown_error: "未知错误",
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("openai_compatible");
  const [mode, setMode] = useState<AiMode>("local_basic");
  const [logs, setLogs] = useState<LlmCallLog[]>([]);
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(
    null,
  );
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCustomApi = mode === "custom_api";
  const providerConfig = useMemo(() => getProviderConfig(provider), [provider]);

  const refreshLogs = async () => {
    setLogs(await listRecentLlmCallLogs(10));
  };

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
        setError(
          loadError instanceof Error ? loadError.message : "读取设置失败。",
        );
      });
    refreshLogs().catch(() => {});
  }, []);

  const saveSettings = async (nextApiKey = apiKey) => {
    // Store in keychain first; only clear DB if keychain succeeds
    await storeApiKey(provider, nextApiKey).catch((err) => {
      console.error("Keychain write failed:", err);
    });
    await Promise.all([
      setSetting(AI_MODE_STORAGE_KEY, mode),
      setSetting(LLM_PROVIDER_STORAGE_KEY, provider),
      setSetting(LLM_BASE_URL_STORAGE_KEY, baseUrl),
      // API Key stored in OS keychain only; DB key cleared after migration
      setSetting(LLM_API_KEY_STORAGE_KEY, ""),
      setSetting(LLM_MODEL_STORAGE_KEY, model),
    ]);
  };

  const handleProviderChange = (nextProvider: LLMProvider) => {
    const config = getProviderConfig(nextProvider);
    setProvider(nextProvider);
    setApiKey(""); // Clear API key when switching provider to prevent cross-provider leakage
    if (config.defaultBaseUrl) setBaseUrl(config.defaultBaseUrl);
    if (config.defaultModel) setModel(config.defaultModel);
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    try {
      await saveSettings();
      setMessage("设置已保存到本地数据库。");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "保存设置失败。请稍后重试。",
      );
    }
  };

  const handleClearApiKey = async () => {
    setMessage(null);
    setError(null);
    try {
      setApiKey("");
      await saveSettings("");
      setMessage("API Key 已清除。");
    } catch {
      setError("清除 API Key 失败。请稍后重试。");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);
    setError(null);
    setTestResult(null);
    try {
      await saveSettings();
      const result = await testAiConnection();
      setTestResult(result);
      await refreshLogs();
      if (result.ok) {
        setMessage(result.message);
        showToast("连接测试成功", { type: "success" });
      } else {
        setError(result.message);
        showToast("连接测试失败", { type: "error" });
      }
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "测试连接失败。请检查 Provider、Base URL、API Key 和 Model Name。",
      );
      showToast("连接测试失败", { type: "error" });
      await refreshLogs().catch(() => {});
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearLogs = async () => {
    await clearLlmCallLogs();
    setLogs([]);
    setMessage("调用诊断日志已清空。");
  };

  const handleClearAllData = async () => {
    if (!window.confirm("确定清除所有数据？\n\n将删除所有论文记录、笔记、问答历史、AI 结果、设置和日志。此操作不可撤销！")) {
      return;
    }
    try {
      const db = await getDatabase();
      await db.execute("PRAGMA foreign_keys = OFF;");
      const allowedTables = ["paper_tags", "paper_qa", "paper_chunks", "paper_notes", "ai_outputs", "literature_reviews", "llm_call_logs", "paper_annotations", "papers", "app_settings"];
      for (const table of allowedTables) {
        await db.execute(`DELETE FROM ${table};`);
      }
      // Drop and recreate FTS5 index to prevent stale data
      await db.execute("DROP TABLE IF EXISTS paper_chunks_fts");
      await db.execute("PRAGMA foreign_keys = ON;");
      showToast("所有数据已清除。应用将重新初始化。", { type: "success" });
      setMessage("所有数据已清除。请刷新页面或重新打开应用。");
    } catch (clearError) {
      showToast("清除数据失败", { type: "error" });
      setError(clearError instanceof Error ? clearError.message : "清除数据失败。");
    }
  };

  return (
    <section>
      <PageHeader
        title="设置"
        description="配置本地优先的处理模式和可选大模型 API。非 custom_api 模式不会自动调用模型。"
      />

      <div className="max-w-5xl space-y-6">
        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              主题设置
            </h2>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
              onClick={toggleTheme}
              type="button"
            >
              {theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            </button>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">处理模式</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            文献透镜默认本地优先。只有选择"自定义大模型 API
            模式"并填写自己的配置后， App 才会在本机向对应服务商发起模型请求。
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {aiModeOptions.map((option) => (
              <label
                className={[
                  "flex cursor-pointer items-start gap-3 rounded border p-4 transition",
                  mode === option
                    ? "border-cyan-700 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/50"
                    : "border-slate-200 hover:border-cyan-700 dark:border-slate-700 dark:hover:border-cyan-500",
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
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {aiModeLabels[option]}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {aiModeDescriptions[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
            Provider 配置
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            OpenAI-compatible 适合兼容 Chat Completions
            的服务。DeepSeek、Qwen、OpenRouter、 Moonshot、智谱 GLM
            通常可复用该格式，但 Base URL 和模型名请以服务商控制台为准。 Claude
            / Anthropic 与 Gemini / Google AI 使用独立格式。
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Provider
              </span>
              <select
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:disabled:bg-slate-900"
                disabled={!isCustomApi}
                onChange={(event) =>
                  handleProviderChange(event.target.value as LLMProvider)
                }
                value={provider}
              >
                {providerOptions.map((option) => (
                  <option key={option.provider} value={option.provider}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                {providerConfig.description}
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                API Base URL
              </span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 read-only:bg-slate-100 read-only:text-slate-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:read-only:bg-slate-900 dark:read-only:text-slate-400"
                disabled={!isCustomApi}
                readOnly={isCustomApi && !!providerConfig.defaultBaseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={
                  providerConfig.defaultBaseUrl || "https://api.example.com/v1"
                }
                type="url"
                value={baseUrl}
              />
              {isCustomApi && providerConfig.defaultBaseUrl ? (
                <span className="mt-1 block text-xs leading-5 text-emerald-600 dark:text-emerald-400">
                  ✓ 已自动填充（只读）
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                API Key
              </span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:disabled:bg-slate-900"
                disabled={!isCustomApi}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={providerConfig.apiKeyPlaceholder}
                type="password"
                value={apiKey}
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                API Key 保存在系统钥匙串中（Windows 凭据管理器 / macOS Keychain）。
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Model Name
              </span>
              {providerConfig.commonModels.length > 0 ? (
                <>
                  <select
                    className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:disabled:bg-slate-900"
                    disabled={!isCustomApi}
                    onChange={(event) => {
                      const val = event.target.value;
                      if (val === "__custom__") {
                        // keep current model value, show input
                      } else {
                        setModel(val);
                      }
                    }}
                    value={
                      providerConfig.commonModels.includes(model)
                        ? model
                        : "__custom__"
                    }
                  >
                    {providerConfig.commonModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__">✏️ 自定义模型</option>
                  </select>
                  {!providerConfig.commonModels.includes(model) ? (
                    <input
                      className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:disabled:bg-slate-900"
                      disabled={!isCustomApi}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="输入自定义模型名"
                      type="text"
                      value={model}
                    />
                  ) : null}
                </>
              ) : (
                <input
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950 dark:disabled:bg-slate-900"
                  disabled={!isCustomApi}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={providerConfig.modelPlaceholder}
                  type="text"
                  value={model}
                />
              )}
            </label>
          </div>

          {mode === "local_model" ? (
            <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              本地模型模式仍为预留能力。Ollama 常见地址为
              <code className="mx-1 rounded bg-white px-1 dark:bg-slate-900">
                http://localhost:11434
              </code>
              ；LM Studio 可通过 OpenAI-compatible 模式接入本地服务。
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
              onClick={() => void handleSave()}
              type="button"
            >
              保存设置
            </button>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
              disabled={!isCustomApi || isTesting}
              onClick={() => void handleTestConnection()}
              type="button"
            >
              {isTesting ? "测试中..." : "测试连接"}
            </button>
            <button
              className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
              onClick={() => void handleClearApiKey()}
              type="button"
            >
              清除 API Key
            </button>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
            Provider 状态 / 调用诊断
          </h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="当前处理模式" value={aiModeLabels[mode]} />
            <Info label="当前 Provider" value={providerConfig.label} />
            <Info label="当前 Base URL" value={baseUrl || "未填写"} />
            <Info label="当前 Model Name" value={model || "未填写"} />
            <Info
              label="API Key"
              value={apiKey ? maskApiKey(apiKey) : "未填写"}
            />
            <Info label="Adapter 类型" value={providerConfig.adapter} />
            <Info
              label="基础调用"
              value={
                providerConfig.adapter === "placeholder"
                  ? "暂未完整实现"
                  : "已实现"
              }
            />
            <Info label="真实 Key 验证" value="需要用户手动验证" />
          </div>

          {testResult ? (
            <div
              className={[
                "mt-5 rounded border px-4 py-3 text-sm leading-6",
                testResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
              ].join(" ")}
            >
              <p className="font-semibold">最近一次测试连接</p>
              <p>测试时间：{formatDate(testResult.testedAt)}</p>
              <p>Provider：{testResult.provider}</p>
              <p>Model：{testResult.model || "未填写"}</p>
              <p>Adapter：{testResult.adapter}</p>
              <p>请求是否发出：{testResult.requestSent ? "是" : "否"}</p>
              <p>返回是否成功：{testResult.responseOk ? "是" : "否"}</p>
              {testResult.errorType ? (
                <p>错误类型：{errorTypeLabels[testResult.errorType]}</p>
              ) : null}
              <p>结果摘要：{testResult.message}</p>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              最近诊断日志
            </h3>
            <button
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              onClick={() => void handleClearLogs()}
              type="button"
            >
              清空诊断日志
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="mt-3 rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-400">
              暂无诊断日志。测试连接或使用 App 内 AI
              功能后，这里会显示脱敏摘要。
            </p>
          ) : (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {logs.map((log) => (
                <div
                  className="rounded border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  key={log.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      {log.action} /{" "}
                      {log.status === "success" ? "成功" : "失败"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {log.provider} / {log.adapter} / {log.model || "未记录"}
                  </p>
                  {log.error_type ? (
                    <p className="mt-1 text-red-700 dark:text-red-300">
                      错误类型：{errorTypeLabels[log.error_type]}
                    </p>
                  ) : null}
                  {log.message ? (
                    <p className="mt-1 break-words text-slate-600 dark:text-slate-300">
                      {log.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">危险操作</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          清除所有论文记录、笔记、问答历史、AI 结果、设置和诊断日志。此操作不可撤销。
        </p>
        <button
          className="mt-4 rounded border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
          onClick={() => void handleClearAllData()}
          type="button"
        >
          清除所有数据
        </button>
      </div>
    </section>
  );
}
