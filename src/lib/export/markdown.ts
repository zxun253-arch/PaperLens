import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { analyzePaperStructure } from "../analysis";
import { listPaperChunks } from "../db/paperChunks";
import { listPaperNotes } from "../db/paperNotes";
import { getPaperById } from "../db/papers";
import type { Paper, PaperChunk, PaperNote, PaperNoteType } from "../../types/paper";

type MarkdownExportInput = {
  paper: Paper;
  chunks: PaperChunk[];
  notes: PaperNote[];
};

type MarkdownExportResult =
  | { status: "cancelled" }
  | { status: "exported"; filePath: string };

const statusLabels: Record<Paper["status"], string> = {
  unparsed: "未解析",
  parsing: "解析中",
  parsed: "已解析",
  parse_failed: "解析失败",
  noted: "已生成笔记",
};

export function formatNoteType(noteType: PaperNoteType) {
  if (noteType === "ai_paste") return "外部 AI 回填结果";
  if (noteType === "ai_generated") return "AI 生成结果";
  return "手动笔记";
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fallback(value: string | null | undefined, emptyText = "未填写") {
  return value?.trim() ? value : emptyText;
}

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function ensureMdExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".md") ? fileName : `${fileName}.md`;
}

export function sanitizeFileName(name: string) {
  return ensureMdExtension(
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "文献透镜-论文阅读笔记",
  );
}

function buildDefaultFileName(paper: Paper) {
  const title = paper.title?.trim() || paper.file_name.replace(/\.pdf$/i, "");
  return sanitizeFileName(`文献透镜-论文阅读笔记-${title}`);
}

function buildLocalAnalysisMarkdown(chunks: PaperChunk[]) {
  if (chunks.length === 0) {
    return [
      "> 以下内容由文献透镜基于本地规则和文本算法生成，不是 AI 总结，仅供辅助阅读。",
      "",
      "当前论文尚未解析，无法生成本地分析结果。",
    ].join("\n");
  }

  const analysis = analyzePaperStructure(chunks);
  const stats = analysis.stats;
  const sectionRows = chunks
    .map(
      (chunk) =>
        `| ${chunk.chunk_index + 1} | Chunk ${chunk.chunk_index + 1} | ${escapeTableCell(
          chunk.section_title || "未识别章节",
        )} |`,
    )
    .join("\n");
  const keywords =
    analysis.keywords.length === 0
      ? "未提取到有效关键词。"
      : analysis.keywords
          .map((keyword) => `${keyword.text}（${keyword.count} 次）`)
          .join("、");
  const keySentences =
    analysis.keySentences.length === 0
      ? "未提取到有效关键句。"
      : analysis.keySentences
          .map((sentence, index) =>
            [
              `#### 关键句 ${index + 1}`,
              "",
              `- 来源：Chunk ${sentence.chunkIndex + 1}${
                sentence.sectionTitle ? ` / ${sentence.sectionTitle}` : ""
              }`,
              `- 得分：${sentence.score.toFixed(1)}`,
              "",
              sentence.text,
            ].join("\n"),
          )
          .join("\n\n");

  return [
    "> 以下内容由文献透镜基于本地规则和文本算法生成，不是 AI 总结，仅供辅助阅读。",
    "",
    "### 2.1 论文基础统计",
    "",
    `- 总字符数：${stats.totalCharacters.toLocaleString()}`,
    `- 总分块数：${stats.totalChunks}`,
    `- 识别章节数：${stats.detectedSectionCount}`,
    `- 是否包含摘要：${yesNo(stats.hasAbstract)}`,
    `- 是否包含引言：${yesNo(stats.hasIntroduction)}`,
    `- 是否包含方法：${yesNo(stats.hasMethods)}`,
    `- 是否包含结果：${yesNo(stats.hasResults)}`,
    `- 是否包含结论：${yesNo(stats.hasConclusion)}`,
    `- 是否包含参考文献：${yesNo(stats.hasReferences)}`,
    stats.structureMayBeIncomplete ? "- 结构提示：章节识别可能不完整，建议结合原文核对。" : "",
    "",
    "### 2.2 章节结构概览",
    "",
    "| 序号 | Chunk | 章节标题 |",
    "|---|---|---|",
    sectionRows,
    "",
    "### 2.3 本地关键词",
    "",
    keywords,
    "",
    "### 2.4 本地关键句",
    "",
    keySentences,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildChunksMarkdown(chunks: PaperChunk[]) {
  if (chunks.length === 0) {
    return "当前论文尚未解析或没有可用分块内容。";
  }

  return chunks
    .map((chunk) => {
      const title = chunk.section_title || "未识别章节";
      return `### Chunk ${chunk.chunk_index + 1}：${title}\n\n${chunk.content}`;
    })
    .join("\n\n");
}

function buildNotesMarkdown(notes: PaperNote[]) {
  if (notes.length === 0) {
    return "暂无阅读笔记。";
  }

  return notes
    .map((note, index) => {
      const typeLabel = formatNoteType(note.note_type);
      const aiReminder =
        note.note_type === "ai_paste" || note.note_type === "ai_generated"
          ? "\n\n> 提醒：AI 相关内容仅作为阅读辅助，正式写作前请结合论文原文核对。"
          : "";

      return [
        `### ${index + 1}. ${typeLabel}：${fallback(note.title, "阅读笔记")}`,
        "",
        `- 类型：${typeLabel}`,
        `- 更新时间：${formatDateTime(note.updated_at)}`,
        "",
        note.note_content,
        aiReminder,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildPaperMarkdownExport(input: MarkdownExportInput) {
  const { paper, chunks, notes } = input;

  return [
    "# 论文阅读笔记",
    "",
    "## 一、论文基本信息",
    "",
    `- 标题：${fallback(paper.title, "未填写")}`,
    `- 作者：${fallback(paper.authors, "原文未明确说明")}`,
    `- 年份：${fallback(paper.year, "原文未明确说明")}`,
    `- 期刊 / 会议：${fallback(paper.journal, "原文未明确说明")}`,
    `- 文件名：${fallback(paper.file_name)}`,
    `- 文件路径：\`${fallback(paper.file_path, "未记录")}\``,
    `- 导入时间：${formatDateTime(paper.created_at)}`,
    `- 当前状态：${statusLabels[paper.status]}`,
    "",
    "## 二、本地分析结果",
    "",
    buildLocalAnalysisMarkdown(chunks),
    "",
    "## 三、论文分块内容",
    "",
    buildChunksMarkdown(chunks),
    "",
    "## 四、阅读笔记",
    "",
    buildNotesMarkdown(notes),
    "",
    "## 五、导出信息",
    "",
    "- 导出工具：文献透镜 / PaperLens",
    `- 导出时间：${formatDateTime(new Date())}`,
    "",
  ].join("\n");
}

export async function exportPaperToMarkdown(
  paperId: string,
): Promise<MarkdownExportResult> {
  const paper = await getPaperById(paperId);

  if (!paper) {
    throw new Error("未找到该论文记录，无法导出。");
  }

  const [chunks, notes] = await Promise.all([
    listPaperChunks(paperId),
    listPaperNotes(paperId),
  ]);
  const content = buildPaperMarkdownExport({ paper, chunks, notes });
  const defaultPath = buildDefaultFileName(paper);

  const filePath = await save({
    defaultPath,
    filters: [{ name: "Markdown 文件", extensions: ["md"] }],
  });

  if (!filePath) {
    return { status: "cancelled" };
  }

  const normalizedPath = filePath.toLowerCase().endsWith(".md")
    ? filePath
    : `${filePath}.md`;

  await invoke("write_text_file", {
    filePath: normalizedPath,
    content,
  });

  return { status: "exported", filePath: normalizedPath };
}
