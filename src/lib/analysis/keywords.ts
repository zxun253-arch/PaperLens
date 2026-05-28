import type { PaperChunk } from "../../types/paper";
import type { PaperKeyword } from "./types";

const englishStopWords = new Set([
  "the",
  "and",
  "for",
  "are",
  "with",
  "that",
  "this",
  "from",
  "using",
  "use",
  "used",
  "can",
  "will",
  "have",
  "has",
  "had",
  "were",
  "was",
  "been",
  "into",
  "between",
  "their",
  "which",
  "these",
  "those",
  "paper",
  "study",
  "research",
  "result",
  "results",
  "method",
  "methods",
]);

const chineseStopWords = new Set([
  "研究",
  "论文",
  "本文",
  "方法",
  "结果",
  "实验",
  "分析",
  "一个",
  "一种",
  "通过",
  "基于",
  "可以",
  "进行",
  "具有",
  "以及",
  "对于",
  "相关",
  "不同",
]);

function tokenizeEnglish(text: string) {
  return text
    .toLowerCase()
    .match(/[a-z][a-z-]{2,}/g)
    ?.filter((word) => !englishStopWords.has(word) && word.length <= 32) ?? [];
}

function tokenizeChinese(text: string) {
  const matches = text.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [];
  return matches.filter((word) => !chineseStopWords.has(word));
}

export function extractKeywords(
  chunks: PaperChunk[],
  limit = 15,
): PaperKeyword[] {
  const counts = new Map<string, number>();
  const text = chunks.map((chunk) => chunk.content).join("\n");
  const tokens = [...tokenizeEnglish(text), ...tokenizeChinese(text)];

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([text, count]) => ({
      text,
      count,
      score: count * Math.log(1 + text.length),
    }))
    .filter((keyword) => keyword.count >= 2 || keyword.text.length > 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
