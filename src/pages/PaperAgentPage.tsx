import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { useToast } from "../components/Toast";
import { listPapers } from "../lib/db/papers";
import { listPaperChunks } from "../lib/db/paperChunks";
import { createPaperNote } from "../lib/db/paperNotes";
import {
  getCurrentAiSettings,
  getPaperAgentWorkflowConfig,
  paperAgentWorkflowOptions,
  runPaperAgentWorkflow,
  type PaperAgentWorkflow,
  type AiSettings,
} from "../lib/llm";
import type { Paper, PaperChunk } from "../types/paper";

export function PaperAgentPage() {
  const { showToast } = useToast();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [chunks, setChunks] = useState<PaperChunk[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [workflow, setWorkflow] = useState<PaperAgentWorkflow>("paper_agent_review");
  const [isRunning, setIsRunning] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultContent, setResultContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPapers()
      .then(setPapers)
      .catch(() => showToast("读取论文列表失败", { type: "error" }));
    getCurrentAiSettings()
      .then(setSettings)
      .catch(() => {});
  }, [showToast]);

  useEffect(() => {
    if (!selectedPaperId) {
      setChunks([]);
      return;
    }
    listPaperChunks(selectedPaperId)
      .then(setChunks)
      .catch(() => setChunks([]));
  }, [selectedPaperId]);

  const selectedPaper = papers.find((p) => p.id === selectedPaperId);
  const hasChunks = chunks.length > 0;
  const canRun = Boolean(selectedPaperId && hasChunks && settings && !isRunning);

  const handleRun = async () => {
    if (!selectedPaper || !settings) return;
    setIsRunning(true);
    setMessage(null);
    setError(null);
    setResultContent("");
    try {
      const result = await runPaperAgentWorkflow(
        selectedPaper.id,
        chunks,
        settings,
        workflow,
      );
      const config = getPaperAgentWorkflowConfig(workflow);
      setResultTitle(`${config.label} — ${selectedPaper.title || selectedPaper.file_name}`);
      setResultContent(result.content);
      setMessage("工作流已完成。");
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "工作流执行失败。",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveAsNote = async () => {
    if (!selectedPaper || !resultContent.trim()) return;
    setIsSaving(true);
    try {
      await createPaperNote({
        paper_id: selectedPaper.id,
        title: resultTitle || "Paper Agent 结果",
        note_type: "ai_generated",
        note_content: resultContent,
      });
      showToast("结果已保存为阅读笔记", { type: "success" });
    } catch {
      showToast("保存笔记失败", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="Paper Agent 工作台"
        description="对已解析的论文运行审查、优化、引用检查等 AI 工作流。需要自定义 API 模式。"
      />

      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              选择论文
            </h3>
            <select
              className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
              onChange={(e) => setSelectedPaperId(e.target.value)}
              value={selectedPaperId}
            >
              <option value="">-- 请选择论文 --</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.file_name}
                </option>
              ))}
            </select>
            {selectedPaperId && !hasChunks ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                该论文尚未解析，请先在论文详情页解析 PDF。
              </p>
            ) : null}
          </div>

          <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              工作流
            </h3>
            <select
              className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
              onChange={(e) => setWorkflow(e.target.value as PaperAgentWorkflow)}
              value={workflow}
            >
              {paperAgentWorkflowOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {getPaperAgentWorkflowConfig(workflow).description}
            </p>

            {settings?.mode !== "custom_api" ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                ⚠️ 当前模式非 custom_api，请在设置页切换并配置 Provider。
              </p>
            ) : null}

            <button
              className="mt-4 w-full rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
              disabled={!canRun}
              onClick={() => void handleRun()}
              type="button"
            >
              {isRunning ? "运行中..." : "运行工作流"}
            </button>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            结果
          </h3>
          {resultContent ? (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-semibold text-cyan-800 dark:text-cyan-200">
                {resultTitle}
              </h4>
              <MarkdownRenderer
                className="rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
                content={resultContent}
              />
              <div className="flex gap-3">
                <button
                  className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
                  disabled={isSaving}
                  onClick={() => void handleSaveAsNote()}
                  type="button"
                >
                  {isSaving ? "保存中..." : "保存为笔记"}
                </button>
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200"
                  onClick={() => void navigator.clipboard.writeText(resultContent)}
                  type="button"
                >
                  复制
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              选择论文和工作流后，点击"运行工作流"查看结果。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
