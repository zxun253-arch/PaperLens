import { getDatabase } from "./database";
import type {
  PaperNote,
  PaperNoteInput,
  PaperNoteUpdateInput,
} from "../../types/paper";

function createId() {
  return `note_${crypto.randomUUID()}`;
}

export async function listPaperNotes(paperId: string): Promise<PaperNote[]> {
  try {
    const db = await getDatabase();
    return db.select<PaperNote[]>(
      "SELECT * FROM paper_notes WHERE paper_id = $1 ORDER BY updated_at DESC, created_at DESC",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list paper notes", error);
    throw new Error("读取阅读笔记失败。");
  }
}

export async function getPaperNoteById(noteId: string): Promise<PaperNote | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<PaperNote[]>(
      "SELECT * FROM paper_notes WHERE id = $1",
      [noteId],
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to get paper note", error);
    throw new Error("读取阅读笔记详情失败。");
  }
}

export async function createPaperNote(input: PaperNoteInput): Promise<PaperNote> {
  const now = new Date().toISOString();
  const note: PaperNote = {
    id: createId(),
    paper_id: input.paper_id,
    note_type: input.note_type,
    title: input.title.trim() || "阅读笔记",
    note_content: input.note_content,
    created_at: now,
    updated_at: now,
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO paper_notes (
        id, paper_id, note_type, title, note_content, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        note.id,
        note.paper_id,
        note.note_type,
        note.title,
        note.note_content,
        note.created_at,
        note.updated_at,
      ],
    );
    return note;
  } catch (error) {
    console.error("Failed to create paper note", error);
    throw new Error("保存阅读笔记失败。");
  }
}

export async function updatePaperNote(
  noteId: string,
  input: PaperNoteUpdateInput,
): Promise<void> {
  const existing = await getPaperNoteById(noteId);

  if (!existing) {
    throw new Error("阅读笔记不存在。");
  }

  const updated = {
    ...existing,
    ...input,
    title: input.title?.trim() || existing.title || "阅读笔记",
    updated_at: new Date().toISOString(),
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `UPDATE paper_notes SET
        note_type = $1,
        title = $2,
        note_content = $3,
        updated_at = $4
      WHERE id = $5`,
      [
        updated.note_type,
        updated.title,
        updated.note_content,
        updated.updated_at,
        noteId,
      ],
    );
  } catch (error) {
    console.error("Failed to update paper note", error);
    throw new Error("更新阅读笔记失败。");
  }
}

export async function deletePaperNote(noteId: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM paper_notes WHERE id = $1", [noteId]);
  } catch (error) {
    console.error("Failed to delete paper note", error);
    throw new Error("删除阅读笔记失败。");
  }
}
