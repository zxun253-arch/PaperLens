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
import {
  callLLM,
  classifyLlmError,
  sanitizeLlmMessage,
  streamLLM,
} from "./provider";
import { getProviderConfig } from "./settings";
import type { AiSettings, LLMCallResult, StreamingCallback } from "./types";
import type {
  Paper,
  PaperChunk,
  PaperQa,
  PaperQaConversationTurn,
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
  /abstract|summary|introduction|method|methodology|experiment|result|discussion|conclusion/i;

function ensureChunks(chunks: PaperChunk[]) {
  if (chunks.length === 0) {
    throw new Error("Please parse the PDF before using AI paper features.");
  }
}

function buildMessages(userPrompt: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are a rigorous academic paper reading assistant. Answer in Chinese unless the user asks otherwise. Stay faithful to the provided paper text and say when the paper does not provide direct evidence.",
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
  return /not\s+specified|not\s+clear|unknown|未明确|未说明/i.test(value)
    ? undefined
    : value;
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
      "This chunk has no displayable text.",
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

function requestLLM(
  request: Parameters<typeof callLLM>[0],
  settings: AiSettings,
  onStream?: StreamingCallback,
) {
  return onStream
    ? streamLLM(request, onStream, settings)
    : callLLM(request, settings);
}

export async function extractPaperMetadataWithAI(
  paper: Paper,
  chunks: PaperChunk[],
  settings: AiSettings,
  onStream?: StreamingCallback,
): Promise<PaperMetadataResult> {
  ensureChunks(chunks);
  const basePrompt = buildPaperMetadataPrompt({ chunks, maxCharacters: 14000 });
  const prompt = `${basePrompt.content}

Return a JSON object first with these fields: title, authors, year, journal, abstract, keywords, research_field, paper_type.
Use "原文未明确说明" for missing fields. You may add brief evidence after the JSON.`;

  try {
    const llm = await requestLLM(
      {
        messages: buildMessages(prompt),
        temperature: 0.1,
        maxTokens: 2500,
      },
      settings,
      onStream,
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
      title: "AI extracted paper metadata",
      content: llm.content,
      structured_json: rawJson ? JSON.stringify(rawJson) : null,
      source_chunk_ids: chunkIds(chunks),
      status: "success",
    });
    await logAiCall(settings, "extract_metadata", "success", "Metadata extracted.");

    return { metadata, rawContent: llm.content, llm };
  } catch (error) {
    await logAiCall(
      settings,
      "extract_metadata",
      "failed",
      error instanceof Error ? error.message : "Metadata extraction failed.",
      error,
    );
    throw error;
  }
}

export async function generateReadingNoteWithAI(
  paperId: string,
  chunks: PaperChunk[],
  settings: AiSettings,
  onStream?: StreamingCallback,
) {
  ensureChunks(chunks);
  const prompt = buildReadingNotePrompt({ chunks, maxCharacters: 16000 });

  try {
    const llm = await requestLLM(
      {
        messages: buildMessages(prompt.content),
        temperature: 0.2,
        maxTokens: 5000,
      },
      settings,
      onStream,
    );
    await createAiOutput({
      paper_id: paperId,
      action: "generate_reading_note",
      provider: llm.provider,
      model: llm.model,
      title: "AI generated reading note",
      content: llm.content,
      structured_json: null,
      source_chunk_ids: chunkIds(chunks),
      status: "success",
    });
    await logAiCall(settings, "generate_reading_note", "success", "Reading note generated.");
    return llm;
  } catch (error) {
    await logAiCall(
      settings,
      "generate_reading_note",
      "failed",
      error instanceof Error ? error.message : "Reading note generation failed.",
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

function normalizeConversationHistory(
  history?: PaperQaConversationTurn[] | PaperQa[],
) {
  return (history ?? [])
    .slice(-6)
    .map((item) => ({
      question: item.question,
      answer: item.answer,
    }))
    .filter((item) => item.question.trim() && item.answer.trim());
}

function buildConversationContext(history?: PaperQaConversationTurn[] | PaperQa[]) {
  const turns = normalizeConversationHistory(history);
  if (turns.length === 0) return "";

  return `Recent conversation context:
${turns
  .map(
    (turn, index) =>
      `Q${index + 1}: ${turn.question}
A${index + 1}: ${turn.answer}`,
  )
  .join("\n\n")}

Use this context to resolve follow-up references, but still ground the answer in the paper chunks below.`;
}

export async function answerQuestionWithAI(
  paperId: string,
  chunks: PaperChunk[],
  question: string,
  settings: AiSettings,
  historyOrStream?: PaperQaConversationTurn[] | PaperQa[] | StreamingCallback,
  onStream?: StreamingCallback,
): Promise<{ llm: LLMCallResult; qa: PaperQa }> {
  ensureChunks(chunks);
  if (!question.trim()) {
    throw new Error("Please enter a paper question.");
  }

  const conversationHistory =
    typeof historyOrStream === "function" ? undefined : historyOrStream;
  const streamCallback =
    typeof historyOrStream === "function" ? historyOrStream : onStream;
  const contextChunks = selectQaContext(chunks, question);
  const conversationContext = buildConversationContext(conversationHistory);
  const prompt = `${conversationContext ? `${conversationContext}\n\n` : ""}${
    buildPaperQaPrompt({
      chunks: contextChunks,
      question,
      maxCharacters: 10000,
    }).content
  }

At the end of the answer, list supporting chunks in this format:
Evidence:
- chunk 1 / Abstract: why it supports the answer
- chunk 3 / Results: why it supports the answer

If the supplied paper content does not contain direct evidence, say so clearly.`;

  try {
    const llm = await requestLLM(
      {
        messages: buildMessages(prompt),
        temperature: 0.2,
        maxTokens: 2500,
      },
      settings,
      streamCallback,
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
      title: `AI paper Q&A: ${question.slice(0, 36)}`,
      content: llm.content,
      structured_json: JSON.stringify({
        question,
        evidence,
        conversationHistory: normalizeConversationHistory(conversationHistory),
      }),
      source_chunk_ids: chunkIds(contextChunks),
      status: "success",
    });
    await logAiCall(settings, "paper_qa", "success", "Paper Q&A succeeded.");

    return { llm, qa };
  } catch (error) {
    await logAiCall(
      settings,
      "paper_qa",
      "failed",
      error instanceof Error ? error.message : "Paper Q&A failed.",
      error,
    );
    throw error;
  }
}
