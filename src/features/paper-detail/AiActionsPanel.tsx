import { useState } from "react";
import { Spinner } from "../../components/Spinner";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";

interface AiActionsPanelProps {
  hasChunks: boolean;
  isCallingAi: boolean;
  isParsing: boolean;
  isSavingNote: boolean;
  metadataRaw: string;
  aiQuestion: string;
  aiGeneratedTitle: string;
  aiGeneratedContent: string;
  onAiQuestionChange: (value: string) => void;
  onAiGeneratedContentChange: (value: string) => void;
  onExtractMetadata: () => void;
  onGenerateReadingNote: () => void;
  onAskWithAi: () => void;
  onSaveAiGeneratedNote: () => void;
  onParsePdf: () => void;
}

export function AiActionsPanel({
  hasChunks,
  isCallingAi,
  isParsing,
  isSavingNote,
  metadataRaw,
  aiQuestion,
  aiGeneratedTitle,
  aiGeneratedContent,
  onAiQuestionChange,
  onAiGeneratedContentChange,
  onExtractMetadata,
  onGenerateReadingNote,
  onAskWithAi,
  onSaveAiGeneratedNote,
  onParsePdf,
}: AiActionsPanelProps) {
  const [isEditingGeneratedContent, setIsEditingGeneratedContent] = useState(false);

  const needsParse = !hasChunks && !isParsing;
  const isBusy = isCallingAi || isParsing;

  return (
    <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        API 论文智能处理
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        提取论文信息、生成精读笔记、论文问答。所有操作需要先解析 PDF。
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
            disabled={isBusy}
            onClick={() => {
              if (needsParse) { onParsePdf(); return; }
              onExtractMetadata();
            }}
            type="button"
          >
            {isBusy ? <><Spinner />处理中...</> : needsParse ? "先解析 PDF" : "提取论文信息"}
          </button>
          <button
            className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
            disabled={isBusy}
            onClick={() => {
              if (needsParse) { onParsePdf(); return; }
              onGenerateReadingNote();
            }}
            type="button"
          >
            {isBusy ? <><Spinner />处理中...</> : needsParse ? "先解析 PDF" : "生成中文精读笔记"}
          </button>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            论文问答
          </span>
          <textarea
            className="mt-2 h-32 w-full resize-y rounded border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
            onChange={(event) => onAiQuestionChange(event.target.value)}
            value={aiQuestion}
          />
        </label>
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500 dark:bg-slate-700 dark:hover:bg-cyan-700"
          disabled={isBusy}
          onClick={() => {
            if (needsParse) { onParsePdf(); return; }
            onAskWithAi();
          }}
          type="button"
        >
          {isBusy ? <><Spinner />处理中...</> : needsParse ? "先解析 PDF" : "基于论文回答"}
        </button>
      </div>

      {metadataRaw ? (
        <MarkdownRenderer
          className="mt-4 rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60"
          content={metadataRaw}
        />
      ) : null}

      {aiGeneratedContent ? (
        <div className="mt-5 rounded border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
                {aiGeneratedTitle}
              </h4>
              <p className="mt-2 text-xs text-cyan-800 dark:text-cyan-200">
                API 生成内容仅作为论文辅助，请结合原文核对后再用于正式写作。
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className="rounded border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-500 dark:text-cyan-100 dark:hover:bg-cyan-950"
                onClick={() =>
                  setIsEditingGeneratedContent((current) => !current)
                }
                type="button"
              >
                {isEditingGeneratedContent ? "查看" : "编辑"}
              </button>
              <button
                className="rounded border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-500 dark:text-cyan-100 dark:hover:bg-cyan-950"
                onClick={() =>
                  void navigator.clipboard.writeText(aiGeneratedContent)
                }
                type="button"
              >
                复制
              </button>
            </div>
          </div>

          {isEditingGeneratedContent ? (
            <textarea
              className="mt-3 h-64 w-full resize-y rounded border border-cyan-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-cyan-900/70 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
              onChange={(event) =>
                onAiGeneratedContentChange(event.target.value)
              }
              value={aiGeneratedContent}
            />
          ) : (
            <MarkdownRenderer
              className="mt-3 rounded border border-cyan-100 bg-white p-4 dark:border-cyan-900/70 dark:bg-slate-950"
              content={aiGeneratedContent}
            />
          )}

          <button
            className="mt-3 rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:disabled:bg-cyan-900"
            disabled={isSavingNote}
            onClick={onSaveAiGeneratedNote}
            type="button"
          >
            保存为阅读笔记
          </button>
        </div>
      ) : null}
    </div>
  );
}
