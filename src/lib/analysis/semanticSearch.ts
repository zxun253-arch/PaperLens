import type { PaperChunk } from "../../types/paper";
import { callLLM } from "../llm/provider";
import type { AiSettings } from "../llm/types";
import type { PaperSearchResult } from "./types";

const BATCH_SIZE = 40;

type SemanticProgressCallback = (message: string) => void;

interface RankedChunk {
  id?: string;
  chunk_id?: string;
  chunkIndex?: number;
  chunk_index?: number;
  score?: number;
  relevance?: number;
}

function buildSemanticSnippet(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 220);
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  try {
    const parsed = JSON.parse(source.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asRankedChunk(value: unknown): RankedChunk | null {
  if (!value || typeof value !== "object") return null;
  return value as RankedChunk;
}

function buildPrompt(chunks: PaperChunk[], query: string) {
  const candidates = chunks.map((chunk) => ({
    id: chunk.id,
    chunk_index: chunk.chunk_index,
    section_title: chunk.section_title || "Untitled section",
    preview: buildSemanticSnippet(chunk.content).slice(0, 200),
  }));

  return `Rank the paper chunks by relevance to the search query.

Query:
${query}

Chunks:
${JSON.stringify(candidates, null, 2)}

Return only a JSON array. Each item must be:
{"id":"chunk id","chunk_index":0,"score":0}

Score means relevance from 0 to 100. Include only chunks with score >= 35.`;
}

export async function semanticSearchPaperChunks(
  chunks: PaperChunk[],
  query: string,
  settings: AiSettings,
  onProgress?: SemanticProgressCallback,
): Promise<PaperSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const results = new Map<string, PaperSearchResult>();
  const batches: PaperChunk[][] = [];
  for (let index = 0; index < chunks.length; index += BATCH_SIZE) {
    batches.push(chunks.slice(index, index + BATCH_SIZE));
  }

  onProgress?.("Preparing semantic search...");

  for (const [batchIndex, batch] of batches.entries()) {
    onProgress?.(
      `Semantic search ${batchIndex + 1}/${batches.length}: ranking chunks...`,
    );

    const llm = await callLLM(
      {
        messages: [
          {
            role: "system",
            content:
              "You are a precise academic paper search assistant. Rank chunks only from the supplied candidate list.",
          },
          { role: "user", content: buildPrompt(batch, normalizedQuery) },
        ],
        temperature: 0,
        maxTokens: 1800,
      },
      settings,
    );

    for (const item of extractJsonArray(llm.content)) {
      const ranked = asRankedChunk(item);
      if (!ranked) continue;

      const chunkId = ranked.id ?? ranked.chunk_id;
      const chunkIndex = ranked.chunk_index ?? ranked.chunkIndex;
      const chunk =
        (chunkId ? batch.find((candidate) => candidate.id === chunkId) : null) ??
        (typeof chunkIndex === "number"
          ? batch.find((candidate) => candidate.chunk_index === chunkIndex)
          : null);

      if (!chunk) continue;

      const relevanceScore = clampScore(
        Number(ranked.score ?? ranked.relevance ?? 0),
      );
      if (relevanceScore <= 0) continue;

      results.set(chunk.id, {
        chunk,
        matchCount: 0,
        score: relevanceScore / 10,
        relevanceScore,
        source: "semantic",
        snippet: buildSemanticSnippet(chunk.content),
      });
    }
  }

  onProgress?.("Semantic search complete.");

  return Array.from(results.values()).sort(
    (a, b) =>
      (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) ||
      a.chunk.chunk_index - b.chunk.chunk_index,
  );
}
