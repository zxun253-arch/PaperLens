import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { openPath } from "@tauri-apps/plugin-opener";
import { analyzePaperStructure, searchPaperChunks } from "../../lib/analysis";
import { listAiOutputsByPaper } from "../../lib/db/aiOutputs";
import { listPaperChunks, replacePaperChunks } from "../../lib/db/paperChunks";
import {
  createPaperNote,
  listPaperNotes,
  updatePaperNote,
} from "../../lib/db/paperNotes";
import { listPaperQa } from "../../lib/db/paperQa";
import { getPaperById, updatePaper } from "../../lib/db/papers";
import { exportPaperToMarkdown } from "../../lib/export/markdown";
import { exportPaperToWord } from "../../lib/export/word";
import {
  answerQuestionWithAI,
  extractPaperMetadataWithAI,
  generateReadingNoteWithAI,
  getCurrentAiSettings,
} from "../../lib/llm";
import type { AiSettings } from "../../lib/llm";
import { parsePdfText, splitPaperTextIntoChunks } from "../../lib/pdf/parsePdf";
import {
  buildLiteratureReviewPrompt,
  buildPaperMetadataPrompt,
  buildPaperQaPrompt,
  buildReadingNotePrompt,
} from "../../lib/prompts";
import type { PromptBuildResult, PromptType } from "../../lib/prompts";
import type {
  Paper,
  AiOutput,
  PaperChunk,
  PaperNote,
  PaperNoteType,
  PaperQa,
} from "../../types/paper";

export function usePaperDetailData() {
  const { paperId } = useParams();
  const [searchParams] = useSearchParams();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [chunks, setChunks] = useState<PaperChunk[]>([]);
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [qaHistory, setQaHistory] = useState<PaperQa[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AiOutput[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [promptType, setPromptType] = useState<PromptType>("reading_note");
  const [question, setQuestion] = useState("这篇论文解决了什么问题？");
  const [promptResult, setPromptResult] = useState<PromptBuildResult | null>(
    null,
  );
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
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isCallingAi, setIsCallingAi] = useState(false);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(
    null,
  );
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
  const hasChunks = chunks.length > 0;
  const canUseCustomApi = aiSettings?.mode === "custom_api";

  const loadPageData = useCallback(async (id: string) => {
    const [
      paperResult,
      chunksResult,
      notesResult,
      qaResult,
      aiOutputsResult,
      aiResult,
    ] = await Promise.all([
      getPaperById(id),
      listPaperChunks(id),
      listPaperNotes(id),
      listPaperQa(id),
      listAiOutputsByPaper(id),
      getCurrentAiSettings(),
    ]);
    setPaper(paperResult);
    setChunks(chunksResult);
    setNotes(notesResult);
    setQaHistory(qaResult);
    setAiOutputs(aiOutputsResult);
    setAiSettings(aiResult);
  }, []);

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
  }, [paperId, loadPageData]);

  useEffect(() => {
    const target = searchParams.get("chunk");
    if (!target || chunks.length === 0) return;
    const chunk =
      chunks.find((item) => item.id === target) ??
      chunks.find((item) => String(item.chunk_index) === target);
    if (!chunk) return;
    window.setTimeout(() => {
      const element = document.getElementById(`chunk-${chunk.id}`);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedChunkId(chunk.id);
      window.setTimeout(() => setHighlightedChunkId(null), 2200);
    }, 250);
  }, [chunks, searchParams]);

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
      setError(
        parseError instanceof Error ? parseError.message : "PDF 解析失败。",
      );
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
      setMessage(
        "Prompt 已生成。你可以复制到外部 AI，并将结果粘贴回阅读笔记区保存。",
      );
    } catch (buildError) {
      setPromptResult(null);
      setError(
        buildError instanceof Error ? buildError.message : "Prompt 生成失败。",
      );
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
      setError(
        saveError instanceof Error ? saveError.message : "保存阅读笔记失败。",
      );
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
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `Markdown 已导出：${result.filePath}`,
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "导出 Markdown 失败。",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWord = async () => {
    if (!paper) return;
    setIsExportingWord(true);
    setError(null);
    setMessage(null);
    try {
      const result = await exportPaperToWord(paper.id);
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `Word 已导出：${result.filePath}`,
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "导出 Word 失败。",
      );
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleOpenOriginalPdf = async () => {
    if (!paper?.file_path) {
      setError("原 PDF 文件路径不可用，可能已被移动或删除。");
      return;
    }
    try {
      await openPath(paper.file_path);
      setMessage("已使用系统默认阅读器打开原 PDF。");
      setError(null);
    } catch {
      setError("打开原 PDF 失败，文件可能已被移动或删除。");
    }
  };

  const jumpToChunk = (chunkIndex: number, chunkId?: string) => {
    const chunk =
      (chunkId ? chunks.find((item) => item.id === chunkId) : undefined) ??
      chunks.find((item) => item.chunk_index === chunkIndex);
    if (!chunk) {
      setError("未找到对应的论文分块。");
      return;
    }
    const element = document.getElementById(`chunk-${chunk.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedChunkId(chunk.id);
    window.setTimeout(() => setHighlightedChunkId(null), 2200);
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
      setMessage(
        result.metadata
          ? "论文基础信息已提取并写入论文记录。"
          : "模型返回内容未能解析为结构化信息，已保留原始结果。",
      );
    } catch (aiError) {
      setError(
        aiError instanceof Error ? aiError.message : "论文信息提取失败。",
      );
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleGenerateReadingNote = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await generateReadingNoteWithAI(
        paper.id,
        chunks,
        settings,
      );
      setAiGeneratedTitle("AI 生成精读笔记");
      setAiGeneratedContent(result.content);
      await loadPageData(paper.id);
      setMessage("精读笔记已生成，请核对后再保存为阅读笔记。");
    } catch (aiError) {
      setError(
        aiError instanceof Error ? aiError.message : "生成精读笔记失败。",
      );
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
      setError(
        saveError instanceof Error ? saveError.message : "保存 AI 笔记失败。",
      );
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
      const result = await answerQuestionWithAI(
        paper.id,
        chunks,
        aiQuestion,
        settings,
      );
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

  const saveAiOutputAsNote = async (output: AiOutput) => {
    if (!paper) return;
    setIsSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      await createPaperNote({
        paper_id: paper.id,
        title: output.title || "AI 结果",
        note_type: "ai_generated",
        note_content: output.content,
      });
      await loadPageData(paper.id);
      setMessage("AI 结果已保存为阅读笔记。");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "保存 AI 结果笔记失败。",
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  return {
    paper,
    chunks,
    notes,
    qaHistory,
    aiOutputs,
    aiSettings,
    promptType,
    question,
    promptResult,
    editingNoteId,
    noteTitle,
    noteType,
    noteContent,
    searchQuery,
    aiQuestion,
    aiGeneratedTitle,
    aiGeneratedContent,
    metadataRaw,
    isLoading,
    isParsing,
    isSavingNote,
    isExporting,
    isExportingWord,
    isCallingAi,
    highlightedChunkId,
    message,
    error,
    analysis,
    searchResults,
    hasChunks,
    canUseCustomApi,
    setPromptType,
    setQuestion,
    setNoteTitle,
    setNoteType,
    setNoteContent,
    setSearchQuery,
    setAiQuestion,
    setAiGeneratedContent,
    handleParsePdf,
    handleBuildPrompt,
    handleCopyPrompt,
    saveNote,
    handleExportMarkdown,
    handleExportWord,
    handleOpenOriginalPdf,
    jumpToChunk,
    handleExtractMetadata,
    handleGenerateReadingNote,
    handleSaveAiGeneratedNote,
    handleAskWithAi,
    saveAiOutputAsNote,
    resetNoteEditor,
    editNote,
  };
}

export type PaperDetailData = ReturnType<typeof usePaperDetailData>;
