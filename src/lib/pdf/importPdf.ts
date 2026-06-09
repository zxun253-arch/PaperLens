import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { createPaper } from "../db/papers";
import type { Paper } from "../../types/paper";

type FileInfo = {
  file_name: string;
  file_size: number;
};

export type ImportPdfResult =
  | { status: "cancelled" }
  | { status: "imported"; paper: Paper };

type ImportPdfSource = string | File;

export async function openPdfFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "PDF 文件", extensions: ["pdf"] }],
  });

  if (!selected) {
    return null;
  }

  if (Array.isArray(selected)) {
    return selected[0] ?? null;
  }

  return selected;
}

export async function openPdfFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "PDF 鏂囦欢", extensions: ["pdf"] }],
  });

  if (!selected) {
    return [];
  }

  return Array.isArray(selected) ? selected : [selected];
}

export function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1];

  if (!fileName) {
    throw new Error("无法解析文件名。");
  }

  return fileName;
}

function ensurePdfPath(filePath: string) {
  if (!filePath.trim()) {
    throw new Error("文件路径为空。");
  }

  if (!filePath.toLowerCase().endsWith(".pdf")) {
    throw new Error("请选择 PDF 文件。");
  }
}

async function getPdfFileInfo(filePath: string): Promise<FileInfo> {
  try {
    return await invoke<FileInfo>("get_file_info", { path: filePath });
  } catch (error) {
    console.error("Failed to get PDF file info", error);
    throw new Error(
      error instanceof Error ? error.message : "获取文件信息失败。",
    );
  }
}

function getBrowserFilePath(file: File): string | null {
  const fileWithPath = file as File & { path?: unknown };

  return typeof fileWithPath.path === "string" && fileWithPath.path.trim()
    ? fileWithPath.path
    : null;
}

export async function importPdfAsPaper(
  source?: ImportPdfSource,
): Promise<ImportPdfResult> {
  if (source instanceof File) {
    if (!source.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("请选择 PDF 文件。");
    }

    const filePath = getBrowserFilePath(source);
    const fileInfo = filePath
      ? await getPdfFileInfo(filePath)
      : { file_name: source.name, file_size: source.size };
    const fileName = fileInfo.file_name || source.name;

    const paper = await createPaper({
      title: fileName.replace(/\.pdf$/i, ""),
      file_name: fileName,
      file_path: filePath,
      file_size: fileInfo.file_size,
      status: "unparsed",
    });

    return { status: "imported", paper };
  }

  const filePath = source ?? (await openPdfFile());

  if (!filePath) {
    return { status: "cancelled" };
  }

  ensurePdfPath(filePath);

  const fileInfo = await getPdfFileInfo(filePath);
  const fileName = fileInfo.file_name || getFileNameFromPath(filePath);

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("请选择 PDF 文件。");
  }

  const paper = await createPaper({
    title: fileName.replace(/\.pdf$/i, ""),
    file_name: fileName,
    file_path: filePath,
    file_size: fileInfo.file_size,
    status: "unparsed",
  });

  return { status: "imported", paper };
}

export async function importPdfPathAsPaper(filePath: string): Promise<Paper> {
  ensurePdfPath(filePath);

  const fileInfo = await getPdfFileInfo(filePath);
  const fileName = fileInfo.file_name || getFileNameFromPath(filePath);

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("请选择 PDF 文件。");
  }

  return createPaper({
    title: fileName.replace(/\.pdf$/i, ""),
    file_name: fileName,
    file_path: filePath,
    file_size: fileInfo.file_size,
    status: "unparsed",
  });
}

export async function batchImportPdf(
  files: string[],
  onProgress: (current: number, total: number) => void,
): Promise<Paper[]> {
  const results: Paper[] = [];
  const total = files.length;

  for (const [index, filePath] of files.entries()) {
    onProgress(index + 1, total);
    results.push(await importPdfPathAsPaper(filePath));
  }

  return results;
}
