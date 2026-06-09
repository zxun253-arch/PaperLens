export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function yesNo(value: boolean) {
  return value ? "是" : "否";
}

export function sanitizeFileName(
  name: string,
  extension?: "md" | "docx" | "bib" | "ris",
): string {
  const clean =
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "文献透镜-论文";
  if (!extension) return clean;
  const ext = extension === "md" ? ".md" : extension === "bib" ? ".bib" : extension === "ris" ? ".ris" : ".docx";
  return clean.toLowerCase().endsWith(ext) ? clean : `${clean}${ext}`;
}

export function fallback(
  value: string | null | undefined,
  emptyText = "未填写",
) {
  return value?.trim() ? value : emptyText;
}

export function createPrefixedId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
