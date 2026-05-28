import type { PaperStatus } from "../types/paper";

const statusStyles: Record<PaperStatus, string> = {
  unparsed: "border-amber-200 bg-amber-50 text-amber-700",
  parsing: "border-cyan-200 bg-cyan-50 text-cyan-700",
  parsed: "border-sky-200 bg-sky-50 text-sky-700",
  parse_failed: "border-red-200 bg-red-50 text-red-700",
  noted: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statusLabels: Record<PaperStatus, string> = {
  unparsed: "未解析",
  parsing: "解析中",
  parsed: "已解析",
  parse_failed: "解析失败",
  noted: "已生成笔记",
};

type StatusBadgeProps = {
  status: PaperStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded border px-2.5 py-1 text-xs font-medium",
        statusStyles[status],
      ].join(" ")}
    >
      {statusLabels[status]}
    </span>
  );
}
