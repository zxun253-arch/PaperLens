export interface OcrSupportStatus {
  available: boolean;
  mode: "tesseract";
  message: string;
  suggestions: string[];
}

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrOptions {
  languages?: string[];
  pageRange?: {
    from: number;
    to: number;
  };
  onProgress?: (progress: OcrProgress) => void;
}

export interface OcrResult {
  text: string;
  language: string;
  confidence?: number;
}

export interface ScannedPdfDetection {
  likelyScanned: boolean;
  reason: string;
  suggestions: string[];
}
