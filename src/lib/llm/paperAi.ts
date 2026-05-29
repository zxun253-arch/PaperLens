import { searchPaperChunks } from "../analysis";
import { createAiOutput } from "../db/aiOutputs";
import { createLlmCallLog } from "../db/llmCallLogs";
import { createPaperQa } from "../db/paperQa";
import { updatePaper } from "../db/papers";
import {
  buildPaperMetadataPrompt,
  buildPaperQaPrompt,
  buildReadingNotePrompt,
} from "../prompts";
import { callLLM, classifyLlmError, sanitizeLlmMessage } from "./provider";
import { getProviderConfig } from "./settings";
import type { AiSettings, LLMCallResult } from "./types";
import type {
  Paper,
  PaperChunk,
  PaperQa,
  QaEvidenceItem,
} from "../../types/paper";

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

const CORE_SECTION_PATTERN =
  /abstract|摘要|introduction|引言|method|methodology|方法|experiment|实验|result|结果|discussion|讨论|conclusion|结论/i;

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

function normalizeMetadata(
  raw: Record<string, unknown> | null,
): ExtractedPaperMetadata | null {
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

function chunkIds(chunks: PaperChunk[]) {
  return JSON.stringify(chunks.map((chunk) => chunk.id));
}

function evidenceForChunks(chunks: PaperChunk[]): QaEvidenceItem[] {
  return chunks.map((chunk) => ({
    chunk_id: chunk.id,
    chunk_index: chunk.chunk_index,
    section_title: chunk.section_title,
    snippet:
      chunk.content.replace(/\s+/g, " ").trim().slice(0, 260) ||
      "该分块没有可显示片段。",
  }));
}

async function logAiCall(
  settings: AiSettings,
  action: "extract_metadata" | "generate_reading_note" | "paper_qa",
  status: "success" | "failed",
  message: string,
  error?: unknown,
) {
  const config = getProviderConfig(settings.provider);
  await createLlmCallLog({
    provider: settings.provider,
    adapter: config.adapter,
    model: settings.model,
    base_url: settings.baseUrl,
    action,
    status,
    error_type: error ? classifyLlmError(error) : null,
    message: sanitizeLlmMessage(message, settings.apiKey),
  });
}

export async function extractPaperMetadataWithAI(
  paper: Paper,
  chunks: PaperChunk[],
  settings: AiSettings,
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

  try {
    const llm = await callLLM(
      {
        messages: buildMessages(prompt),
        temperature: 0.1,
        maxTokens: 2500,
      },
      settings,
    );
    const rawJson = extractJsonObject(llm.content);
    const metadata = normalizeMetadata(rawJson);

    if (metadata) {
      await updatePaper(paper.id, {
        title: removeUnclear(metadata.title) ?? paper.title,
        authors: removeUnclear(metadata.authors) ?? paper.authors,
        year: removeUnclear(metadata.year) ?? paper.year,
        journal: removeUnclear(metadata.journal) ?? paper.journal,
        abstract: removeUnclear(metadata.abstract) ?? paper.abstract,
        keywords: removeUnclear(metadata.keywords) ?? paper.keywords,
        paper_type: removeUnclear(metadata.paper_type) ?? paper.paper_type,
        research_field:
          removeUnclear(metadata.research_field) ?? paper.research_field,
      });
    }

    await createAiOutput({
      paper_id: paper.id,
      action: "extract_metadata",
      provider: llm.provider,
      model: llm.model,
      title: "AI 提取论文信息",
      content: llm.content,
      structured_json: rawJson ? JSON.stringify(rawJson) : null,
      source_chunk_ids: chunkIds(chunks),
      status: "success",
    });
    await logAiCall(
      settings,
      "extract_metadata",
      "success",
      "论文信息提取成功。",
    );

    return {
      metadata,
      rawContent: llm.content,
      llm,
    };
  } catch (error) {
    await logAiCall(
      settings,
      "extract_metadata",
      "failed",
      error instanceof Error ? error.message : "论文信息提取失败。",
      error,
    );
    throw error;
  }
}

export async function generateReadingNoteWithAI(
  paperId: string,
  chunks: PaperChunk[],
  settings: AiSettings,
) {
  ensureChunks(chunks);
  const prompt = buildReadingNotePrompt({ chunks, maxCharacters: 16000 });

  try {
    const llm = await callLLM(
      {
        messages: buildMessages(prompt.content),
        temperature: 0.2,
        maxTokens: 5000,
      },
      settings,
    );
    await createAiOutput({
      paper_id: paperId,
      action: "generate_reading_note",
      provider: llm.provider,
      model: llm.model,
      title: "AI 生成精读笔记",
      content: llm.content,
      structured_json: null,
      source_chunk_ids: chunkIds(chunks),
      status: "success",
    });
    await logAiCall(
      settings,
      "generate_reading_note",
      "success",
      "精读笔记生成成功。",
    );
    return llm;
  } catch (error) {
    await logAiCall(
      settings,
      "generate_reading_note",
      "failed",
      error instanceof Error ? error.message : "生成精读笔记失败。",
      error,
    );
    throw error;
  }
}

function selectQaContext(chunks: PaperChunk[], question: string) {
  const searchResults = searchPaperChunks(chunks, question);
  const selected = new Map<string, PaperChunk>();

  for (const result of searchResults) {
    selected.set(result.chunk.id, result.chunk);
    if (selected.size >= 8) break;
  }

  const coreChunks = chunks.filter((chunk) =>
    CORE_SECTION_PATTERN.test(chunk.section_title ?? ""),
  );
  for (const chunk of coreChunks) {
    if (selected.size >= 10) break;
    selected.set(chunk.id, chunk);
  }

  if (selected.size === 0) {
    for (const chunk of chunks.slice(0, 8)) {
      selected.set(chunk.id, chunk);
    }
  }

  const limited: PaperChunk[] = [];
  let total = 0;
  for (const chunk of selected.values()) {
    const nextLength = chunk.content.length;
    if (total + nextLength > 12_000 && limited.length > 0) break;
    limited.push(chunk);
    total += nextLength;
  }
  return limited;
}

export async function answerQuestionWithAI(
  paperId: string,
  chunks: PaperChunk[],
  question: string,
  settings: AiSettings,
): Promise<{ llm: LLMCallResult; qa: PaperQa }> {
  ensureChunks(chunks);
  if (!question.trim()) {
    throw new Error("请输入论文问题。");
  }

  const contextChunks = selectQaContext(chunks, question);
  const prompt = `${
    buildPaperQaPrompt({
      chunks: contextChunks,
      question,
      maxCharacters: 10000,
    }).content
  }

请在回答末尾列出依据 chunk，格式为：
依据：
- chunk 1 / Abstract：依据说明
- chunk 3 / Results：依据说明

如果给定内容中没有直接依据，请明确回答“论文内容中未找到直接依据”。`;

  try {
    const llm = await callLLM(
      {
        messages: buildMessages(prompt),
        temperature: 0.2,
        maxTokens: 2500,
      },
      settings,
    );
    const evidence = evidenceForChunks(contextChunks);
    const qa = await createPaperQa({
      paper_id: paperId,
      question,
      answer: llm.content,
      evidence: JSON.stringify(evidence),
    });
    await createAiOutput({
      paper_id: paperId,
      action: "paper_qa",
      provider: llm.provider,
      model: llm.model,
      title: `AI 论文问答：${question.slice(0, 36)}`,
      content: llm.content,
      structured_json: JSON.stringify({ question, evidence }),
      source_chunk_ids: chunkIds(contextChunks),
      status: "success",
    });
    await logAiCall(settings, "paper_qa", "success", "论文问答成功。");

    return { llm, qa };
  } catch (error) {
    await logAiCall(
      settings,
      "paper_qa",
      "failed",
      error instanceof Error ? error.message : "论文问答失败。",
      error,
    );
    throw error;
  }
}
