import type { PaperNoteType } from "../../types/paper";
import type { PromptType } from "../../lib/prompts";
import type { AiMode, AiSettings } from "../../lib/llm";
import { formatDate } from "../../utils/format";

const modeMessages: Record<AiMode, string> = {
  local_basic: "当前为本地基础模式，仅使用本地分析和笔记能力。",
  prompt_only: "当前为 Prompt 辅助模式，生成 Prompt 后请复制到外部 AI 工具。",
  custom_api: "当前为自定义大模型 API 模式，可在 App 内调用你配置的模型。",
  local_model: "当前为本地模型模式（预留）。",
};

export const promptTypeLabels: Record<PromptType, string> = {
  paper_metadata: "论文信息提取",
  reading_note: "中文精读笔记",
  paper_qa: "论文问答",
  literature_review: "文献综述辅助",
};

export const noteTypeLabels: Record<PaperNoteType, string> = {
  manual: "手动笔记",
  ai_paste: "外部 AI 回填结果",
  ai_generated: "AI 生成结果",
};

export const promptTypes: PromptType[] = [
  "paper_metadata",
  "reading_note",
  "paper_qa",
  "literature_review",
];

export { formatDate };

export function formatFileSize(size: number | null) {
  if (size === null) return "未记录";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function createNotePreview(content: string) {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

export function yesNo(value: boolean) {
  return value ? "是" : "否";
}

export function getModeMessage(settings: AiSettings | null) {
  if (!settings) return "正在读取处理模式...";
  return modeMessages[settings.mode] ?? modeMessages.custom_api;
}
