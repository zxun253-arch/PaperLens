import type { PaperQa, QaEvidenceItem } from "../types/paper";

export function parseQaEvidence(evidence: PaperQa["evidence"]): {
  items: QaEvidenceItem[];
  legacyText: string | null;
} {
  if (!evidence?.trim()) return { items: [], legacyText: null };

  try {
    const parsed = JSON.parse(evidence) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
        .map((item) => ({
          chunk_id:
            typeof item.chunk_id === "string" ? item.chunk_id : undefined,
          chunk_index: Number(item.chunk_index),
          section_title:
            typeof item.section_title === "string" ? item.section_title : null,
          snippet: typeof item.snippet === "string" ? item.snippet : "",
        }))
        .filter((item) => Number.isFinite(item.chunk_index));
      return { items, legacyText: null };
    }
  } catch {
    return { items: [], legacyText: evidence };
  }

  return { items: [], legacyText: evidence };
}
