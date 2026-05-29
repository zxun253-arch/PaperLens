import type { PaperChunk } from "../../types/paper";
import type { PaperKeySentence, PaperKeyword } from "./types";

const importantSectionWords = [
  "abstract",
  "摘要",
  "introduction",
  "引言",
  "conclusion",
  "结论",
  "results",
  "结果",
  "discussion",
  "讨论",
];

const cueWords = [
  "propose",
  "proposed",
  "show",
  "shows",
  "demonstrate",
  "demonstrates",
  "significant",
  "conclusion",
  "method",
  "result",
  "improve",
  "提出",
  "表明",
  "证明",
  "结果",
  "显著",
  "方法",
  "结论",
  "创新",
];

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 420);
}

function isImportantSection(sectionTitle: string | null) {
  const title = (sectionTitle ?? "").toLowerCase();
  return importantSectionWords.some((word) => title.includes(word));
}

export function extractKeySentences(
  chunks: PaperChunk[],
  keywords: PaperKeyword[],
  limit = 8,
): PaperKeySentence[] {
  const keywordTexts = keywords
    .slice(0, 12)
    .map((keyword) => keyword.text.toLowerCase());
  const candidates: PaperKeySentence[] = [];

  for (const chunk of chunks) {
    for (const sentence of splitSentences(chunk.content)) {
      const lowerSentence = sentence.toLowerCase();
      const keywordHits = keywordTexts.filter((keyword) =>
        lowerSentence.includes(keyword),
      ).length;
      const cueHits = cueWords.filter((word) =>
        lowerSentence.includes(word),
      ).length;
      const sectionBoost = isImportantSection(chunk.section_title) ? 2 : 0;
      const lengthScore =
        sentence.length >= 80 && sentence.length <= 240 ? 1 : 0;
      const score =
        keywordHits * 2 + cueHits * 1.5 + sectionBoost + lengthScore;

      if (score > 0) {
        candidates.push({
          text: sentence,
          score,
          chunkIndex: chunk.chunk_index,
          sectionTitle: chunk.section_title,
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}
