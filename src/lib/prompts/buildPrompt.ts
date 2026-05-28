import {
  literatureReviewPrompt,
  paperMetadataPrompt,
  paperQaPrompt,
  readingNotePrompt,
} from "../../prompts";
import type { PaperChunk } from "../../types/paper";
import type {
  PromptBuildInput,
  PromptBuildResult,
  PromptType,
  QuestionPromptBuildInput,
} from "./types";

const DEFAULT_MAX_CHARACTERS = 16000;

const prioritySectionKeywords = [
  "abstract",
  "摘要",
  "introduction",
  "引言",
  "methods",
  "methodology",
  "方法",
  "experiment",
  "experimental",
  "实验",
  "results",
  "结果",
  "discussion",
  "讨论",
  "conclusion",
  "结论",
];

const promptTitles: Record<PromptType, string> = {
  paper_metadata: "论文信息提取 Prompt",
  reading_note: "中文精读笔记 Prompt",
  paper_qa: "论文问答 Prompt",
  literature_review: "文献综述辅助 Prompt",
};

function isPriorityChunk(chunk: PaperChunk) {
  const title = (chunk.section_title ?? "").toLowerCase();
  return prioritySectionKeywords.some((keyword) => title.includes(keyword));
}

function orderChunksForPrompt(chunks: PaperChunk[]) {
  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const priorityIndexes = new Set(
    sorted.filter(isPriorityChunk).map((chunk) => chunk.chunk_index),
  );

  for (const chunk of sorted.slice(0, 4)) {
    priorityIndexes.add(chunk.chunk_index);
  }

  const priorityChunks = sorted.filter((chunk) =>
    priorityIndexes.has(chunk.chunk_index),
  );
  const remainingChunks = sorted.filter(
    (chunk) => !priorityIndexes.has(chunk.chunk_index),
  );

  return [...priorityChunks, ...remainingChunks].sort(
    (a, b) => a.chunk_index - b.chunk_index,
  );
}

export function formatChunkForPrompt(chunk: PaperChunk) {
  return [
    `--- chunk_index: ${chunk.chunk_index} ---`,
    `section_title: ${chunk.section_title || "未识别章节"}`,
    chunk.content.trim(),
  ].join("\n");
}

export function buildPaperTextFromChunks(
  chunks: PaperChunk[],
  maxCharacters = DEFAULT_MAX_CHARACTERS,
) {
  if (chunks.length === 0) {
    throw new Error("请先解析 PDF，生成论文分块后再使用 Prompt 工作流。");
  }

  const orderedChunks = orderChunksForPrompt(chunks);
  const selected: PaperChunk[] = [];
  let content = "";
  let isTruncated = false;

  for (const chunk of orderedChunks) {
    const formatted = formatChunkForPrompt(chunk);
    const nextContent = content ? `${content}\n\n${formatted}` : formatted;

    if (nextContent.length > maxCharacters) {
      isTruncated = true;
      break;
    }

    content = nextContent;
    selected.push(chunk);
  }

  if (!content && orderedChunks[0]) {
    const firstChunk = formatChunkForPrompt(orderedChunks[0]);
    content = `${firstChunk.slice(0, maxCharacters)}\n\n[该 chunk 内容因长度限制被截断]`;
    selected.push(orderedChunks[0]);
    isTruncated = true;
  }

  return {
    paperText: content,
    usedChunkCount: selected.length,
    totalChunkCount: chunks.length,
    isTruncated: isTruncated || selected.length < chunks.length,
  };
}

function buildResult(
  type: PromptType,
  content: string,
  meta: {
    usedChunkCount: number;
    totalChunkCount: number;
    isTruncated: boolean;
  },
): PromptBuildResult {
  return {
    type,
    title: promptTitles[type],
    content,
    usedChunkCount: meta.usedChunkCount,
    totalChunkCount: meta.totalChunkCount,
    isTruncated: meta.isTruncated,
    createdAt: new Date().toISOString(),
  };
}

export function buildPaperMetadataPrompt(
  input: PromptBuildInput,
): PromptBuildResult {
  const meta = buildPaperTextFromChunks(input.chunks, input.maxCharacters);
  return buildResult(
    "paper_metadata",
    paperMetadataPrompt(meta.paperText, meta.isTruncated),
    meta,
  );
}

export function buildReadingNotePrompt(
  input: PromptBuildInput,
): PromptBuildResult {
  const meta = buildPaperTextFromChunks(input.chunks, input.maxCharacters);
  return buildResult(
    "reading_note",
    readingNotePrompt(meta.paperText, meta.isTruncated),
    meta,
  );
}

export function buildPaperQaPrompt(
  input: QuestionPromptBuildInput,
): PromptBuildResult {
  const question = input.question.trim();

  if (!question) {
    throw new Error("请输入论文问题。");
  }

  const meta = buildPaperTextFromChunks(input.chunks, input.maxCharacters);
  return buildResult(
    "paper_qa",
    paperQaPrompt(meta.paperText, question, meta.isTruncated),
    meta,
  );
}

export function buildLiteratureReviewPrompt(
  input: PromptBuildInput,
): PromptBuildResult {
  const meta = buildPaperTextFromChunks(input.chunks, input.maxCharacters);
  return buildResult(
    "literature_review",
    literatureReviewPrompt(meta.paperText, meta.isTruncated),
    meta,
  );
}
