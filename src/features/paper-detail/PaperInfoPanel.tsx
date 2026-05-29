import { StatusBadge } from "../../components/StatusBadge";
import type { Paper, PaperChunk } from "../../types/paper";
import { formatDate, formatFileSize } from "./formatters";

interface PaperInfoPanelProps {
  paper: Paper;
  chunks: PaperChunk[];
  hasChunks: boolean;
  isParsing: boolean;
  isExporting: boolean;
  isExportingWord: boolean;
  onParsePdf: () => void;
  onOpenOriginalPdf: () => void;
  onNewNote: () => void;
  onExportMarkdown: () => void;
  onExportWord: () => void;
}

export function PaperInfoPanel({
  paper,
  chunks,
  hasChunks,
  isParsing,
  isExporting,
  isExportingWord,
  onParsePdf,
  onOpenOriginalPdf,
  onNewNote,
  onExportMarkdown,
  onExportWord,
}: PaperInfoPanelProps) {
  return (
    <aside className="space-y-5">
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">文件信息</h2>
          <StatusBadge status={paper.status} />
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-500">文件名</dt>
            <dd className="mt-1 break-all text-slate-800">{paper.file_name}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">文件路径</dt>
            <dd className="mt-1 break-all text-slate-800">
              {paper.file_path || "未记录"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">文件大小</dt>
            <dd className="mt-1 text-slate-800">
              {formatFileSize(paper.file_size)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">导入时间</dt>
            <dd className="mt-1 text-slate-800">
              {formatDate(paper.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">操作</h2>
        <div className="mt-4 space-y-3">
          <button
            className="w-full rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
            disabled={isParsing}
            onClick={onParsePdf}
            type="button"
          >
            {isParsing ? "解析中..." : hasChunks ? "重新解析 PDF" : "解析 PDF"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
            onClick={onOpenOriginalPdf}
            type="button"
          >
            打开原 PDF
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
            onClick={onNewNote}
            type="button"
          >
            新建阅读笔记
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            disabled={isExporting}
            onClick={onExportMarkdown}
            type="button"
          >
            {isExporting ? "导出中..." : "导出 Markdown"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            disabled={isExportingWord}
            onClick={onExportWord}
            type="button"
          >
            {isExportingWord ? "导出中..." : "导出 Word"}
          </button>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">章节导航</h2>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {hasChunks ? (
            chunks.map((chunk) => (
              <a
                className="block rounded border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-cyan-700 hover:text-cyan-800"
                href={`#chunk-${chunk.id}`}
                key={chunk.id}
              >
                {chunk.chunk_index + 1}. {chunk.section_title || "未识别章节"}
              </a>
            ))
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              解析 PDF 后会在这里显示章节或分块导航。
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
