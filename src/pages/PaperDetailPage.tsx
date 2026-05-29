import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { AiActionsPanel } from "../features/paper-detail/AiActionsPanel";
import { AiOutputHistoryPanel } from "../features/paper-detail/AiOutputHistoryPanel";
import { LocalAnalysisPanel } from "../features/paper-detail/LocalAnalysisPanel";
import { NoteEditorPanel } from "../features/paper-detail/NoteEditorPanel";
import { PaperChunkViewer } from "../features/paper-detail/PaperChunkViewer";
import { PaperInfoPanel } from "../features/paper-detail/PaperInfoPanel";
import { PromptWorkflowPanel } from "../features/paper-detail/PromptWorkflowPanel";
import { QaPanel } from "../features/paper-detail/QaPanel";
import { getModeMessage } from "../features/paper-detail/formatters";
import { usePaperDetailData } from "../features/paper-detail/usePaperDetailData";
import { aiModeLabels, getProviderConfig } from "../lib/llm";

export function PaperDetailPage() {
  const detail = usePaperDetailData();

  if (detail.isLoading) {
    return (
      <section>
        <PageHeader title="论文详情" description="正在读取论文记录..." />
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
          正在加载...
        </div>
      </section>
    );
  }

  if (!detail.paper) {
    return (
      <section>
        <PageHeader title="论文详情" description="未找到该论文记录。" />
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            未找到该论文记录。
          </h2>
          <Link
            className="mt-5 inline-flex rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
            to="/library"
          >
            返回论文库
          </Link>
        </div>
      </section>
    );
  }

  const providerLabel = detail.aiSettings
    ? getProviderConfig(detail.aiSettings.provider).label
    : "未读取";

  return (
    <section>
      <PageHeader
        title={detail.paper.title || detail.paper.file_name}
        description="支持本地分析、Prompt 工作流、自定义 API 增强、阅读笔记和 Markdown / Word 导出。"
      />
      {detail.message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {detail.message}
        </div>
      ) : null}
      {detail.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {detail.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <PaperInfoPanel
          chunks={detail.chunks}
          hasChunks={detail.hasChunks}
          isExporting={detail.isExporting}
          isExportingWord={detail.isExportingWord}
          isParsing={detail.isParsing}
          onExportMarkdown={detail.handleExportMarkdown}
          onExportWord={detail.handleExportWord}
          onNewNote={() =>
            detail.setNoteContent((value) => value || "## 阅读笔记\n\n")
          }
          onOpenOriginalPdf={detail.handleOpenOriginalPdf}
          onParsePdf={detail.handleParsePdf}
          paper={detail.paper}
        />

        <div className="space-y-6">
          <PaperChunkViewer
            chunks={detail.chunks}
            hasChunks={detail.hasChunks}
            highlightedChunkId={detail.highlightedChunkId}
          />

          <LocalAnalysisPanel
            analysis={detail.analysis}
            onSearchQueryChange={detail.setSearchQuery}
            searchQuery={detail.searchQuery}
            searchResults={detail.searchResults}
          />

          <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  辅助面板
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {getModeMessage(detail.aiSettings)}
                </p>
                {detail.aiSettings ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Provider：{providerLabel}；模型：
                    {detail.aiSettings.model || "未填写"}
                  </p>
                ) : null}
              </div>
              {detail.aiSettings ? (
                <span className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
                  {aiModeLabels[detail.aiSettings.mode]}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-5">
              <PromptWorkflowPanel
                hasChunks={detail.hasChunks}
                onBuildPrompt={detail.handleBuildPrompt}
                onCopyPrompt={detail.handleCopyPrompt}
                onPromptTypeChange={detail.setPromptType}
                onQuestionChange={detail.setQuestion}
                promptResult={detail.promptResult}
                promptType={detail.promptType}
                question={detail.question}
              />

              <AiActionsPanel
                aiGeneratedContent={detail.aiGeneratedContent}
                aiGeneratedTitle={detail.aiGeneratedTitle}
                aiQuestion={detail.aiQuestion}
                canUseCustomApi={detail.canUseCustomApi}
                hasChunks={detail.hasChunks}
                isCallingAi={detail.isCallingAi}
                isSavingNote={detail.isSavingNote}
                metadataRaw={detail.metadataRaw}
                onAiGeneratedContentChange={detail.setAiGeneratedContent}
                onAiQuestionChange={detail.setAiQuestion}
                onAskWithAi={detail.handleAskWithAi}
                onExtractMetadata={detail.handleExtractMetadata}
                onGenerateReadingNote={detail.handleGenerateReadingNote}
                onSaveAiGeneratedNote={detail.handleSaveAiGeneratedNote}
              />

              <NoteEditorPanel
                editingNoteId={detail.editingNoteId}
                isSavingNote={detail.isSavingNote}
                noteContent={detail.noteContent}
                noteTitle={detail.noteTitle}
                noteType={detail.noteType}
                notes={detail.notes}
                onEditNote={detail.editNote}
                onNewNote={detail.resetNoteEditor}
                onNoteContentChange={detail.setNoteContent}
                onNoteTitleChange={detail.setNoteTitle}
                onNoteTypeChange={detail.setNoteType}
                onSaveNote={detail.saveNote}
              />

              <AiOutputHistoryPanel
                aiOutputs={detail.aiOutputs}
                onSaveAsNote={detail.saveAiOutputAsNote}
              />

              <QaPanel
                onJumpToChunk={detail.jumpToChunk}
                qaHistory={detail.qaHistory}
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
