import type { PaperChunk } from "../../types/paper";
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

      return {
        chunk,
        matchCount,
        score: matchCount * 2 + titleMatch,
        snippet: buildSnippet(chunk.content, query.trim()),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index);
}
