import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  analyzePaperStructure,
  hybridSearchPaperChunks,
  searchPaperChunks,
  type PaperSearchResult,
} from "../../lib/analysis";
import { usePaperActions } from "./hooks/usePaperActions";
import { usePaperAi } from "./hooks/usePaperAi";
import { usePaperState } from "./hooks/usePaperState";
import { notifyPaperLoaded } from "../../plugins/pluginSystem";

export function usePaperDetailData() {
  const { paperId } = useParams();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSemanticSearchEnabled, setIsSemanticSearchEnabled] = useState(false);
  const [searchResults, setSearchResults] = useState<PaperSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(
    null,
  );

  const {
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
  } = usePaperState({
    paperId,
    searchParams,
    setHighlightedChunkId,
  });

  const {
    handleParsePdf,
    saveNote,
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
    error: actionError,
    setMessage,
    setError,
    setIsSavingNote,
    autoSaveNote,
  } = usePaperActions({
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
  });

  const {
    isCallingAi,
    aiQuestion,
    qaQuestion,
    aiGeneratedTitle,
    aiGeneratedContent,
    paperAgentWorkflow,
    metadataRaw,
    setAiQuestion,
    setQaQuestion,
    setAiGeneratedContent,
    setPaperAgentWorkflow,
    handleExtractMetadata,
    handleGenerateReadingNote,
    handleSaveAiGeneratedNote,
    handleAskWithAi,
    handleAskFollowUp,
    handleRunPaperAgentWorkflow,
    saveAiOutputAsNote,
  } = usePaperAi({
    paperId,
    paper,
    chunks,
    qaHistory,
    aiSettings,
    loadPageData,
    setMessage,
    setError,
    setIsSavingNote,
  });

  const analysis = useMemo(
    () => (chunks.length > 0 ? analyzePaperStructure(chunks) : null),
    [chunks],
  );
  const canUseSemanticSearch = Boolean(
    aiSettings?.provider &&
      aiSettings.baseUrl.trim() &&
      aiSettings.apiKey.trim() &&
      aiSettings.model.trim(),
  );

  useEffect(() => {
    let isCancelled = false;
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchProgress(null);
      setIsSearching(false);
      return;
    }

    if (!isSemanticSearchEnabled || !canUseSemanticSearch || !aiSettings) {
      setSearchResults(searchPaperChunks(chunks, query));
      setSearchProgress(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchProgress("Starting AI semantic search...");
    hybridSearchPaperChunks(chunks, query, aiSettings, (message) => {
      if (!isCancelled) setSearchProgress(message);
    })
      .then((results) => {
        if (!isCancelled) setSearchResults(results);
      })
      .catch((searchError) => {
        if (!isCancelled) {
          setSearchResults(searchPaperChunks(chunks, query));
          setSearchProgress(
            searchError instanceof Error
              ? `Semantic search failed, showing keyword results: ${searchError.message}`
              : "Semantic search failed, showing keyword results.",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) setIsSearching(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    aiSettings,
    canUseSemanticSearch,
    chunks,
    isSemanticSearchEnabled,
    searchQuery,
  ]);

  const hasChunks = chunks.length > 0;
  const error = actionError ?? loadError;

  // Notify plugins when a paper is loaded
  useEffect(() => {
    if (paper) {
      notifyPaperLoaded({
        paper,
        chunks,
        dataDir: "",
      });
    }
  }, [paper, chunks]);

  return {
    paper,
    chunks,
    notes,
    annotations,
    qaHistory,
    aiOutputs,
    aiSettings,
    editingNoteId,
    noteTitle,
    noteType,
    noteContent,
    searchQuery,
    isSemanticSearchEnabled,
    canUseSemanticSearch,
    isSearching,
    searchProgress,
    aiQuestion,
    qaQuestion,
    aiGeneratedTitle,
    aiGeneratedContent,
    paperAgentWorkflow,
    metadataRaw,
    isLoading,
    isParsing,
    isSavingNote,
    isExporting,
    isExportingWord,
    isExportingBibtex,
    isExportingRis,
    isCallingAi,
    highlightedChunkId,
    message,
    error,
    analysis,
    searchResults,
    hasChunks,
    setNoteTitle,
    setNoteType,
    setNoteContent,
    setSearchQuery,
    setIsSemanticSearchEnabled,
    setAiQuestion,
    setQaQuestion,
    setAiGeneratedContent,
    setPaperAgentWorkflow,
    handleParsePdf,
    saveNote,
    handleExportMarkdown,
    handleExportWord,
    handleExportBibtex,
    handleExportRis,
    autoSaveNote,
    handleOpenOriginalPdf,
    jumpToChunk,
    handleExtractMetadata,
    handleGenerateReadingNote,
    handleSaveAiGeneratedNote,
    handleAskWithAi,
    handleAskFollowUp,
    handleRunPaperAgentWorkflow,
    saveAiOutputAsNote,
    resetNoteEditor,
    editNote,
  };
}

export type PaperDetailData = ReturnType<typeof usePaperDetailData>;
