import type { FormEvent } from "react";
import type { PaperQa } from "../../types/paper";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { parseQaEvidence } from "../../lib/evidence";
import { formatDate } from "./formatters";

interface QaPanelProps {
  qaHistory: PaperQa[];
  qaQuestion: string;
  isCallingAi: boolean;
  onQaQuestionChange: (value: string) => void;
  onAskFollowUp: (historyUntil?: PaperQa[]) => void;
  onJumpToChunk: (chunkIndex: number, chunkId?: string) => void;
}

export function QaPanel({
  qaHistory,
  qaQuestion,
  isCallingAi,
  onQaQuestionChange,
  onAskFollowUp,
  onJumpToChunk,
}: QaPanelProps) {
  const chronologicalHistory = [...qaHistory].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const canAsk = Boolean(qaQuestion.trim()) && !isCallingAi;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canAsk) onAskFollowUp(chronologicalHistory);
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        论文问答记录
      </h3>
      <div className="mt-4 space-y-5">
        {chronologicalHistory.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            还没有论文问答记录。
          </p>
        ) : (
          chronologicalHistory.map((qa, index) => {
            const evidence = parseQaEvidence(qa.evidence);
            const historyUntil = chronologicalHistory.slice(0, index + 1);
            return (
              <div className="space-y-3" key={qa.id}>
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded bg-cyan-700 px-4 py-3 text-sm leading-6 text-white">
                    {qa.question}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <MarkdownRenderer
                    className="prose-sm max-w-none"
                    content={qa.answer}
                  />
                  {evidence.items.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        依据分块：
                      </p>
                      {evidence.items.map((item) => (
                        <div
                          className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                          key={`${qa.id}-${item.chunk_id ?? item.chunk_index}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              Chunk {item.chunk_index + 1}
                              {item.section_title
                                ? ` / ${item.section_title}`
                                : ""}
                            </span>
                            <button
                              className="rounded border border-cyan-200 px-2 py-1 text-xs font-medium text-cyan-700 hover:border-cyan-700 dark:border-cyan-900/60 dark:text-cyan-200"
                              onClick={() =>
                                onJumpToChunk(item.chunk_index, item.chunk_id)
                              }
                              type="button"
                            >
                              跳转到该 chunk
                            </button>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {item.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {evidence.legacyText ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      依据：{evidence.legacyText}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(qa.created_at)}
                    </p>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                      disabled={!canAsk}
                      onClick={() => onAskFollowUp(historyUntil)}
                      title="使用当前输入框中的问题，并以上方对话作为上下文"
                      type="button"
                    >
                      追问
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        onSubmit={handleSubmit}
      >
        <input
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
          disabled={isCallingAi}
          onChange={(event) => onQaQuestionChange(event.target.value)}
          placeholder="输入追问，例如：这个方法和前一个问题中的基线相比如何？"
          value={qaQuestion}
        />
        <button
          className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          disabled={!canAsk}
          type="submit"
        >
          {isCallingAi ? "生成中..." : "发送追问"}
        </button>
      </form>
    </div>
  );
}
