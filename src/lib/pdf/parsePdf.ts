import { invoke } from "@tauri-apps/api/core";
import { detectScannedPdf } from "../ocr";
import type { PaperChunkInput } from "../../types/paper";

const MIN_CHUNK_LENGTH = 500;
const TARGET_CHUNK_LENGTH = 2200;
const MAX_CHUNK_LENGTH = 3200;

const sectionPatterns = [
  "Abstract",
  "Keywords",
  "Introduction",
  "Related Work",
  "Methods",
  "Methodology",
  "Experiment",
  "Experimental",
  "Results",
  "Discussion",
  "Conclusion",
  "References",
  "摘要",
  "关键词",
  "引言",
  "相关工作",
  "方法",
  "实验",
  "结果",
  "讨论",
  "结论",
  "参考文献",
];

export async function parsePdfText(filePath: string): Promise<string> {
  if (!filePath.trim()) {
    throw new Error("文件路径为空。");
  }

  try {
    const text = await invoke<string>("extract_pdf_text", { filePath });
    const detection = detectScannedPdf(text);
    if (detection.likelyScanned) {
      throw new Error(
        `${detection.reason} 当前版本暂不内置 OCR。建议：${detection.suggestions.join("；")}`,
      );
    }
    return text;
  } catch (error) {
    console.error("Failed to parse PDF text", error);
    throw new Error(
      error instanceof Error ? error.message : "PDF 文本解析失败。",
    );
  }
}

export function detectSectionTitle(line: string): string | null {
  const normalized = line.trim().replace(/\s+/g, " ");

  if (!normalized || normalized.length > 80) {
    return null;
  }

  const withoutNumber = normalized.replace(
    /^(\d+(\.\d+)*|[一二三四五六七八九十]+)[\s.、]*/,
    "",
  );

  return (
    sectionPatterns.find((title) => {
      const pattern = new RegExp(`^${title}\\b\\s*[:：]?$`, "i");
      return pattern.test(withoutNumber);
    }) ?? null
  );
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pushChunk(
  chunks: PaperChunkInput[],
  contentParts: string[],
  sectionTitle: string | null,
) {
  const content = contentParts.join("\n").trim();

  if (!content) {
    return;
  }

  chunks.push({
    chunk_index: chunks.length,
    section_title: sectionTitle,
    content,
  });
}

function splitLongContent(content: string): string[] {
  if (content.length <= MAX_CHUNK_LENGTH) {
    return [content];
  }

  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (
      current.length + paragraph.length > TARGET_CHUNK_LENGTH &&
      current.length >= MIN_CHUNK_LENGTH
    ) {
      chunks.push(current.trim());
      current = "";
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;

    if (current.length > MAX_CHUNK_LENGTH) {
      chunks.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function splitPaperTextIntoChunks(text: string): PaperChunkInput[] {
  const normalizedText = normalizeText(text);

  if (normalizedText.length < 200) {
    const detection = detectScannedPdf(normalizedText);
    throw new Error(
      `${detection.reason} 当前版本暂不内置 OCR。建议：${detection.suggestions.join("；")}`,
    );
  }

  const lines = normalizedText.split("\n");
  const chunks: PaperChunkInput[] = [];
  let currentSection: string | null = null;
  let currentParts: string[] = [];
  let foundSection = false;

  for (const line of lines) {
    const sectionTitle = detectSectionTitle(line);

    if (sectionTitle) {
      foundSection = true;

      if (currentParts.join("\n").trim()) {
        const pieces = splitLongContent(currentParts.join("\n"));
        for (const piece of pieces) {
          pushChunk(chunks, [piece], currentSection);
        }
      }

      currentSection = sectionTitle;
      currentParts = [line.trim()];
      continue;
    }

    currentParts.push(line);
  }

  if (currentParts.join("\n").trim()) {
    const pieces = splitLongContent(currentParts.join("\n"));
    for (const piece of pieces) {
      pushChunk(chunks, [piece], currentSection);
    }
  }

  if (!foundSection || chunks.length <= 1) {
    const pieces = splitLongContent(normalizedText);
    return pieces.map((content, index) => ({
      chunk_index: index,
      section_title: index === 0 ? "全文" : "续文",
      content,
    }));
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunk_index: index,
    section_title: chunk.section_title ?? "未识别章节",
  }));
}
