import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

type ExportResult =
  | { status: "cancelled" }
  | { status: "exported"; filePath: string };

function sanitizeFileName(name: string, extension: "md" | "docx") {
  const clean =
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "文献透镜-文献综述草稿";
  return clean.toLowerCase().endsWith(`.${extension}`)
    ? clean
    : `${clean}.${extension}`;
}

export async function exportLiteratureReviewMarkdown(
  title: string,
  content: string,
): Promise<ExportResult> {
  const filePath = await save({
    defaultPath: sanitizeFileName(`文献透镜-文献综述-${title}`, "md"),
    filters: [{ name: "Markdown 文件", extensions: ["md"] }],
  });
  if (!filePath) return { status: "cancelled" };

  const normalized = filePath.toLowerCase().endsWith(".md")
    ? filePath
    : `${filePath}.md`;
  const markdown = [
    `# ${title || "文献综述草稿"}`,
    "",
    "> 本文档由文献透镜基于本地论文资料、Prompt 工作流或用户自定义 API 生成。AI 相关内容仅作研究写作辅助，正式使用前请结合原文核对。",
    "",
    content || "暂无内容。",
    "",
    "## 导出信息",
    "",
    "- 导出工具：文献透镜 / PaperLens",
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
  ].join("\n");
  await invoke("write_text_file", { filePath: normalized, content: markdown });
  return { status: "exported", filePath: normalized };
}

export async function exportLiteratureReviewWord(
  title: string,
  content: string,
): Promise<ExportResult> {
  const filePath = await save({
    defaultPath: sanitizeFileName(`文献透镜-文献综述-${title}`, "docx"),
    filters: [{ name: "Word 文档", extensions: ["docx"] }],
  });
  if (!filePath) return { status: "cancelled" };

  const normalized = filePath.toLowerCase().endsWith(".docx")
    ? filePath
    : `${filePath}.docx`;
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } =
    await import("docx");
  const paragraphs = (content || "暂无内容。").split(/\n{1,}/).map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line || " ")],
      }),
  );
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: title || "文献综述草稿",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun(
                "AI 相关内容仅作研究写作辅助，正式使用前请结合论文原文核对。",
              ),
            ],
          }),
          ...paragraphs,
          new Paragraph({ text: "导出信息", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [new TextRun("导出工具：文献透镜 / PaperLens")],
          }),
          new Paragraph({
            children: [
              new TextRun(`导出时间：${new Date().toLocaleString("zh-CN")}`),
            ],
          }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  await invoke("write_binary_file", { filePath: normalized, bytes });
  return { status: "exported", filePath: normalized };
}
