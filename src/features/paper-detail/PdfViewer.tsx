import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";

interface PdfViewerProps {
  filePath: string | null;
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const embedRef = useRef<HTMLEmbedElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Start a timer to detect silent load failure (embed onError is unreliable)
    timeoutRef.current = setTimeout(() => {
      try {
        const doc = embedRef.current?.getSVGDocument?.();
        if (!doc) {
          setLoadError("无法加载 PDF，文件可能已被移动或损坏。");
        }
      } catch {
        setLoadError("无法加载 PDF，文件可能已被移动或损坏。");
      }
    }, 10000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [filePath]);

  if (!filePath) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        无可用 PDF 文件路径。
      </p>
    );
  }

  const assetUrl = useMemo(() => convertFileSrc(filePath), [filePath]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          系统原生渲染（Chrome PDF 引擎）
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200"
            disabled={scale <= 0.7}
            onClick={() => setScale((v) => Math.max(0.6, v - 0.1))}
            type="button"
          >
            缩小
          </button>
          <span className="min-w-14 text-center text-sm text-slate-600 dark:text-slate-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200"
            disabled={scale >= 2}
            onClick={() => setScale((v) => Math.min(2, v + 0.1))}
            type="button"
          >
            放大
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          PDF 加载失败：{loadError}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded border border-slate-200 dark:border-slate-700"
          style={{ height: "75vh" }}
        >
          <embed
            ref={embedRef}
            src={assetUrl}
            type="application/pdf"
            className="h-full w-full"
            style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
          />
        </div>
      )}
    </div>
  );
}
