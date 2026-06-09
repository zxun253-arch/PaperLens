import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  OcrOptions,
  OcrProgress,
  OcrResult,
  OcrSupportStatus,
  ScannedPdfDetection,
} from "./types";

const suggestions = [
  "优先使用带文本层的 PDF。",
  "扫描版 PDF 会尝试使用本地 Tesseract OCR 识别。",
  "OCR 在本机运行，不会默认上传 PDF 到云端 OCR 服务。",
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

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}

function toTesseractLanguages(languages: string[] | undefined): string {
  return languages?.length ? languages.join("+") : "eng+chi_sim";
}

function reportProgress(
  onProgress: OcrOptions["onProgress"],
  progress: OcrProgress,
) {
  onProgress?.({
    status: progress.status,
    progress: clampProgress(progress.progress),
  });
}

export async function recognizePdfWithTesseract(
  filePath: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  if (!filePath.trim()) {
    throw new Error("文件路径为空。");
  }

  const language = toTesseractLanguages(options.languages);

  if (options.pageRange) {
    console.warn(
      "OCR pageRange is not applied yet because the current Tesseract path recognizes the supplied PDF as one input.",
      options.pageRange,
    );
  }

  reportProgress(options.onProgress, {
    status: "initializing",
    progress: 0,
  });

  // 动态加载 tesseract.js，不阻塞首屏
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language, 1, {
    logger: (message) => {
      reportProgress(options.onProgress, {
        status: message.status,
        progress: message.progress,
      });
    },
  });

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(convertFileSrc(filePath));

    return {
      text: text.trim(),
      language,
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}

export function getOcrSupportStatus(): OcrSupportStatus {
  return {
    available: true,
    mode: "tesseract",
    message: "OCR 已启用，将使用本地 Tesseract 识别扫描版 PDF。",
    suggestions,
  };
}
