import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { globalSearch } from "../lib/db/globalSearch";
import {
  addPaperTag,
  deletePaperTag,
  listAllTags,
  listTagsForPapers,
} from "../lib/db/paperTags";
import { deletePaper, listPapers, updatePaper } from "../lib/db/papers";
import { importPdfAsPaper } from "../lib/pdf/importPdf";
import type {
  GlobalSearchResult,
  PaperReadingStatus,
  PaperWithTags,
} from "../types/paper";
import { formatDate } from "../utils/format";

type SortKey = "recent" | "title" | "reading_status" | "status" | "notes";

const readingStatusLabels: Record<PaperReadingStatus, string> = {
  unread: "未读",
  reading: "阅读中",
  read: "已读",
  archived: "归档",
};

function matchesKeyword(paper: PaperWithTags, keyword: string) {
  const text = [
    paper.title,
    paper.authors,
    paper.abstract,
    paper.keywords,
    paper.file_name,
    ...paper.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(keyword.toLowerCase());
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const batchImportInputRef = useRef<HTMLInputElement | null>(null);
  const [papers, setPapers] = useState<PaperWithTags[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedReadingStatus, setSelectedReadingStatus] = useState<
    PaperReadingStatus | ""
  >("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadPapers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listPapers();
      const tagMap = await listTagsForPapers(rows.map((paper) => paper.id));
      const tags = await listAllTags();
      setPapers(
        rows.map((paper) => ({
          ...paper,
          tags: tagMap[paper.id] ?? [],
        })),
      );
      setAllTags(tags);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取论文失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPapers();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!keyword.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await globalSearch(keyword.trim());
        if (!cancelled) setSearchResults(results);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    const timer = window.setTimeout(run, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  const filteredPapers = useMemo(() => {
    const rows = papers
      .filter((paper) => {
        if (!keyword.trim()) return true;
        // If global search results exist, use them instead of in-memory filter
        if (searchResults.length > 0) {
          return searchResults.some((r) => r.paper_id === paper.id);
        }
        return matchesKeyword(paper, keyword);
      })
      .filter((paper) =>
        selectedTag ? paper.tags.includes(selectedTag) : true,
      )
      .filter((paper) =>
        selectedReadingStatus
          ? paper.reading_status === selectedReadingStatus
          : true,
      )
      .filter((paper) => (favoriteOnly ? paper.is_favorite === 1 : true));

    return [...rows].sort((a, b) => {
      if (sortKey === "title") {
        return (a.title || a.file_name).localeCompare(b.title || b.file_name);
      }
      if (sortKey === "reading_status") {
        return a.reading_status.localeCompare(b.reading_status);
      }
      if (sortKey === "status") return a.status.localeCompare(b.status);
      if (sortKey === "notes") return (b.note_count ?? 0) - (a.note_count ?? 0);
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [
    favoriteOnly,
    keyword,
    papers,
    selectedReadingStatus,
    selectedTag,
    sortKey,
  ]);

  const handleImportPdf = async () => {
    setIsImporting(true);
    setBatchImportProgress(null);
    setMessage(null);
    setError(null);
    try {
      const result = await importPdfAsPaper();
      if (result.status === "cancelled") {
        setMessage("已取消导入。");
        return;
      }
      setMessage("PDF 已导入，后续可以在论文详情页解析文本。");
      showToast("PDF 导入成功", { type: "success" });
      await loadPapers();
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "导入 PDF 失败。",
      );
      showToast("导入 PDF 失败", { type: "error" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBatchImportPdf = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const pdfFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".pdf"),
    );
    const skippedCount = files.length - pdfFiles.length;

    if (skippedCount > 0) {
      setMessage(`已跳过 ${skippedCount} 个非 PDF 文件。`);
    }

    if (pdfFiles.length === 0) {
      setError("所有文件均非 PDF 格式。");
      return;
    }

    setIsImporting(true);
    setBatchImportProgress({ current: 0, total: pdfFiles.length });
    setMessage(null);
    setError(null);
    try {
      let importedCount = 0;

      for (const [index, file] of pdfFiles.entries()) {
        setBatchImportProgress({ current: index + 1, total: pdfFiles.length });
        const result = await importPdfAsPaper(file);
        if (result.status === "imported") {
          importedCount += 1;
        }
      }

      setMessage(`批量导入完成，共导入 ${importedCount} 个 PDF。`);
      showToast(`成功导入 ${importedCount} 个 PDF`, { type: "success" });
      await loadPapers();
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "批量导入 PDF 失败。",
      );
      showToast("批量导入失败", { type: "error" });
    } finally {
      setIsImporting(false);
      setBatchImportProgress(null);
    }
  };

  const handleAddTag = async (paperId: string) => {
    const tag = tagInputs[paperId]?.trim();
    if (!tag) return;
    await addPaperTag(paperId, tag);
    setTagInputs((current) => ({ ...current, [paperId]: "" }));
    await loadPapers();
  };

  const togglePaperSelection = (paperId: string) => {
    setSelectedPaperIds((current) => {
      if (current.includes(paperId)) return current.filter((id) => id !== paperId);
      if (current.length >= 5) {
        setMessage("最多选择 5 篇论文进行对比。");
        return current;
      }
      return [...current, paperId];
    });
  };

  const startCompare = () => {
    if (selectedPaperIds.length < 2) {
      setError("请至少选择 2 篇论文进行对比。");
      return;
    }
    navigate(
      `/compare?paperIds=${encodeURIComponent(selectedPaperIds.join(","))}`,
    );
  };

  const openSearchResult = (result: GlobalSearchResult) => {
    const chunkQuery =
      result.chunk_id || typeof result.chunk_index === "number"
        ? `?chunk=${encodeURIComponent(result.chunk_id ?? String(result.chunk_index))}`
        : "";
    navigate(`/papers/${result.paper_id}${chunkQuery}`);
  };

  return (
    <section>
      <PageHeader
        title="论文库"
        description="管理论文、标签、阅读状态、收藏和跨论文检索。"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
              disabled={isImporting}
              onClick={handleImportPdf}
              type="button"
            >
              {isImporting ? "导入中..." : "导入 PDF"}
            </button>
            <button
              className="rounded border border-cyan-700 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:bg-slate-900 dark:text-cyan-200 dark:hover:bg-cyan-950"
              disabled={isImporting}
              onClick={() => batchImportInputRef.current?.click()}
              type="button"
            >
              批量导入
            </button>
            <input
              accept=".pdf"
              className="hidden"
              multiple
              onChange={handleBatchImportPdf}
              ref={batchImportInputRef}
              type="file"
            />
          </div>
        }
      />

      <div className="mb-6 rounded border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
          PaperLens
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-baseline">
          <h2 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
            文献透镜
          </h2>
          <span className="text-base font-medium text-slate-500 dark:text-slate-400">
            论文辅助工作台
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          本地优先，AI 可选，帮助你管理、阅读、整理和沉淀学术论文。
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
      {batchImportProgress ? (
        <div className="mb-4 rounded border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950 dark:text-cyan-200">
          正在导入 {batchImportProgress.current}/{batchImportProgress.total}...
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <input
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
            data-library-search
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题、作者、摘要、标签、分块、笔记和问答"
            value={keyword}
          />
          {keyword ? (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={() => setKeyword("")}
              type="button"
              aria-label="清除搜索"
            >
              ×
            </button>
          ) : null}
        </div>
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) => setSelectedTag(event.target.value)}
            value={selectedTag}
          >
            <option value="">全部标签</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) =>
              setSelectedReadingStatus(
                event.target.value as PaperReadingStatus | "",
              )
            }
            value={selectedReadingStatus}
          >
            <option value="">全部阅读状态</option>
            {Object.entries(readingStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            value={sortKey}
          >
            <option value="recent">最近导入</option>
            <option value="title">标题</option>
            <option value="reading_status">阅读状态</option>
            <option value="status">解析状态</option>
            <option value="notes">笔记数量</option>
          </select>
          <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200">
            <input
              checked={favoriteOnly}
              onChange={(event) => setFavoriteOnly(event.target.checked)}
              type="checkbox"
            />
            只看收藏
          </label>
        </div>

        {keyword.trim() ? (
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                全局搜索结果
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isSearching ? "搜索中..." : `${searchResults.length} 条命中`}
              </span>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                暂无跨论文命中结果。
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {searchResults.slice(0, 12).map((result) => (
                  <button
                    className="block w-full rounded border border-slate-200 bg-white p-3 text-left text-sm transition hover:border-cyan-700 dark:border-slate-700 dark:bg-slate-800"
                    key={result.id}
                    onClick={() => openSearchResult(result)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {result.paper_title || result.file_name}
                      </span>
                      <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                        {result.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {result.snippet}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          已选择 {selectedPaperIds.length} 篇，支持选择 2-5 篇进行对比。
        </p>
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500 dark:bg-slate-700 dark:hover:bg-cyan-700"
          disabled={selectedPaperIds.length < 2}
          onClick={startCompare}
          type="button"
        >
          对比选中论文
        </button>
      </div>

      {isLoading ? (
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          正在读取论文库...
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            暂无匹配论文
          </h3>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            可以调整筛选条件，或通过导入 PDF 开始建立文献库。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPapers.map((paper) => (
            <article
              className="rounded border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              key={paper.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      aria-label="选择论文"
                      checked={selectedPaperIds.includes(paper.id)}
                      onChange={() => togglePaperSelection(paper.id)}
                      type="checkbox"
                    />
                    <h3 className="break-words text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {paper.title || paper.file_name}
                    </h3>
                    <StatusBadge status={paper.status} />
                    {paper.is_favorite === 1 ? (
                      <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                        重点
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="break-all">文件名：{paper.file_name}</span>
                    <span>导入时间：{formatDate(paper.created_at)}</span>
                    <span>
                      阅读状态：{readingStatusLabels[paper.reading_status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {paper.tags.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        暂无标签
                      </span>
                    ) : (
                      paper.tags.map((tag) => (
                        <button
                          className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-red-50 hover:text-red-700 dark:bg-slate-900 dark:text-slate-300"
                          key={tag}
                          onClick={() => {
                            if (window.confirm(`确定删除标签「${tag}」？`)) {
                              void deletePaperTag(paper.id, tag).then(loadPapers);
                            }
                          }}
                          title="点击删除标签"
                          type="button"
                        >
                          {tag} ×
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="w-full space-y-3 lg:w-64">
                  <div className="flex gap-2">
                    <select
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      onChange={(event) =>
                        void updatePaper(paper.id, {
                          reading_status: event.target
                            .value as PaperReadingStatus,
                        }).then(loadPapers)
                      }
                      value={paper.reading_status}
                    >
                      {Object.entries(readingStatusLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-amber-500 hover:text-amber-700 dark:border-slate-600 dark:text-slate-200"
                      onClick={() =>
                        void updatePaper(paper.id, {
                          is_favorite: paper.is_favorite === 1 ? 0 : 1,
                        }).then(loadPapers)
                      }
                      type="button"
                    >
                      {paper.is_favorite === 1 ? "取消收藏" : "收藏"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      onChange={(event) =>
                        setTagInputs((current) => ({
                          ...current,
                          [paper.id]: event.target.value,
                        }))
                      }
                      placeholder="新增标签"
                      value={tagInputs[paper.id] ?? ""}
                    />
                    <button
                      className="rounded border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-950"
                      onClick={() => void handleAddTag(paper.id)}
                      type="button"
                    >
                      添加
                    </button>
                  </div>
                  <Link
                    className="block rounded border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200"
                    to={`/papers/${paper.id}`}
                  >
                    查看详情
                  </Link>
                  <button
                    className="block w-full rounded border border-red-200 px-4 py-2 text-center text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                    onClick={() => {
                      if (window.confirm(`确定删除论文「${paper.title || paper.file_name}」？此操作不可撤销。`)) {
                        void deletePaper(paper.id).then(loadPapers).catch(() => {
                          showToast("删除论文失败", { type: "error" });
                        });
                      }
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
