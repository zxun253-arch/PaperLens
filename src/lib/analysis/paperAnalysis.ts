import type { PaperChunk } from "../../types/paper";
import { extractKeySentences } from "./keySentences";
import { extractKeywords } from "./keywords";
import type { PaperAnalysisResult, PaperSectionOverview } from "./types";

const sectionGroups = {
  abstract: ["abstract", "摘要"],
  introduction: ["introduction", "引言"],
  methods: ["methods", "methodology", "method", "方法", "实验"],
  results: ["results", "结果"],
  conclusion: ["conclusion", "结论"],
  references: ["references", "参考文献"],
};

function titleIncludes(title: string | null, keywords: string[]) {
  const normalized = (title ?? "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function buildSectionOverview(chunks: PaperChunk[]): PaperSectionOverview[] {
  const sectionMap = new Map<string, number[]>();

  for (const chunk of chunks) {
    const title = chunk.section_title?.trim() || "未识别章节";
    const indexes = sectionMap.get(title) ?? [];
    indexes.push(chunk.chunk_index);
    sectionMap.set(title, indexes);
  }

  return [...sectionMap.entries()].map(([title, chunkIndexes]) => ({
    title,
    chunkIndexes,
  }));
}

export function analyzePaperStructure(chunks: PaperChunk[]): PaperAnalysisResult {
  const sections = buildSectionOverview(chunks);
  const detectedSectionCount = sections.filter(
    (section) => section.title !== "未识别章节" && section.title !== "全文" && section.title !== "续文",
  ).length;
  const totalCharacters = chunks.reduce(
    (total, chunk) => total + chunk.content.length,
    0,
  );
  const hasAbstract = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.abstract),
  );
  const hasIntroduction = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.introduction),
  );
  const hasMethods = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.methods),
  );
  const hasResults = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.results),
  );
  const hasConclusion = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.conclusion),
  );
  const hasReferences = chunks.some((chunk) =>
    titleIncludes(chunk.section_title, sectionGroups.references),
  );
  const keywords = extractKeywords(chunks);

  return {
    stats: {
      totalCharacters,
      totalChunks: chunks.length,
      detectedSectionCount,
      hasAbstract,
      hasIntroduction,
      hasMethods,
      hasResults,
      hasConclusion,
      hasReferences,
      structureMayBeIncomplete:
        detectedSectionCount < 3 || (!hasAbstract && !hasIntroduction),
    },
    sections,
    keywords,
    keySentences: extractKeySentences(chunks, keywords),
  };
}
