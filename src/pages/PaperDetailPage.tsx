import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { AiActionsPanel } from "../features/paper-detail/AiActionsPanel";
import { AiOutputHistoryPanel } from "../features/paper-detail/AiOutputHistoryPanel";
import { LocalAnalysisPanel } from "../features/paper-detail/LocalAnalysisPanel";
import { NoteEditorPanel } from "../features/paper-detail/NoteEditorPanel";
import { PaperChunkViewer } from "../features/paper-detail/PaperChunkViewer";
import { PaperInfoPanel } from "../features/paper-detail/PaperInfoPanel";
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
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          正在加载...
        </div>
      </section>
    );
  }

  if (!detail.paper) {
    return (
      <section>
        <PageHeader title="论文详情" description="未找到该论文记录。" />
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
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
      <Link
        className="mb-4 inline-block text-sm font-medium text-slate-600 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-300"
        to="/library"
      >
        ← 返回论文库
      </Link>
      <PageHeader
        title={detail.paper.title || detail.paper.file_name}
        description="围绕用户自定义 API 提供论文信息提取、精读笔记和论文问答。"
      />
      {detail.message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {detail.message}
        </div>
      ) : null}
      {detail.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {detail.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <PaperInfoPanel
          chunks={detail.chunks}
          hasChunks={detail.hasChunks}
          isExporting={detail.isExporting}
          isExportingWord={detail.isExportingWord}
          isExportingBibtex={detail.isExportingBibtex}
          isExportingRis={detail.isExportingRis}
          isParsing={detail.isParsing}
          onExportMarkdown={detail.handleExportMarkdown}
          onExportWord={detail.handleExportWord}
          onExportBibtex={detail.handleExportBibtex}
          onExportRis={detail.handleExportRis}
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
            canUseSemanticSearch={detail.canUseSemanticSearch}
            isSearching={detail.isSearching}
            isSemanticSearchEnabled={detail.isSemanticSearchEnabled}
            onSemanticSearchEnabledChange={detail.setIsSemanticSearchEnabled}
            onSearchQueryChange={detail.setSearchQuery}
            searchProgress={detail.searchProgress}
            searchQuery={detail.searchQuery}
            searchResults={detail.searchResults}
          />

          <article className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800" id="ai-actions-section">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                  API 辅助面板
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {getModeMessage(detail.aiSettings)}
                </p>
                {detail.aiSettings ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Provider：{providerLabel}；模型：
                    {detail.aiSettings.model || "未填写"}
                  </p>
                ) : null}
              </div>
              {detail.aiSettings ? (
                <span className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                  {aiModeLabels[detail.aiSettings.mode]}
                </span>
              ) : null}
            </div>

            {detail.aiSettings?.mode !== "custom_api" ? (
              <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                当前为「{detail.aiSettings ? aiModeLabels[detail.aiSettings.mode] : "未配置"}」。
                AI 论文功能仅在<strong>自定义大模型 API 模式</strong>下可用。
                请前往<Link className="font-semibold underline" to="/settings">设置页</Link>切换模式并配置 Provider。
              </div>
            ) : (
              <div className="mt-5 space-y-5">
              <AiActionsPanel
                aiGeneratedContent={detail.aiGeneratedContent}
                aiGeneratedTitle={detail.aiGeneratedTitle}
                aiQuestion={detail.aiQuestion}
                hasChunks={detail.hasChunks}
                isCallingAi={detail.isCallingAi}
                isParsing={detail.isParsing}
                isSavingNote={detail.isSavingNote}
                metadataRaw={detail.metadataRaw}
                onAiGeneratedContentChange={detail.setAiGeneratedContent}
                onAiQuestionChange={detail.setAiQuestion}
                onAskWithAi={detail.handleAskWithAi}
                onExtractMetadata={detail.handleExtractMetadata}
                onGenerateReadingNote={detail.handleGenerateReadingNote}
                onSaveAiGeneratedNote={detail.handleSaveAiGeneratedNote}
                onParsePdf={detail.handleParsePdf}
              />

              <NoteEditorPanel
                editingNoteId={detail.editingNoteId}
                isSavingNote={detail.isSavingNote}
                noteContent={detail.noteContent}
                noteTitle={detail.noteTitle}
                noteType={detail.noteType}
                notes={detail.notes}
                onAutoSaveNote={detail.autoSaveNote}
                onEditNote={detail.editNote}
                onNewNote={detail.resetNoteEditor}
                onNoteContentChange={detail.setNoteContent}
                onNoteTitleChange={detail.setNoteTitle}
                onNoteTypeChange={detail.setNoteType}
                onSaveNote={detail.saveNote}
              />

              <AiOutputHistoryPanel
                aiOutputs={detail.aiOutputs}
                onFollowUp={(question) => {
                  detail.setAiQuestion(question);
                  setTimeout(() => {
                    document.getElementById('ai-actions-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                onSaveAsNote={detail.saveAiOutputAsNote}
              />

              <QaPanel
                isCallingAi={detail.isCallingAi}
                onJumpToChunk={detail.jumpToChunk}
                onAskFollowUp={detail.handleAskFollowUp}
                onQaQuestionChange={detail.setQaQuestion}
                qaQuestion={detail.qaQuestion}
                qaHistory={detail.qaHistory}
              />
            </div>
          )}
          </article>
        </div>
      </div>
    </section>
  );
}
