interface AiActionsPanelProps {
  canUseCustomApi: boolean;
  hasChunks: boolean;
  isCallingAi: boolean;
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
}

export function AiActionsPanel({
  canUseCustomApi,
  hasChunks,
  isCallingAi,
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
}: AiActionsPanelProps) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-950">App 内 AI 功能</h3>
      {!canUseCustomApi ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          当前不是自定义大模型 API 模式，不会调用模型。需要 App
          内自动提取、精读和问答时，请先到设置页配置自己的 API。
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
              disabled={isCallingAi || !hasChunks}
              onClick={onExtractMetadata}
              type="button"
            >
              提取论文信息
            </button>
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
              disabled={isCallingAi || !hasChunks}
              onClick={onGenerateReadingNote}
              type="button"
            >
              生成精读笔记
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">论文问答</span>
            <textarea
              className="mt-2 h-20 w-full resize-y rounded border border-slate-300 bg-white p-3 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
              onChange={(event) => onAiQuestionChange(event.target.value)}
              value={aiQuestion}
            />
          </label>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            disabled={isCallingAi || !hasChunks}
            onClick={onAskWithAi}
            type="button"
          >
            {isCallingAi ? "调用中..." : "基于论文回答"}
          </button>
        </div>
      )}
      {metadataRaw ? (
        <textarea
          className="mt-4 h-40 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-6 text-slate-700"
          readOnly
          value={metadataRaw}
        />
      ) : null}
      {aiGeneratedContent ? (
        <div className="mt-5 rounded border border-cyan-200 bg-cyan-50 p-4">
          <h4 className="text-sm font-semibold text-cyan-950">
            {aiGeneratedTitle}
          </h4>
          <p className="mt-2 text-xs text-cyan-800">
            AI 生成内容请结合论文原文核对后再用于正式写作。
          </p>
          <textarea
            className="mt-3 h-64 w-full resize-y rounded border border-cyan-200 bg-white p-3 text-sm leading-6 text-slate-800"
            onChange={(event) => onAiGeneratedContentChange(event.target.value)}
            value={aiGeneratedContent}
          />
          <button
            className="mt-3 rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
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
