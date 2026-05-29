import type { PaperChunk } from "../../types/paper";

interface PaperChunkViewerProps {
  chunks: PaperChunk[];
  hasChunks: boolean;
  highlightedChunkId: string | null;
}

export function PaperChunkViewer({
  chunks,
  hasChunks,
  highlightedChunkId,
}: PaperChunkViewerProps) {
  return (
    <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">论文内容</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {hasChunks
              ? `已保存 ${chunks.length} 个文本分块。`
              : "当前论文尚未解析。请先点击左侧“解析 PDF”。"}
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-[760px] space-y-4 overflow-y-auto pr-2">
        {hasChunks ? (
          chunks.map((chunk) => (
            <section
              className={[
                "rounded border p-5 transition-colors",
                highlightedChunkId === chunk.id
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-slate-200 bg-slate-50",
              ].join(" ")}
              id={`chunk-${chunk.id}`}
              key={chunk.id}
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Chunk {chunk.chunk_index + 1}
                {chunk.section_title ? `：${chunk.section_title}` : ""}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {chunk.content}
              </p>
            </section>
          ))
        ) : (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            暂无论文分块内容。
          </div>
        )}
      </div>
    </article>
  );
}
