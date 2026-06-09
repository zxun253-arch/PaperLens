import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { replacePaperChunks } from "../../../lib/db/paperChunks";
import {
  createPaperNote,
  updatePaperNote,
} from "../../../lib/db/paperNotes";
import { updatePaper } from "../../../lib/db/papers";
import { exportPaperToMarkdown } from "../../../lib/export/markdown";
import { savePaperBibTeX } from "../../../lib/export/bibtex";
import { savePaperRis } from "../../../lib/export/ris";
import { exportPaperToWord } from "../../../lib/export/word";
import { parsePdfText, splitPaperTextIntoChunks } from "../../../lib/pdf/parsePdf";
import type {
  Paper,
  PaperChunk,
  PaperNoteType,
} from "../../../types/paper";

type UsePaperActionsArgs = {
  paperId: string | undefined;
  paper: Paper | null;
  chunks: PaperChunk[];
  editingNoteId: string | null;
  noteTitle: string;
  noteType: PaperNoteType;
  noteContent: string;
  loadPageData: (id: string) => Promise<void>;
  resetNoteEditor: () => void;
  setPaper: Dispatch<SetStateAction<Paper | null>>;
  setHighlightedChunkId: Dispatch<SetStateAction<string | null>>;
};

export function usePaperActions({
  paperId,
  paper,
  chunks,
  editingNoteId,
  noteTitle,
  noteType,
  noteContent,
  loadPageData,
  resetNoteEditor,
  setPaper,
  setHighlightedChunkId,
}: UsePaperActionsArgs) {
  const [isParsing, setIsParsing] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingBibtex, setIsExportingBibtex] = useState(false);
  const [isExportingRis, setIsExportingRis] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setMessage("正在解析 PDF，请稍候...");
    setError(null);

    try {
      await updatePaper(paper.id, { status: "parsing" });
      setPaper({ ...paper, status: "parsing" });
      const text = await parsePdfText(paper.file_path);
      const nextChunks = splitPaperTextIntoChunks(text);
      if (nextChunks.length === 0) {
        throw new Error("未能生成有效论文分块。");
      }
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

  const autoSaveNote = async (content: string) => {
    if (!paper || !editingNoteId || !content.trim()) return;
    await updatePaperNote(editingNoteId, {
      title: noteTitle,
      note_type: noteType,
      note_content: content,
    });
    await loadPageData(paper.id);
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

  const handleExportBibtex = async () => {
    if (!paper) return;
    setIsExportingBibtex(true);
    setError(null);
    setMessage(null);
    try {
      const result = await savePaperBibTeX(paper);
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `BibTeX 已导出：${result.filePath}`,
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "导出 BibTeX 失败。",
      );
    } finally {
      setIsExportingBibtex(false);
    }
  };

  const handleExportRis = async () => {
    if (!paper) return;
    setIsExportingRis(true);
    setError(null);
    setMessage(null);
    try {
      const result = await savePaperRis(paper);
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `RIS 已导出：${result.filePath}`,
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "导出 RIS 失败。",
      );
    } finally {
      setIsExportingRis(false);
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
    window.setTimeout(() => setHighlightedChunkId(null), 3500);
  };

  return {
    handleParsePdf,
    saveNote,
    autoSaveNote,
    handleExportMarkdown,
    handleExportWord,
    handleExportBibtex,
    handleExportRis,
    handleOpenOriginalPdf,
    jumpToChunk,
    isParsing,
    isSavingNote,
    isExporting,
    isExportingWord,
    isExportingBibtex,
    isExportingRis,
    message,
    error,
    setMessage,
    setError,
    setIsSavingNote,
  };
}
