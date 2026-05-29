import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { analyzePaperStructure } from "../analysis";
import { listAiOutputsByPaper } from "../db/aiOutputs";
import { listPaperChunks } from "../db/paperChunks";
import { listPaperNotes } from "../db/paperNotes";
import { listPaperQa } from "../db/paperQa";
import { listPaperTags } from "../db/paperTags";
import { getPaperById } from "../db/papers";
import { parseQaEvidence } from "../../features/paper-detail/evidence";
import type {
  AiOutput,
  Paper,
  PaperChunk,
  PaperNote,
  PaperQa,
  PaperReadingStatus,
} from "../../types/paper";

type WordExportResult =
  | { status: "cancelled" }
  | { status: "exported"; filePath: string };

type DocxModule = typeof import("docx");
type DocxChild =
  | InstanceType<DocxModule["Paragraph"]>
  | InstanceType<DocxModule["Table"]>;

const readingStatusLabels: Record<PaperReadingStatus, string> = {
  unread: "未读",
  reading: "阅读中",
  read: "已读",
  archived: "归档",
};

function fallback(value: string | null | undefined, emptyText = "未填写") {
  return value?.trim() ? value : emptyText;
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNoteType(type: PaperNote["note_type"]) {
  if (type === "ai_paste") return "外部 AI 回填结果";
  if (type === "ai_generated") return "AI 生成结果";
  return "手动笔记";
}

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function sanitizeFileName(name: string) {
  const clean =
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "文献透镜-论文阅读笔记";
  return clean.toLowerCase().endsWith(".docx") ? clean : `${clean}.docx`;
}

function buildDefaultFileName(paper: Paper) {
  const title = paper.title?.trim() || paper.file_name.replace(/\.pdf$/i, "");
  return sanitizeFileName(`文献透镜-论文阅读笔记-${title}`);
}

function buildChildren(
  docx: DocxModule,
  paper: Paper,
  chunks: PaperChunk[],
  notes: PaperNote[],
  qaHistory: PaperQa[],
  aiOutputs: AiOutput[],
  tags: string[],
) {
  const {
    HeadingLevel,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = docx;

  const text = (value: string) => new TextRun(value);
  const paragraph = (value: string) =>
    new Paragraph({ children: [text(value || " ")] });
  const heading = (
    value: string,
    level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  ) => new Paragraph({ text: value, heading: level });
  const infoTable = (rows: Array<[string, string]>) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({ children: [paragraph(label)] }),
              new TableCell({ children: [paragraph(value)] }),
            ],
          }),
      ),
    });

  const children: DocxChild[] = [
    heading("论文阅读笔记", HeadingLevel.TITLE),
    heading("一、论文基本信息", HeadingLevel.HEADING_1),
    infoTable([
      ["标题", fallback(paper.title)],
      ["作者", fallback(paper.authors, "原文未明确说明")],
      ["年份", fallback(paper.year, "原文未明确说明")],
      ["期刊 / 会议", fallback(paper.journal, "原文未明确说明")],
      ["文件名", paper.file_name],
      ["文件路径", fallback(paper.file_path, "未记录")],
      ["导入时间", formatDateTime(paper.created_at)],
      ["当前状态", paper.status],
      ["阅读状态", readingStatusLabels[paper.reading_status]],
      ["重点收藏", paper.is_favorite === 1 ? "是" : "否"],
      ["标签", tags.length > 0 ? tags.join("、") : "未添加"],
    ]),
    heading("二、本地分析结果", HeadingLevel.HEADING_1),
    paragraph("以下内容由本地规则和文本算法生成，不是 AI 总结，仅供辅助阅读。"),
  ];

  if (chunks.length === 0) {
    children.push(paragraph("当前论文尚未解析，无法生成本地分析结果。"));
  } else {
    const analysis = analyzePaperStructure(chunks);
    children.push(
      heading("2.1 论文基础统计", HeadingLevel.HEADING_2),
      infoTable([
        ["总字符数", analysis.stats.totalCharacters.toLocaleString()],
        ["总分块数", String(analysis.stats.totalChunks)],
        ["识别章节数", String(analysis.stats.detectedSectionCount)],
        ["包含摘要", yesNo(analysis.stats.hasAbstract)],
        ["包含引言", yesNo(analysis.stats.hasIntroduction)],
        ["包含方法", yesNo(analysis.stats.hasMethods)],
        ["包含结果", yesNo(analysis.stats.hasResults)],
        ["包含结论", yesNo(analysis.stats.hasConclusion)],
        ["包含参考文献", yesNo(analysis.stats.hasReferences)],
      ]),
      heading("2.2 章节结构概览", HeadingLevel.HEADING_2),
      ...chunks.map((chunk) =>
        paragraph(
          `Chunk ${chunk.chunk_index + 1}：${chunk.section_title || "未识别章节"}`,
        ),
      ),
      heading("2.3 本地关键词", HeadingLevel.HEADING_2),
      paragraph(
        analysis.keywords.length
          ? analysis.keywords
              .map((item) => `${item.text}（${item.count} 次）`)
              .join("、")
          : "未提取到有效关键词。",
      ),
      heading("2.4 本地关键句", HeadingLevel.HEADING_2),
      ...(analysis.keySentences.length
        ? analysis.keySentences.map((sentence) =>
            paragraph(
              `Chunk ${sentence.chunkIndex + 1}${sentence.sectionTitle ? ` / ${sentence.sectionTitle}` : ""}：${sentence.text}`,
            ),
          )
        : [paragraph("未提取到有效关键句。")]),
    );
  }

  children.push(heading("三、论文分块内容", HeadingLevel.HEADING_1));
  if (chunks.length === 0) {
    children.push(paragraph("当前论文尚未解析或没有可用分块内容。"));
  } else {
    for (const chunk of chunks) {
      children.push(
        heading(
          `Chunk ${chunk.chunk_index + 1}：${chunk.section_title || "未识别章节"}`,
          HeadingLevel.HEADING_2,
        ),
        paragraph(chunk.content),
      );
    }
  }

  children.push(heading("四、阅读笔记与 AI 结果", HeadingLevel.HEADING_1));
  if (notes.length === 0 && aiOutputs.length === 0) {
    children.push(paragraph("暂无阅读笔记或 AI 结果历史。"));
  }
  for (const note of notes) {
    children.push(
      heading(
        `${formatNoteType(note.note_type)}：${note.title}`,
        HeadingLevel.HEADING_2,
      ),
      paragraph(`更新时间：${formatDateTime(note.updated_at)}`),
      paragraph(note.note_content),
    );
    if (note.note_type !== "manual") {
      children.push(
        paragraph(
          "提醒：AI 相关内容仅作为阅读辅助，正式写作前请结合论文原文核对。",
        ),
      );
    }
  }
  for (const output of aiOutputs) {
    children.push(
      heading(`AI 结果：${output.title}`, HeadingLevel.HEADING_2),
      paragraph(
        `动作：${output.action}；Provider：${output.provider}；模型：${output.model || "未记录"}`,
      ),
      paragraph(output.content),
    );
  }

  children.push(heading("五、论文问答记录", HeadingLevel.HEADING_1));
  if (qaHistory.length === 0) {
    children.push(paragraph("暂无论文问答记录。"));
  } else {
    for (const qa of qaHistory) {
      const evidence = parseQaEvidence(qa.evidence);
      children.push(
        heading(`问：${qa.question}`, HeadingLevel.HEADING_2),
        paragraph(qa.answer),
      );
      if (evidence.items.length > 0) {
        children.push(paragraph("依据分块："));
        for (const item of evidence.items) {
          children.push(
            paragraph(
              `Chunk ${item.chunk_index + 1}${item.section_title ? ` / ${item.section_title}` : ""}：${item.snippet}`,
            ),
          );
        }
      } else if (evidence.legacyText) {
        children.push(paragraph(`依据：${evidence.legacyText}`));
      }
    }
  }

  children.push(
    heading("六、导出信息", HeadingLevel.HEADING_1),
    paragraph("导出工具：文献透镜 / PaperLens"),
    paragraph(`导出时间：${formatDateTime(new Date())}`),
  );

  return children;
}

export async function exportPaperToWord(
  paperId: string,
): Promise<WordExportResult> {
  const paper = await getPaperById(paperId);
  if (!paper) {
    throw new Error(
      "未找到该论文记录，无法导出 Word。请返回论文库重新打开论文。",
    );
  }

  const [chunks, notes, qaHistory, aiOutputs, tags, docx] = await Promise.all([
    listPaperChunks(paperId),
    listPaperNotes(paperId),
    listPaperQa(paperId),
    listAiOutputsByPaper(paperId),
    listPaperTags(paperId),
    import("docx"),
  ]);

  const filePath = await save({
    defaultPath: buildDefaultFileName(paper),
    filters: [{ name: "Word 文档", extensions: ["docx"] }],
  });

  if (!filePath) {
    return { status: "cancelled" };
  }

  const normalizedPath = filePath.toLowerCase().endsWith(".docx")
    ? filePath
    : `${filePath}.docx`;
  const document = new docx.Document({
    sections: [
      {
        children: buildChildren(
          docx,
          paper,
          chunks,
          notes,
          qaHistory,
          aiOutputs,
          tags.map((tag) => tag.tag),
        ),
      },
    ],
  });
  const blob = await docx.Packer.toBlob(document);
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));

  await invoke("write_binary_file", {
    filePath: normalizedPath,
    bytes,
  });

  return { status: "exported", filePath: normalizedPath };
}
