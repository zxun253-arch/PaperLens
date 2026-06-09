import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { listAiOutputsByPaper } from "../../../lib/db/aiOutputs";
import { listPaperChunks } from "../../../lib/db/paperChunks";
import { listPaperAnnotations } from "../../../lib/db/paperAnnotations";
import { listPaperNotes } from "../../../lib/db/paperNotes";
import { listPaperQa } from "../../../lib/db/paperQa";
import { getPaperById } from "../../../lib/db/papers";
import { getCurrentAiSettings, type AiSettings } from "../../../lib/llm";
import type {
  AiOutput,
  Paper,
  PaperAnnotation,
  PaperChunk,
  PaperNote,
  PaperNoteType,
  PaperQa,
} from "../../../types/paper";

type UsePaperStateArgs = {
  paperId: string | undefined;
  searchParams: URLSearchParams;
  setHighlightedChunkId: Dispatch<SetStateAction<string | null>>;
};

export function usePaperState({
  paperId,
  searchParams,
  setHighlightedChunkId,
}: UsePaperStateArgs) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [chunks, setChunks] = useState<PaperChunk[]>([]);
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [annotations, setAnnotations] = useState<PaperAnnotation[]>([]);
  const [qaHistory, setQaHistory] = useState<PaperQa[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AiOutput[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("阅读笔记");
  const [noteType, setNoteType] = useState<PaperNoteType>("manual");
  const [noteContent, setNoteContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPageData = useCallback(async (id: string) => {
    const [
      paperResult,
      chunksResult,
      annotationsResult,
      notesResult,
      qaResult,
      aiOutputsResult,
      aiResult,
    ] = await Promise.all([
      getPaperById(id),
      listPaperChunks(id),
      listPaperAnnotations(id),
      listPaperNotes(id),
      listPaperQa(id),
      listAiOutputsByPaper(id),
      getCurrentAiSettings(),
    ]);
    setPaper(paperResult);
    setChunks(chunksResult);
    setAnnotations(annotationsResult);
    setNotes(notesResult);
    setQaHistory(qaResult);
    setAiOutputs(aiOutputsResult);
    setAiSettings(aiResult);
  }, []);

  useEffect(() => {
    if (!paperId) {
      setLoadError("论文 id 无效。");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    loadPageData(paperId)
      .catch((loadError) =>
        setLoadError(
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
  }, [chunks, searchParams, setHighlightedChunkId]);

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

  return {
    paper,
    chunks,
    notes,
    annotations,
    qaHistory,
    aiOutputs,
    aiSettings,
    isLoading,
    loadError,
    editingNoteId,
    noteTitle,
    noteType,
    noteContent,
    setNoteTitle,
    setNoteType,
    setNoteContent,
    resetNoteEditor,
    editNote,
    loadPageData,
    setPaper,
  };
}
