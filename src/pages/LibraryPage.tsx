import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { listPapers } from "../lib/db/papers";
import { importPdfAsPaper } from "../lib/pdf/importPdf";
import type { Paper } from "../types/paper";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPapers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setPapers(await listPapers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取论文失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPapers();
  }, []);

  const handleImportPdf = async () => {
    setIsImporting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await importPdfAsPaper();

      if (result.status === "cancelled") {
        setMessage("已取消导入。");
        return;
      }

      setMessage("PDF 已导入，后续可以在论文详情页解析文本。");
      await loadPapers();
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "导入 PDF 失败。",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="论文库"
        description="管理已导入的论文，查看解析状态、阅读记录和笔记内容。"
        action={
          <button
            className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
            type="button"
            onClick={handleImportPdf}
            disabled={isImporting}
          >
            {isImporting ? "导入中..." : "导入 PDF"}
          </button>
        }
      />

      <div className="mb-6 rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
          PaperLens
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-baseline">
          <h2 className="text-3xl font-semibold text-slate-950">文献透镜</h2>
          <span className="text-base font-medium text-slate-500">
            论文辅助工作台
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          本地优先，AI 可选，帮助你管理、阅读、整理和沉淀学术论文。
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
          正在读取论文库...
        </div>
      ) : papers.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900">论文库为空</h3>
          <p className="mt-3 text-sm text-slate-500">
            还没有导入论文。可以通过“导入 PDF”开始阅读。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {papers.map((paper) => (
            <article
              className="rounded border border-slate-200 bg-white p-5 shadow-sm"
              key={paper.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="break-words text-lg font-semibold text-slate-950">
                      {paper.title || paper.file_name}
                    </h3>
                    <StatusBadge status={paper.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                    <span className="break-all">文件名：{paper.file_name}</span>
                    <span>导入时间：{formatDate(paper.created_at)}</span>
                  </div>
                </div>
                <Link
                  className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                  to={`/papers/${paper.id}`}
                >
                  查看详情
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
