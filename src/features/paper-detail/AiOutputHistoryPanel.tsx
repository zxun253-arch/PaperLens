import type { AiOutput } from "../../types/paper";
import { formatDate } from "./formatters";

const actionLabels: Record<AiOutput["action"], string> = {
  extract_metadata: "论文信息提取",
  generate_reading_note: "中文精读笔记",
  paper_qa: "论文问答",
  literature_review: "文献综述辅助",
};

interface AiOutputHistoryPanelProps {
  aiOutputs: AiOutput[];
  onSaveAsNote: (output: AiOutput) => void;
}

export function AiOutputHistoryPanel({
  aiOutputs,
  onSaveAsNote,
}: AiOutputHistoryPanelProps) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-950">AI 结果历史</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        这里保存 App 内 AI 调用的结构化结果，不包含 API Key、完整 Prompt
        或原始请求体。
      </p>
      <div className="mt-4 space-y-3">
        {aiOutputs.length === 0 ? (
          <p className="text-sm text-slate-500">还没有 AI 结果历史。</p>
        ) : (
          aiOutputs.map((output) => (
            <details
              className="rounded border border-slate-200 bg-slate-50 p-4"
              key={output.id}
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                {actionLabels[output.action]}：{output.title}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>时间：{formatDate(output.created_at)}</p>
                <p>
                  Provider：{output.provider}；模型：{output.model || "未记录"}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {output.content.length > 800
                  ? `${output.content.slice(0, 800)}...`
                  : output.content}
              </p>
              <button
                className="mt-3 rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                onClick={() => onSaveAsNote(output)}
                type="button"
              >
                保存为笔记
              </button>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
