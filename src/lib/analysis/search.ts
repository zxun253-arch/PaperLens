import type { PaperChunk } from "../../types/paper";
import type { AiSettings } from "../llm/types";
import { semanticSearchPaperChunks } from "./semanticSearch";
import type { PaperSearchResult } from "./types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSnippet(content: string, query: string) {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index < 0) {
    return content.slice(0, 180);
  }

  const start = Math.max(0, index - 70);
  const end = Math.min(content.length, index + query.length + 110);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  const snippet = `${prefix}${content.slice(start, end)}${suffix}`;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return snippet.replace(regex, "【$1】");
}

export function searchPaperChunks(
  chunks: PaperChunk[],
  query: string,
): PaperSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const content = chunk.content.toLowerCase();
      const matchCount = content.split(normalizedQuery).length - 1;
      const titleMatch = (chunk.section_title ?? "")
        .toLowerCase()
        .includes(normalizedQuery)
        ? 1
        : 0;
      const score = matchCount * 2 + titleMatch;

      return {
        chunk,
        matchCount,
        score,
        snippet: buildSnippet(chunk.content, query.trim()),
        relevanceScore: Math.min(100, score * 10),
        source: "keyword" as const,
      };
    })
    .filter((result) => result.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index,
    );
}

export async function hybridSearchPaperChunks(
  chunks: PaperChunk[],
  query: string,
  settings?: AiSettings | null,
  onProgress?: (message: string) => void,
): Promise<PaperSearchResult[]> {
  const keywordResults = searchPaperChunks(chunks, query);

  if (!settings) {
    return keywordResults;
  }

  const semanticResults = await semanticSearchPaperChunks(
    chunks,
    query,
    settings,
    onProgress,
  );
  const merged = new Map<string, PaperSearchResult>();

  for (const result of keywordResults) {
    merged.set(result.chunk.id, result);
  }

  for (const semanticResult of semanticResults) {
    const existing = merged.get(semanticResult.chunk.id);
    if (!existing) {
      merged.set(semanticResult.chunk.id, {
        ...semanticResult,
        source: "semantic",
      });
      continue;
    }

    merged.set(semanticResult.chunk.id, {
      ...existing,
      score: existing.score + semanticResult.score,
      relevanceScore: Math.max(
        existing.relevanceScore ?? 0,
        semanticResult.relevanceScore ?? 0,
      ),
      source: "hybrid",
    });
  }

  return Array.from(merged.values()).sort(
    (a, b) =>
      (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) ||
      b.score - a.score ||
      a.chunk.chunk_index - b.chunk.chunk_index,
  );
}
