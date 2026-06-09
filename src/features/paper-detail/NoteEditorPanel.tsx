import { useAutoSave } from "../../hooks/useAutoSave";
import type { PaperNote, PaperNoteType } from "../../types/paper";
import { createNotePreview, formatDate, noteTypeLabels } from "./formatters";

interface NoteEditorPanelProps {
  notes: PaperNote[];
  editingNoteId: string | null;
  noteTitle: string;
  noteType: PaperNoteType;
  noteContent: string;
  isSavingNote: boolean;
  onEditNote: (note: PaperNote) => void;
  onNewNote: () => void;
  onNoteTitleChange: (value: string) => void;
  onNoteTypeChange: (value: PaperNoteType) => void;
  onNoteContentChange: (value: string) => void;
  onAutoSaveNote: (content: string) => Promise<void> | void;
  onSaveNote: () => void;
}

export function NoteEditorPanel({
  notes,
  editingNoteId,
  noteTitle,
  noteType,
  noteContent,
  isSavingNote,
  onEditNote,
  onNewNote,
  onNoteTitleChange,
  onNoteTypeChange,
  onNoteContentChange,
  onAutoSaveNote,
  onSaveNote,
}: NoteEditorPanelProps) {
  const autoSave = useAutoSave(
    editingNoteId ? noteContent : "",
    onAutoSaveNote,
  );

  return (
    <div className="rounded border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            阅读笔记
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            支持 Markdown 纯文本。AI 生成结果建议结合论文原文核对。
          </p>
        </div>
        <button
          className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
          onClick={onNewNote}
          type="button"
        >
          新建笔记
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-400">
              还没有阅读笔记。
            </div>
          ) : (
            notes.map((note) => (
              <button
                className={[
                  "w-full rounded border p-3 text-left transition",
                  editingNoteId === note.id
                    ? "border-cyan-700 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/50"
                    : "border-slate-200 bg-slate-50 hover:border-cyan-700 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-cyan-500",
                ].join(" ")}
                key={note.id}
                onClick={() => onEditNote(note)}
                type="button"
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {note.title}
                </span>
                <span className="mt-1 inline-flex rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  {noteTypeLabels[note.note_type]}
                </span>
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                  更新：{formatDate(note.updated_at)}
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {createNotePreview(note.note_content)}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                标题
              </span>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
                onChange={(event) => onNoteTitleChange(event.target.value)}
                type="text"
                value={noteTitle}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                笔记类型
              </span>
              <select
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
                onChange={(event) =>
                  onNoteTypeChange(event.target.value as PaperNoteType)
                }
                value={noteType}
              >
                <option value="manual">手动笔记</option>
                <option value="ai_paste">外部 AI 回填结果</option>
                <option value="ai_generated">AI 生成结果</option>
              </select>
            </label>
          </div>

          <textarea
            className="h-72 w-full resize-y rounded border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
            onChange={(event) => onNoteContentChange(event.target.value)}
            placeholder="在这里输入手动笔记，或粘贴外部 AI / App 内 AI 生成的结果..."
            value={noteContent}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:disabled:bg-cyan-900"
              disabled={isSavingNote}
              onClick={onSaveNote}
              type="button"
            >
              {isSavingNote
                ? "保存中..."
                : editingNoteId
                  ? "更新笔记"
                  : "保存笔记"}
            </button>
            {editingNoteId ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {autoSave.isSaving
                  ? "自动保存中..."
                  : autoSave.error
                    ? "自动保存失败"
                    : autoSave.lastSaved
                      ? "已保存"
                      : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
