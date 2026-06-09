import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import type { AiOutput } from "../../types/paper";
import { formatDate } from "./formatters";

const actionLabels: Record<AiOutput["action"], string> = {
  extract_metadata: "论文信息提取",
  generate_reading_note: "中文精读笔记",
  paper_qa: "论文问答",
  literature_review: "文献综述辅助",
  paper_agent_review: "Paper Agent 论文主审",
  academic_rewrite: "Paper Agent 学术表达优化",
  citation_check: "Paper Agent 引用检查",
  source_verification: "Paper Agent 来源核验",
  knowledge_card: "Paper Agent 知识卡片",
};

interface AiOutputHistoryPanelProps {
  aiOutputs: AiOutput[];
  onFollowUp: (question: string) => void;
  onSaveAsNote: (output: AiOutput) => void;
}

export function AiOutputHistoryPanel({
  aiOutputs,
  onFollowUp,
  onSaveAsNote,
}: AiOutputHistoryPanelProps) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        AI 结果历史
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        这里保存 App 内 API 调用结果，不包含 API Key、完整请求体或原始 Prompt。
      </p>
      <div className="mt-4 space-y-3">
        {aiOutputs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            还没有 AI 结果历史。
          </p>
        ) : (
          aiOutputs.map((output) => (
            <details
              className="rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
              key={output.id}
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                {actionLabels[output.action]}：{output.title}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <p>时间：{formatDate(output.created_at)}</p>
                <p>
                  Provider：{output.provider}；模型：
                  {output.model || "未记录"}
                </p>
              </div>
              <MarkdownRenderer className="mt-4" content={output.content} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200"
                  onClick={() => onSaveAsNote(output)}
                  type="button"
                >
                  保存为笔记
                </button>
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200"
                  onClick={() => void navigator.clipboard.writeText(output.content)}
                  type="button"
                >
                  复制
                </button>
                <button
                  className="rounded border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50 dark:border-cyan-500 dark:text-cyan-200 dark:hover:bg-cyan-950"
                  onClick={() =>
                    onFollowUp(`请基于这次 AI 结果继续分析：${output.title}`)
                  }
                  type="button"
                >
                  追问
                </button>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
