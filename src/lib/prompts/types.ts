import type { PaperChunk } from "../../types/paper";

export type PromptType =
  | "paper_metadata"
  | "reading_note"
  | "paper_qa"
  | "literature_review";

export interface PromptBuildInput {
  chunks: PaperChunk[];
  maxCharacters?: number;
}

export interface QuestionPromptBuildInput extends PromptBuildInput {
  question: string;
}

export interface PromptBuildResult {
  type: PromptType;
  title: string;
  content: string;
  usedChunkCount: number;
  totalChunkCount: number;
  isTruncated: boolean;
  createdAt: string;
}
