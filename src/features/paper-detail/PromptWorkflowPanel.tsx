import type { PromptBuildResult, PromptType } from "../../lib/prompts";
import { promptTypeLabels, promptTypes } from "./formatters";

interface PromptWorkflowPanelProps {
  hasChunks: boolean;
  promptType: PromptType;
  question: string;
  promptResult: PromptBuildResult | null;
  onPromptTypeChange: (value: PromptType) => void;
  onQuestionChange: (value: string) => void;
  onBuildPrompt: () => void;
  onCopyPrompt: () => void;
}

export function PromptWorkflowPanel({
  hasChunks,
  promptType,
  question,
  promptResult,
  onPromptTypeChange,
  onQuestionChange,
  onBuildPrompt,
  onCopyPrompt,
}: PromptWorkflowPanelProps) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-base font-semibold text-slate-950">Prompt 工作流</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        生成 Prompt 后复制到外部 AI；再将外部 AI
        生成的结果粘贴到下方阅读笔记区保存。
      </p>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-sm font-medium text-slate-700">
            Prompt 类型
          </span>
          <select
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
            onChange={(event) =>
              onPromptTypeChange(event.target.value as PromptType)
            }
            value={promptType}
          >
            {promptTypes.map((type) => (
              <option key={type} value={type}>
                {promptTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
          disabled={!hasChunks}
          onClick={onBuildPrompt}
          type="button"
        >
          生成 Prompt
        </button>
      </div>
      {promptType === "paper_qa" ? (
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">用户问题</span>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="例如：这篇论文的创新点是什么？"
            type="text"
            value={question}
          />
        </label>
      ) : null}
      {!hasChunks ? (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          请先解析 PDF，生成论文分块后再使用 Prompt 工作流。
        </div>
      ) : null}

      {promptResult ? (
        <div className="mt-5 rounded border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                {promptResult.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                使用 {promptResult.usedChunkCount} /{" "}
                {promptResult.totalChunkCount} 个分块
                {promptResult.isTruncated
                  ? "，内容已按长度限制截断。"
                  : "，未截断。"}
              </p>
            </div>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
              onClick={onCopyPrompt}
              type="button"
            >
              一键复制 Prompt
            </button>
          </div>
          <textarea
            className="mt-4 h-72 w-full resize-y rounded border border-slate-300 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800 outline-none"
            readOnly
            value={promptResult.content}
          />
        </div>
      ) : null}
    </div>
  );
}
