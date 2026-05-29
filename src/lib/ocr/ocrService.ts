import type { OcrSupportStatus, ScannedPdfDetection } from "./types";

const suggestions = [
  "优先使用带文本层的 PDF。",
  "可以先用外部 OCR 工具处理后重新导入。",
  "后续版本将优先考虑本地 OCR 或用户自定义 OCR 服务，不默认上传 PDF 到云端。",
];

export function detectScannedPdf(extractedText: string): ScannedPdfDetection {
  const normalized = extractedText.replace(/\s+/g, "");
  return {
    likelyScanned: normalized.length < 200,
    reason:
      normalized.length < 200
        ? "PDF 文本层为空或过短，可能是扫描版 PDF 或图片型 PDF。"
        : "已检测到可用文本层。",
    suggestions,
  };
}

export function getOcrSupportStatus(): OcrSupportStatus {
  return {
    available: false,
    mode: "placeholder",
    message:
      "OCR 当前为预留能力，v0.3 不默认启用，也不会把 PDF 上传到任何云端 OCR 服务。",
    suggestions,
  };
}
