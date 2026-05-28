import type { PaperChunk } from "../../types/paper";

export interface PaperAnalysisStats {
  totalCharacters: number;
  totalChunks: number;
  detectedSectionCount: number;
  hasAbstract: boolean;
  hasIntroduction: boolean;
  hasMethods: boolean;
  hasResults: boolean;
  hasConclusion: boolean;
  hasReferences: boolean;
  structureMayBeIncomplete: boolean;
}

export interface PaperSectionOverview {
  title: string;
  chunkIndexes: number[];
}

export interface PaperKeyword {
  text: string;
  count: number;
  score: number;
}

export interface PaperKeySentence {
  text: string;
  score: number;
  chunkIndex: number;
  sectionTitle: string | null;
}

export interface PaperSearchResult {
  chunk: PaperChunk;
  score: number;
  matchCount: number;
  snippet: string;
}

export interface PaperAnalysisResult {
  stats: PaperAnalysisStats;
  sections: PaperSectionOverview[];
  keywords: PaperKeyword[];
  keySentences: PaperKeySentence[];
}
