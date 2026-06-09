import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Paper } from "../../types/paper";
import { sanitizeFileName } from "../../utils/format";
import { notifyBeforeExport } from "../../plugins/pluginSystem";

/**
 * Export a paper as RIS (Research Information Systems) format — a standard
 * citation format supported by Zotero, EndNote, Mendeley, etc.
 *
 * RIS reference: https://en.wikipedia.org/wiki/RIS_(file_format)
 */

function normalizeAuthors(authors: string | null): string[] {
  if (!authors?.trim()) return [];
  return authors
    .split(/;|,|\band\b/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

function escapeRis(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/[{}]/g, "");
}

export function exportPaperAsRis(paper: Paper): string {
  const lines: string[] = [];

  lines.push("TY  - JOUR"); // Default type (could be BOOK, CONF, etc.)

  // Authors
  for (const author of normalizeAuthors(paper.authors)) {
    lines.push(`AU  - ${escapeRis(author)}`);
  }

  // Title
  if (paper.title) {
    lines.push(`TI  - ${escapeRis(paper.title)}`);
  }

  // Year
  if (paper.year) {
    const yearMatch = paper.year.match(/\d{4}/);
    if (yearMatch) lines.push(`PY  - ${yearMatch[0]}`);
  }

  // Journal
  if (paper.journal) {
    lines.push(`JF  - ${escapeRis(paper.journal)}`);
  }

  // Keywords
  if (paper.keywords) {
    for (const kw of paper.keywords.split(/[,;]/)) {
      const trimmed = kw.trim();
      if (trimmed) lines.push(`KW  - ${escapeRis(trimmed)}`);
    }
  }

  // Abstract
  if (paper.abstract) {
    lines.push(`AB  - ${escapeRis(paper.abstract)}`);
  }

  // File path
  if (paper.file_path) {
    lines.push(`L1  - ${escapeRis(paper.file_path)}`);
  }

  lines.push("ER  -"); // End of record
  return lines.join("\n");
}

type RisExportResult =
  | { status: "cancelled" }
  | { status: "exported"; filePath: string };

export function exportPapersAsRis(papers: Paper[]): string {
  return papers.map(exportPaperAsRis).join("\n\n");
}

export async function savePaperRis(paper: Paper): Promise<RisExportResult> {
  await notifyBeforeExport("ris", { paper: paper as unknown as Record<string, unknown> });
  const defaultName = sanitizeFileName(
    `${paper.title || paper.file_name.replace(/\.pdf$/i, "")}.ris`,
    "ris",
  );
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "RIS", extensions: ["ris"] }],
  });

  if (!filePath) return { status: "cancelled" };

  const normalizedPath = filePath.toLowerCase().endsWith(".ris")
    ? filePath
    : `${filePath}.ris`;

  await invoke("write_text_file", {
    filePath: normalizedPath,
    content: exportPaperAsRis(paper),
  });

  return { status: "exported", filePath: normalizedPath };
}
