import type { PaperQa } from "../../types/paper";
import { parseQaEvidence } from "./evidence";
import { formatDate } from "./formatters";

interface QaPanelProps {
  qaHistory: PaperQa[];
  onJumpToChunk: (chunkIndex: number, chunkId?: string) => void;
}

export function QaPanel({ qaHistory, onJumpToChunk }: QaPanelProps) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-950">论文问答记录</h3>
      <div className="mt-4 space-y-3">
        {qaHistory.length === 0 ? (
          <p className="text-sm text-slate-500">还没有论文问答记录。</p>
        ) : (
          qaHistory.map((qa) => {
            const evidence = parseQaEvidence(qa.evidence);
            return (
              <div
                className="rounded border border-slate-200 bg-slate-50 p-4"
                key={qa.id}
              >
                <p className="text-sm font-semibold text-slate-900">
                  问：{qa.question}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {qa.answer}
                </p>
                {evidence.items.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">
                      依据分块：
                    </p>
                    {evidence.items.map((item) => (
                      <div
                        className="rounded border border-slate-200 bg-white p-3"
                        key={`${qa.id}-${item.chunk_id ?? item.chunk_index}`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs font-semibold text-slate-700">
                            Chunk {item.chunk_index + 1}
                            {item.section_title
                              ? ` / ${item.section_title}`
                              : ""}
                          </span>
                          <button
                            className="rounded border border-cyan-200 px-2 py-1 text-xs font-medium text-cyan-700 hover:border-cyan-700"
                            onClick={() =>
                              onJumpToChunk(item.chunk_index, item.chunk_id)
                            }
                            type="button"
                          >
                            跳转到该 chunk
                          </button>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {item.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {evidence.legacyText ? (
                  <p className="mt-2 text-xs text-slate-500">
                    依据：{evidence.legacyText}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-slate-400">
                  {formatDate(qa.created_at)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
