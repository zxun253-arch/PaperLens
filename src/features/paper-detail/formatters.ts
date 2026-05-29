import type { PaperNoteType } from "../../types/paper";
import type { PromptType } from "../../lib/prompts";
import type { AiSettings } from "../../lib/llm";

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

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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
  if (settings.mode === "local_basic") {
    return "当前为本地基础模式，可使用本地分析、Prompt、笔记和导出功能，不会调用模型。";
  }
  if (settings.mode === "prompt_only") {
    return "当前为 Prompt 辅助模式，可复制 Prompt 到外部 AI 工具使用。";
  }
  if (settings.mode === "custom_api") {
    return "当前为自定义大模型 API 模式，可在 App 内调用你配置的模型。";
  }
  return "本地模型模式后续支持 Ollama / LM Studio。";
}
