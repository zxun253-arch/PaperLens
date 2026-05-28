import { searchPaperChunks } from "../analysis";
import { createPaperQa } from "../db/paperQa";
import { updatePaper } from "../db/papers";
import {
  buildPaperMetadataPrompt,
  buildPaperQaPrompt,
  buildReadingNotePrompt,
} from "../prompts";
import { callLLM } from "./provider";
import type { AiSettings, LLMCallResult } from "./types";
import type { Paper, PaperChunk, PaperQa } from "../../types/paper";

export interface ExtractedPaperMetadata {
  title?: string | null;
  authors?: string | null;
  year?: string | null;
  journal?: string | null;
  abstract?: string | null;
  keywords?: string | null;
  paper_type?: string | null;
  research_field?: string | null;
}

export interface PaperMetadataResult {
  metadata: ExtractedPaperMetadata | null;
  rawContent: string;
  llm: LLMCallResult;
}

function ensureChunks(chunks: PaperChunk[]) {
  if (chunks.length === 0) {
    throw new Error("请先解析 PDF，生成论文分块后再使用 App 内 AI 功能。");
  }
}

function buildMessages(userPrompt: string) {
  return [
    {
      role: "system" as const,
      content:
        "你是严谨的科研论文阅读助手。必须忠实原文，不编造；找不到依据时明确说明“原文未明确说明”。使用中文回答。",
    },
    { role: "user" as const, content: userPrompt },
  ];
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMetadata(raw: Record<string, unknown> | null): ExtractedPaperMetadata | null {
  if (!raw) return null;
  return {
    title: asText(raw.title),
    authors: Array.isArray(raw.authors)
      ? raw.authors.filter((item) => typeof item === "string").join(", ")
      : asText(raw.authors),
    year: asText(raw.year),
    journal: asText(raw.journal) ?? asText(raw.venue),
    abstract: asText(raw.abstract),
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.filter((item) => typeof item === "string").join(", ")
      : asText(raw.keywords),
    paper_type: asText(raw.paper_type),
    research_field: asText(raw.research_field),
  };
}

function removeUnclear(value: string | null | undefined) {
  if (!value) return undefined;
  return value === "原文未明确说明" ? undefined : value;
}

export async function extractPaperMetadataWithAI(
  paper: Paper,
  chunks: PaperChunk[],
  settings?: AiSettings,
): Promise<PaperMetadataResult> {
  ensureChunks(chunks);
  const basePrompt = buildPaperMetadataPrompt({ chunks, maxCharacters: 14000 });
  const prompt = `${basePrompt.content}

请优先输出一个 JSON 对象，字段如下：
{
  "title": "",
  "authors": "",
  "year": "",
  "journal": "",
  "abstract": "",
  "keywords": "",
  "research_field": "",
  "paper_type": ""
}

找不到的信息请填“原文未明确说明”。JSON 之后可以补充简短依据说明。`;

  const llm = await callLLM(
    {
      messages: buildMessages(prompt),
      temperature: 0.1,
      maxTokens: 2500,
    },
    settings,
  );
  const metadata = normalizeMetadata(extractJsonObject(llm.content));

  if (metadata) {
    await updatePaper(paper.id, {
      title: removeUnclear(metadata.title) ?? paper.title,
      authors: removeUnclear(metadata.authors) ?? paper.authors,
      year: removeUnclear(metadata.year) ?? paper.year,
      journal: removeUnclear(metadata.journal) ?? paper.journal,
      abstract: removeUnclear(metadata.abstract) ?? paper.abstract,
      keywords: removeUnclear(metadata.keywords) ?? paper.keywords,
      paper_type: removeUnclear(metadata.paper_type) ?? paper.paper_type,
      research_field: removeUnclear(metadata.research_field) ?? paper.research_field,
    });
  }

  return {
    metadata,
    rawContent: llm.content,
    llm,
  };
}

export async function generateReadingNoteWithAI(
  chunks: PaperChunk[],
  settings?: AiSettings,
) {
  ensureChunks(chunks);
  const prompt = buildReadingNotePrompt({ chunks, maxCharacters: 16000 });
  return callLLM(
    {
      messages: buildMessages(prompt.content),
      temperature: 0.2,
      maxTokens: 5000,
    },
    settings,
  );
}

function selectQaContext(chunks: PaperChunk[], question: string) {
  const searchResults = searchPaperChunks(chunks, question);
  if (searchResults.length > 0) {
    return searchResults.slice(0, 6).map((result) => result.chunk);
  }
  return chunks.slice(0, 8);
}

export async function answerQuestionWithAI(
  paperId: string,
  chunks: PaperChunk[],
  question: string,
  settings?: AiSettings,
): Promise<{ llm: LLMCallResult; qa: PaperQa }> {
  ensureChunks(chunks);
  if (!question.trim()) {
    throw new Error("请输入论文问题。");
  }

  const contextChunks = selectQaContext(chunks, question);
  const prompt = buildPaperQaPrompt({
    chunks: contextChunks,
    question,
    maxCharacters: 10000,
  });
  const llm = await callLLM(
    {
      messages: buildMessages(prompt.content),
      temperature: 0.2,
      maxTokens: 2500,
    },
    settings,
  );
  const evidence = contextChunks
    .map((chunk) => `chunk ${chunk.chunk_index + 1}${chunk.section_title ? ` / ${chunk.section_title}` : ""}`)
    .join("; ");
  const qa = await createPaperQa({
    paper_id: paperId,
    question,
    answer: llm.content,
    evidence,
  });

  return { llm, qa };
}
