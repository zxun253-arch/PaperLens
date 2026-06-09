import { useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import type { Paper, PaperChunk } from "../../types/paper";
import { formatDate, formatFileSize } from "./formatters";
import { PdfViewer } from "./PdfViewer";

interface PaperInfoPanelProps {
  paper: Paper;
  chunks: PaperChunk[];
  hasChunks: boolean;
  isParsing: boolean;
  isExporting: boolean;
  isExportingWord: boolean;
  isExportingBibtex: boolean;
  isExportingRis: boolean;
  onParsePdf: () => void;
  onOpenOriginalPdf: () => void;
  onNewNote: () => void;
  onExportMarkdown: () => void;
  onExportWord: () => void;
  onExportBibtex: () => void;
  onExportRis: () => void;
}

export function PaperInfoPanel({
  paper,
  chunks,
  hasChunks,
  isParsing,
  isExporting,
  isExportingWord,
  isExportingBibtex,
  isExportingRis,
  onParsePdf,
  onOpenOriginalPdf,
  onNewNote,
  onExportMarkdown,
  onExportWord,
  onExportBibtex,
  onExportRis,
}: PaperInfoPanelProps) {
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  return (
    <aside className="space-y-5">
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            文件信息
          </h2>
          <StatusBadge status={paper.status} />
        </div>
        <dl className="space-y-3 text-sm">
          <Info label="文件名" value={paper.file_name} />
          <Info label="文件路径" value={paper.file_path || "未记录"} />
          <Info label="文件大小" value={formatFileSize(paper.file_size)} />
          <Info label="导入时间" value={formatDate(paper.created_at)} />
        </dl>
      </div>

      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
          操作
        </h2>
        <div className="mt-4 space-y-3">
          <button
            className="w-full rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
            disabled={isParsing}
            onClick={onParsePdf}
            type="button"
          >
            {isParsing ? "解析中..." : hasChunks ? "重新解析 PDF" : "解析 PDF"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-slate-700 dark:hover:bg-cyan-700"
            onClick={onOpenOriginalPdf}
            type="button"
          >
            打开原 PDF
          </button>
          <button
            className="w-full rounded border border-cyan-700 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:bg-slate-900 dark:text-cyan-200 dark:hover:bg-cyan-950"
            disabled={!paper.file_path}
            onClick={() => setIsPdfViewerOpen((value) => !value)}
            type="button"
          >
            {isPdfViewerOpen ? "收起原始 PDF" : "查看原始 PDF"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-slate-700 dark:hover:bg-cyan-700"
            onClick={onNewNote}
            type="button"
          >
            新建阅读笔记
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500 dark:bg-slate-700 dark:hover:bg-cyan-700"
            disabled={isExporting}
            onClick={onExportMarkdown}
            type="button"
          >
            {isExporting ? "导出中..." : "导出 Markdown"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500 dark:bg-slate-700 dark:hover:bg-cyan-700"
            disabled={isExportingWord}
            onClick={onExportWord}
            type="button"
          >
            {isExportingWord ? "导出中..." : "导出 Word"}
          </button>
          <button
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500 dark:bg-slate-700 dark:hover:bg-cyan-700"
            disabled={isExportingBibtex}
            onClick={onExportBibtex}
            type="button"
          >
            {isExportingBibtex ? "导出中..." : "导出 BibTeX"}
          </button>
          <button
            className="w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-cyan-950"
            disabled={isExportingRis}
            onClick={onExportRis}
            type="button"
          >
            {isExportingRis ? "导出中..." : "导出 RIS"}
          </button>
        </div>
      </div>

      {isPdfViewerOpen ? (
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              原始 PDF
            </h2>
            <button
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-300"
              onClick={() => setIsPdfViewerOpen(false)}
              type="button"
            >
              收起
            </button>
          </div>
          <PdfViewer filePath={paper.file_path} />
        </div>
      ) : null}

      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
          章节导航
        </h2>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {hasChunks ? (
            chunks.map((chunk) => (
              <a
                className="block rounded border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-700 dark:text-slate-300"
                href={`#chunk-${chunk.id}`}
                key={chunk.id}
              >
                {chunk.chunk_index + 1}. {chunk.section_title || "未识别章节"}
              </a>
            ))
          ) : (
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              解析 PDF 后会在这里显示章节或分块导航。
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-all text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
