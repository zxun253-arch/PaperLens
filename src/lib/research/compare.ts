import { analyzePaperStructure } from "../analysis";
import { listPaperChunks } from "../db/paperChunks";
import { listPaperNotes } from "../db/paperNotes";
import { listPaperTags } from "../db/paperTags";
import { getPaperById } from "../db/papers";
import type { Paper, PaperChunk, PaperNote } from "../../types/paper";

export interface PaperCompareItem {
  paper: Paper;
  chunks: PaperChunk[];
  notes: PaperNote[];
  tags: string[];
  keywords: string[];
  noteSummary: string;
}

export async function loadPaperCompareItems(
  paperIds: string[],
): Promise<PaperCompareItem[]> {
  const items = await Promise.all(
    paperIds.map(async (paperId) => {
      const [paper, chunks, notes, tags] = await Promise.all([
        getPaperById(paperId),
        listPaperChunks(paperId),
        listPaperNotes(paperId),
        listPaperTags(paperId),
      ]);
      if (!paper) return null;
      const analysis = chunks.length > 0 ? analyzePaperStructure(chunks) : null;
      return {
        paper,
        chunks,
        notes,
        tags: tags.map((tag) => tag.tag),
        keywords:
          analysis?.keywords.slice(0, 8).map((keyword) => keyword.text) ?? [],
        noteSummary: notes
          .slice(0, 2)
          .map((note) => `${note.title}：${note.note_content.slice(0, 240)}`)
          .join("\n"),
      };
    }),
  );
  return items.filter((item): item is PaperCompareItem => item !== null);
}

function paperTitle(item: PaperCompareItem) {
  return item.paper.title || item.paper.file_name;
}

export function buildComparePrompt(items: PaperCompareItem[]) {
  const paperBlocks = items
    .map((item, index) => {
      const metadata = [
        `标题：${paperTitle(item)}`,
        `作者：${item.paper.authors || "原文未明确说明"}`,
        `年份：${item.paper.year || "原文未明确说明"}`,
        `期刊/会议：${item.paper.journal || "原文未明确说明"}`,
        `研究领域：${item.paper.research_field || "原文未明确说明"}`,
        `论文类型：${item.paper.paper_type || "原文未明确说明"}`,
        `标签：${item.tags.join("、") || "未添加"}`,
        `本地关键词：${item.keywords.join("、") || "未提取"}`,
        `用户笔记摘要：${item.noteSummary || "暂无笔记"}`,
      ].join("\n");
      const coreChunks = item.chunks
        .slice(0, 6)
        .map(
          (chunk) =>
            `Chunk ${chunk.chunk_index + 1} / ${chunk.section_title || "未识别章节"}\n${chunk.content.slice(0, 900)}`,
        )
        .join("\n\n");
      return `## 论文 ${index + 1}\n${metadata}\n\n### 论文内容节选\n${coreChunks || "当前论文尚未解析。"}`;
    })
    .join("\n\n");

  return [
    "你是严谨的中文科研阅读助手。请基于以下多篇论文信息，生成结构化对比。",
    "",
    "要求：",
    "- 必须忠实于给定内容，不要编造不存在的实验、数据或结论。",
    "- 找不到的信息写“原文未明确说明”。",
    "- 区分原文明确内容、用户笔记内容和可作为写作参考的归纳。",
    "- 输出中文，结构清晰，适合写文献综述前的比较阅读。",
    "",
    "请输出：",
    "1. 对比总览表",
    "2. 研究问题对比",
    "3. 方法与实验/仿真对象对比",
    "4. 主要结果对比",
    "5. 创新点与局限性对比",
    "6. 可写入论文的综述段落草稿",
    "7. 参考引用建议",
    "",
    paperBlocks,
  ].join("\n");
}

export function buildLiteratureReviewWorkflowPrompt(items: PaperCompareItem[]) {
  const base = buildComparePrompt(items);
  return [
    "请基于以下多篇论文生成文献综述辅助内容。",
    "",
    "输出结构：",
    "一、研究方向概述",
    "二、按研究方法分类",
    "三、按时间线或研究脉络梳理",
    "四、材料 / 器件 / 方法 / 性能对比",
    "五、研究现状总结",
    "六、不足与发展趋势",
    "七、可用于论文中的中文综述段落草稿",
    "八、参考引用建议",
    "",
    "重要约束：不能凭空扩展，不能夸大论文贡献，正式写作前需要结合原文核对。",
    "",
    base,
  ].join("\n");
}
