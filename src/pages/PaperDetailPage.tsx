import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { analyzePaperStructure, searchPaperChunks } from "../lib/analysis";
import { listPaperChunks, replacePaperChunks } from "../lib/db/paperChunks";
import {
  createPaperNote,
  listPaperNotes,
  updatePaperNote,
} from "../lib/db/paperNotes";
import { listPaperQa } from "../lib/db/paperQa";
import { getPaperById, updatePaper } from "../lib/db/papers";
import { exportPaperToMarkdown } from "../lib/export/markdown";
import {
  aiModeLabels,
  answerQuestionWithAI,
  extractPaperMetadataWithAI,
  generateReadingNoteWithAI,
  getCurrentAiSettings,
  getProviderConfig,
} from "../lib/llm";
import type { AiSettings } from "../lib/llm";
import { parsePdfText, splitPaperTextIntoChunks } from "../lib/pdf/parsePdf";
import {
  buildLiteratureReviewPrompt,
  buildPaperMetadataPrompt,
  buildPaperQaPrompt,
  buildReadingNotePrompt,
} from "../lib/prompts";
import type { PromptBuildResult, PromptType } from "../lib/prompts";
import type {
  Paper,
  PaperChunk,
  PaperNote,
  PaperNoteType,
  PaperQa,
} from "../types/paper";

const promptTypeLabels: Record<PromptType, string> = {
  paper_metadata: "论文信息提取",
  reading_note: "中文精读笔记",
  paper_qa: "论文问答",
  literature_review: "文献综述辅助",
};

const noteTypeLabels: Record<PaperNoteType, string> = {
  manual: "手动笔记",
  ai_paste: "外部 AI 回填结果",
  ai_generated: "AI 生成结果",
};

const promptTypes: PromptType[] = [
  "paper_metadata",
  "reading_note",
  "paper_qa",
  "literature_review",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(size: number | null) {
  if (size === null) return "未记录";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function createNotePreview(content: string) {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function getModeMessage(settings: AiSettings | null) {
  if (!settings) return "正在读取处理模式...";
  if (settings.mode === "local_basic") {
    return "当前为本地基础模式，可使用本地分析、Prompt、笔记和导出功能，不会调用模型。";
  }
  if (settings.mode === "prompt_only") {
    return "当前为 Prompt 辅助模式，可复制 Prompt 到外部 AI 工具使用。";
  }
  if (settings.mode === "custom_api") {
    return "当前为自定义大模型 API 模式，可在 App 内调用你配置的模型。";
  }
  return "本地模型模式后续支持 Ollama / LM Studio。";
}

export function PaperDetailPage() {
  const { paperId } = useParams();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [chunks, setChunks] = useState<PaperChunk[]>([]);
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [qaHistory, setQaHistory] = useState<PaperQa[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [promptType, setPromptType] = useState<PromptType>("reading_note");
  const [question, setQuestion] = useState("这篇论文解决了什么问题？");
  const [promptResult, setPromptResult] = useState<PromptBuildResult | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("阅读笔记");
  const [noteType, setNoteType] = useState<PaperNoteType>("manual");
  const [noteContent, setNoteContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuestion, setAiQuestion] = useState("这篇论文的创新点是什么？");
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState("AI 生成精读笔记");
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");
  const [metadataRaw, setMetadataRaw] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCallingAi, setIsCallingAi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(
    () => (chunks.length > 0 ? analyzePaperStructure(chunks) : null),
    [chunks],
  );
  const searchResults = useMemo(
    () => searchPaperChunks(chunks, searchQuery),
    [chunks, searchQuery],
  );
  const providerLabel = aiSettings
    ? getProviderConfig(aiSettings.provider).label
    : "未读取";
  const hasChunks = chunks.length > 0;
  const canUseCustomApi = aiSettings?.mode === "custom_api";

  const loadPageData = async (id: string) => {
    const [paperResult, chunksResult, notesResult, qaResult, aiResult] =
      await Promise.all([
        getPaperById(id),
        listPaperChunks(id),
        listPaperNotes(id),
        listPaperQa(id),
        getCurrentAiSettings(),
      ]);
    setPaper(paperResult);
    setChunks(chunksResult);
    setNotes(notesResult);
    setQaHistory(qaResult);
    setAiSettings(aiResult);
  };

  useEffect(() => {
    if (!paperId) {
      setError("论文 id 无效。");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    loadPageData(paperId)
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "读取论文详情失败。",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [paperId]);

  const resetNoteEditor = () => {
    setEditingNoteId(null);
    setNoteTitle("阅读笔记");
    setNoteType("manual");
    setNoteContent("");
  };

  const editNote = (note: PaperNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteType(note.note_type);
    setNoteContent(note.note_content);
  };

  const ensureAiReady = () => {
    if (!aiSettings || aiSettings.mode !== "custom_api") {
      throw new Error("请先在设置页切换到自定义大模型 API 模式。");
    }
    if (!hasChunks) {
      throw new Error("请先解析 PDF，生成论文分块后再使用 App 内 AI 功能。");
    }
    return aiSettings;
  };

  const handleParsePdf = async () => {
    if (!paperId || !paper) {
      setError("论文记录无效，无法解析。");
      return;
    }
    if (!paper.file_path) {
      setError("该论文没有保存文件路径，无法解析 PDF。");
      return;
    }

    setIsParsing(true);
    setPromptResult(null);
    setMessage("正在解析 PDF，请稍候...");
    setError(null);

    try {
      await updatePaper(paper.id, { status: "parsing" });
      setPaper({ ...paper, status: "parsing" });
      const text = await parsePdfText(paper.file_path);
      const nextChunks = splitPaperTextIntoChunks(text);
      if (nextChunks.length === 0) throw new Error("未能生成有效论文分块。");
      await replacePaperChunks(paper.id, nextChunks);
      await loadPageData(paper.id);
      setMessage(`解析成功，已生成 ${nextChunks.length} 个文本分块。`);
    } catch (parseError) {
      await updatePaper(paper.id, { status: "parse_failed" }).catch(() => {});
      await loadPageData(paper.id).catch(() => {});
      setError(parseError instanceof Error ? parseError.message : "PDF 解析失败。");
      setMessage(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleBuildPrompt = () => {
    setError(null);
    setMessage(null);
    try {
      if (!hasChunks) {
        throw new Error("请先解析 PDF，生成论文分块后再使用 Prompt 工作流。");
      }
      if (promptType === "paper_qa" && !question.trim()) {
        throw new Error("请先输入论文问答问题。");
      }

      const input = { chunks };
      const result =
        promptType === "paper_metadata"
          ? buildPaperMetadataPrompt(input)
          : promptType === "reading_note"
            ? buildReadingNotePrompt(input)
            : promptType === "paper_qa"
              ? buildPaperQaPrompt({ chunks, question })
              : buildLiteratureReviewPrompt(input);
      setPromptResult(result);
      setMessage("Prompt 已生成。你可以复制到外部 AI，并将结果粘贴回阅读笔记区保存。");
    } catch (buildError) {
      setPromptResult(null);
      setError(buildError instanceof Error ? buildError.message : "Prompt 生成失败。");
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptResult) {
      setError("请先生成 Prompt。");
      return;
    }
    try {
      await navigator.clipboard.writeText(promptResult.content);
      setMessage("Prompt 已复制到剪贴板。");
      setError(null);
    } catch {
      setError("复制失败，请手动选中 Prompt 内容后复制。");
    }
  };

  const saveNote = async () => {
    if (!paper) return;
    if (!noteContent.trim()) {
      setError("请输入笔记内容。");
      return;
    }
    setIsSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      if (editingNoteId) {
        await updatePaperNote(editingNoteId, {
          title: noteTitle,
          note_type: noteType,
          note_content: noteContent,
        });
        setMessage("阅读笔记已更新。");
      } else {
        await createPaperNote({
          paper_id: paper.id,
          title: noteTitle,
          note_type: noteType,
          note_content: noteContent,
        });
        setMessage("阅读笔记已保存。");
      }
      await loadPageData(paper.id);
      resetNoteEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存阅读笔记失败。");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!paper) return;
    setIsExporting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await exportPaperToMarkdown(paper.id);
      setMessage(result.status === "cancelled" ? "已取消导出。" : `Markdown 已导出：${result.filePath}`);
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "导出 Markdown 失败。",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExtractMetadata = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await extractPaperMetadataWithAI(paper, chunks, settings);
      setMetadataRaw(result.rawContent);
      await loadPageData(paper.id);
      setMessage(result.metadata ? "论文基础信息已提取并写入论文记录。" : "模型返回内容未能解析为结构化信息，已保留原始结果。");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "论文信息提取失败。");
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleGenerateReadingNote = async () => {
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await generateReadingNoteWithAI(chunks, settings);
      setAiGeneratedTitle("AI 生成精读笔记");
      setAiGeneratedContent(result.content);
      setMessage("精读笔记已生成，请核对后再保存为阅读笔记。");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "生成精读笔记失败。");
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleSaveAiGeneratedNote = async () => {
    if (!paper || !aiGeneratedContent.trim()) return;
    setIsSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      await createPaperNote({
        paper_id: paper.id,
        title: aiGeneratedTitle,
        note_type: "ai_generated",
        note_content: aiGeneratedContent,
      });
      await loadPageData(paper.id);
      setMessage("AI 生成结果已保存为阅读笔记。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存 AI 笔记失败。");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAskWithAi = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await answerQuestionWithAI(paper.id, chunks, aiQuestion, settings);
      await loadPageData(paper.id);
      setAiGeneratedTitle("AI 论文问答");
      setAiGeneratedContent(result.llm.content);
      setMessage("论文问答已完成，并保存到问答记录。");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "论文问答失败。");
    } finally {
      setIsCallingAi(false);
    }
  };

  if (isLoading) {
    return (
      <section>
        <PageHeader title="论文详情" description="正在读取论文记录..." />
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
          正在加载...
        </div>
      </section>
    );
  }

  if (!paper) {
    return (
      <section>
        <PageHeader title="论文详情" description="未找到该论文记录。" />
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">未找到该论文记录。</h2>
          <Link
            className="mt-5 inline-flex rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
            to="/library"
          >
            返回论文库
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={paper.title || paper.file_name}
        description="支持本地分析、Prompt 工作流、自定义 API 增强、阅读笔记和 Markdown 导出。"
      />
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

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
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
                <dd className="mt-1 break-all text-slate-800">{paper.file_path || "未记录"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">文件大小</dt>
                <dd className="mt-1 text-slate-800">{formatFileSize(paper.file_size)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">导入时间</dt>
                <dd className="mt-1 text-slate-800">{formatDate(paper.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">操作</h2>
            <div className="mt-4 space-y-3">
              <button
                className="w-full rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                disabled={isParsing}
                onClick={handleParsePdf}
                type="button"
              >
                {isParsing ? "解析中..." : hasChunks ? "重新解析 PDF" : "解析 PDF"}
              </button>
              <button
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
                onClick={() => setNoteContent((value) => value || "## 阅读笔记\n\n")}
                type="button"
              >
                新建阅读笔记
              </button>
              <button
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                disabled={isExporting}
                onClick={handleExportMarkdown}
                type="button"
              >
                {isExporting ? "导出中..." : "导出 Markdown"}
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

        <div className="space-y-6">
          <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">论文内容</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {hasChunks ? `已保存 ${chunks.length} 个文本分块。` : "当前尚未解析 PDF 文本。"}
                </p>
              </div>
              {!hasChunks ? (
                <button
                  className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                  disabled={isParsing}
                  onClick={handleParsePdf}
                  type="button"
                >
                  {isParsing ? "解析中..." : "解析 PDF"}
                </button>
              ) : null}
            </div>
            <div className="mt-5 max-h-[48rem] space-y-4 overflow-y-auto pr-1">
              {hasChunks ? (
                chunks.map((chunk) => (
                  <section
                    className="rounded border border-slate-200 bg-slate-50 p-5"
                    id={`chunk-${chunk.id}`}
                    key={chunk.id}
                  >
                    <h3 className="text-sm font-semibold text-slate-900">
                      {chunk.chunk_index + 1}. {chunk.section_title || "未识别章节"}
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {chunk.content}
                    </p>
                  </section>
                ))
              ) : (
                <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  点击“解析 PDF”后，文献透镜会尝试提取文本层内容。扫描版 PDF 当前不支持 OCR。
                </div>
              )}
            </div>
          </article>

          <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">本地分析</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              以下结果由本地规则和文本算法生成，仅供辅助阅读；它不是 AI 总结。
            </p>
            {!analysis ? (
              <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                请先解析 PDF，生成论文分块后再查看本地分析。
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["总字符数", analysis.stats.totalCharacters.toLocaleString()],
                    ["总分块数", String(analysis.stats.totalChunks)],
                    ["识别章节数", String(analysis.stats.detectedSectionCount)],
                    ["参考文献", yesNo(analysis.stats.hasReferences)],
                  ].map(([label, value]) => (
                    <div className="rounded border border-slate-200 bg-slate-50 p-4" key={label}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-slate-950">本地关键词</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.keywords.length === 0 ? (
                      <span className="text-sm text-slate-500">暂未提取到稳定关键词。</span>
                    ) : (
                      analysis.keywords.map((keyword) => (
                        <span
                          className="rounded border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800"
                          key={keyword.text}
                        >
                          {keyword.text} · {keyword.count}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-slate-950">本地关键句</h3>
                  <div className="mt-4 space-y-3">
                    {analysis.keySentences.length === 0 ? (
                      <p className="text-sm text-slate-500">暂未提取到稳定关键句。</p>
                    ) : (
                      analysis.keySentences.map((sentence) => (
                        <blockquote
                          className="rounded border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700"
                          key={`${sentence.chunkIndex}-${sentence.text}`}
                        >
                          <p>{sentence.text}</p>
                          <footer className="mt-2 text-xs text-slate-500">
                            chunk {sentence.chunkIndex + 1}
                            {sentence.sectionTitle ? ` · ${sentence.sectionTitle}` : ""}
                          </footer>
                        </blockquote>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-slate-950">论文内容搜索</h3>
                  <input
                    className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="输入关键词，在当前论文分块中搜索"
                    value={searchQuery}
                  />
                  <div className="mt-4 space-y-3">
                    {searchQuery.trim() && searchResults.length === 0 ? (
                      <p className="text-sm text-slate-500">没有找到匹配内容。</p>
                    ) : null}
                    {searchResults.slice(0, 8).map((result) => (
                      <a
                        className="block rounded border border-slate-200 bg-white p-3 text-sm transition hover:border-cyan-700"
                        href={`#chunk-${result.chunk.id}`}
                        key={result.chunk.id}
                      >
                        <span className="font-semibold text-slate-900">
                          chunk {result.chunk.chunk_index + 1}
                          {result.chunk.section_title ? ` · ${result.chunk.section_title}` : ""}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          命中 {result.matchCount} 次
                        </span>
                        <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">
                          {result.snippet}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">辅助面板</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{getModeMessage(aiSettings)}</p>
                {aiSettings ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Provider：{providerLabel}；模型：{aiSettings.model || "未填写"}
                  </p>
                ) : null}
              </div>
              {aiSettings ? (
                <span className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
                  {aiModeLabels[aiSettings.mode]}
                </span>
              ) : null}
            </div>

            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-950">Prompt 工作流</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                生成 Prompt 后复制到外部 AI；再将外部 AI 生成的结果粘贴到下方阅读笔记区保存。
              </p>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-700">Prompt 类型</span>
                  <select
                    className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) => setPromptType(event.target.value as PromptType)}
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
                  onClick={handleBuildPrompt}
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
                    onChange={(event) => setQuestion(event.target.value)}
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
            </div>

            {promptResult ? (
              <div className="mt-5 rounded border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{promptResult.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      使用 {promptResult.usedChunkCount} / {promptResult.totalChunkCount} 个分块
                      {promptResult.isTruncated ? "，内容已按长度限制截断。" : "，未截断。"}
                    </p>
                  </div>
                  <button
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                    onClick={handleCopyPrompt}
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

            <div className="mt-5 rounded border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-950">App 内 AI 功能</h3>
              {!canUseCustomApi ? (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  当前不是自定义大模型 API 模式，不会调用模型。需要 App 内自动提取、精读和问答时，请先到设置页配置自己的 API。
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                      disabled={isCallingAi || !hasChunks}
                      onClick={handleExtractMetadata}
                      type="button"
                    >
                      提取论文信息
                    </button>
                    <button
                      className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                      disabled={isCallingAi || !hasChunks}
                      onClick={handleGenerateReadingNote}
                      type="button"
                    >
                      生成精读笔记
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">论文问答</span>
                    <textarea
                      className="mt-2 h-20 w-full resize-y rounded border border-slate-300 bg-white p-3 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                      onChange={(event) => setAiQuestion(event.target.value)}
                      value={aiQuestion}
                    />
                  </label>
                  <button
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                    disabled={isCallingAi || !hasChunks}
                    onClick={handleAskWithAi}
                    type="button"
                  >
                    {isCallingAi ? "调用中..." : "基于论文回答"}
                  </button>
                </div>
              )}
              {metadataRaw ? (
                <textarea
                  className="mt-4 h-40 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-6 text-slate-700"
                  readOnly
                  value={metadataRaw}
                />
              ) : null}
              {aiGeneratedContent ? (
                <div className="mt-5 rounded border border-cyan-200 bg-cyan-50 p-4">
                  <h4 className="text-sm font-semibold text-cyan-950">{aiGeneratedTitle}</h4>
                  <p className="mt-2 text-xs text-cyan-800">
                    AI 生成内容请结合论文原文核对后再用于正式写作。
                  </p>
                  <textarea
                    className="mt-3 h-64 w-full resize-y rounded border border-cyan-200 bg-white p-3 text-sm leading-6 text-slate-800"
                    onChange={(event) => setAiGeneratedContent(event.target.value)}
                    value={aiGeneratedContent}
                  />
                  <button
                    className="mt-3 rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                    disabled={isSavingNote}
                    onClick={handleSaveAiGeneratedNote}
                    type="button"
                  >
                    保存为阅读笔记
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">阅读笔记</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    支持 Markdown 纯文本。外部 AI 或 App 内 AI 生成结果仅作为阅读辅助，建议结合论文原文核对。
                  </p>
                </div>
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                  onClick={resetNoteEditor}
                  type="button"
                >
                  新建笔记
                </button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      还没有阅读笔记。
                    </div>
                  ) : (
                    notes.map((note) => (
                      <button
                        className={[
                          "w-full rounded border p-3 text-left transition",
                          editingNoteId === note.id
                            ? "border-cyan-700 bg-cyan-50"
                            : "border-slate-200 bg-slate-50 hover:border-cyan-700",
                        ].join(" ")}
                        key={note.id}
                        onClick={() => editNote(note)}
                        type="button"
                      >
                        <span className="block text-sm font-semibold text-slate-900">{note.title}</span>
                        <span className="mt-1 inline-flex rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                          {noteTypeLabels[note.note_type]}
                        </span>
                        <span className="mt-2 block text-xs text-slate-500">
                          更新：{formatDate(note.updated_at)}
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-slate-600">
                          {createNotePreview(note.note_content)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">标题</span>
                      <input
                        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                        onChange={(event) => setNoteTitle(event.target.value)}
                        type="text"
                        value={noteTitle}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">笔记类型</span>
                      <select
                        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                        onChange={(event) => setNoteType(event.target.value as PaperNoteType)}
                        value={noteType}
                      >
                        <option value="manual">手动笔记</option>
                        <option value="ai_paste">外部 AI 回填结果</option>
                        <option value="ai_generated">AI 生成结果</option>
                      </select>
                    </label>
                  </div>
                  <textarea
                    className="h-72 w-full resize-y rounded border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="在这里输入手动笔记，或粘贴外部 AI / App 内 AI 生成的结果..."
                    value={noteContent}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                      disabled={isSavingNote}
                      onClick={saveNote}
                      type="button"
                    >
                      {isSavingNote ? "保存中..." : editingNoteId ? "更新笔记" : "保存笔记"}
                    </button>
                    <button
                      className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                      onClick={() => {
                        setNoteType("ai_paste");
                        setNoteTitle("外部 AI 回填结果");
                      }}
                      type="button"
                    >
                      设为外部 AI 回填
                    </button>
                    <button
                      className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800"
                      onClick={() => {
                        setNoteType("ai_generated");
                        setNoteTitle("AI 生成结果");
                      }}
                      type="button"
                    >
                      设为 AI 生成结果
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-950">论文问答记录</h3>
              <div className="mt-4 space-y-3">
                {qaHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">还没有论文问答记录。</p>
                ) : (
                  qaHistory.map((qa) => (
                    <div className="rounded border border-slate-200 bg-slate-50 p-4" key={qa.id}>
                      <p className="text-sm font-semibold text-slate-900">问：{qa.question}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{qa.answer}</p>
                      {qa.evidence ? (
                        <p className="mt-2 text-xs text-slate-500">依据：{qa.evidence}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">{formatDate(qa.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
