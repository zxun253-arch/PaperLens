export interface OcrSupportStatus {
  available: boolean;
  mode: "placeholder";
  message: string;
  suggestions: string[];
}

export interface ScannedPdfDetection {
  likelyScanned: boolean;
  reason: string;
  suggestions: string[];
}
