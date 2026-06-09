import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Paper } from "../../types/paper";
import { sanitizeFileName } from "../../utils/format";
import { notifyBeforeExport } from "../../plugins/pluginSystem";

type BibTeXExportResult =
  | { status: "cancelled" }
  | { status: "exported"; filePath: string };

function normalizeAuthors(authors: string | null) {
  if (!authors?.trim()) return undefined;
  return authors
    .split(/;|,|\band\b/i)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(" and ");
}

function escapeBibTeX(value: string) {
  return value.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function citationKey(paper: Paper) {
  const firstAuthor =
    normalizeAuthors(paper.authors)?.split(" and ")[0]?.split(/\s+/).pop() ??
    "paper";
  const year = paper.year?.match(/\d{4}/)?.[0] ?? "n.d.";
  const titleWord =
    paper.title
      ?.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .find((word) => word.length > 3) ?? "paper";
  return `${firstAuthor}${year}${titleWord}`.replace(/[^A-Za-z0-9:_-]/g, "");
}

export function exportPaperAsBibTeX(paper: Paper): string {
  const fields: Array<[string, string | undefined]> = [
    ["title", paper.title ?? paper.file_name.replace(/\.pdf$/i, "")],
    ["author", normalizeAuthors(paper.authors)],
    ["year", paper.year ?? undefined],
    ["journal", paper.journal ?? undefined],
    ["keywords", paper.keywords ?? undefined],
    ["abstract", paper.abstract ?? undefined],
    ["file", paper.file_path ?? undefined],
  ];

  const lines = fields
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `  ${key} = {${escapeBibTeX(value ?? "")}}`);

  return [`@article{${citationKey(paper)},`, `${lines.join(",\n")}`, `}`].join(
    "\n",
  );
}

export async function savePaperBibTeX(paper: Paper): Promise<BibTeXExportResult> {
  await notifyBeforeExport("bibtex", { paper: paper as unknown as Record<string, unknown> });
  const defaultName = sanitizeFileName(
    `${paper.title || paper.file_name.replace(/\.pdf$/i, "")}.bib`,
    "bib",
  );
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "BibTeX", extensions: ["bib"] }],
  });

  if (!filePath) return { status: "cancelled" };

  const normalizedPath = filePath.toLowerCase().endsWith(".bib")
    ? filePath
    : `${filePath}.bib`;

  await invoke("write_text_file", {
    filePath: normalizedPath,
    content: exportPaperAsBibTeX(paper),
  });

  return { status: "exported", filePath: normalizedPath };
}
