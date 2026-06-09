import { getDatabase } from "./database";
import type { PaperAnnotation } from "../../types/paper";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listPaperAnnotations(
  paperId: string,
): Promise<PaperAnnotation[]> {
  try {
    const db = await getDatabase();
    return db.select<PaperAnnotation[]>(
      `SELECT * FROM paper_annotations WHERE paper_id = $1
       ORDER BY created_at DESC`,
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list annotations", error);
    throw new Error("读取论文标注失败。");
  }
}

export async function getPaperAnnotationById(
  id: string,
): Promise<PaperAnnotation | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<PaperAnnotation[]>(
      "SELECT * FROM paper_annotations WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to get annotation", error);
    throw new Error("读取论文标注失败。");
  }
}

export async function createPaperAnnotation(
  input: Omit<PaperAnnotation, "id" | "created_at" | "updated_at">,
): Promise<PaperAnnotation> {
  const now = new Date().toISOString();
  const annotation: PaperAnnotation = {
    id: createId("anno"),
    paper_id: input.paper_id,
    chunk_id: input.chunk_id ?? null,
    annotation_type: input.annotation_type ?? "highlight",
    color: input.color ?? "#FFFF00",
    start_offset: input.start_offset ?? null,
    end_offset: input.end_offset ?? null,
    selected_text: input.selected_text ?? null,
    note: input.note ?? null,
    created_at: now,
    updated_at: now,
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO paper_annotations (
        id, paper_id, chunk_id, annotation_type, color,
        start_offset, end_offset, selected_text, note,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        annotation.id,
        annotation.paper_id,
        annotation.chunk_id,
        annotation.annotation_type,
        annotation.color,
        annotation.start_offset,
        annotation.end_offset,
        annotation.selected_text,
        annotation.note,
        annotation.created_at,
        annotation.updated_at,
      ],
    );
    return annotation;
  } catch (error) {
    console.error("Failed to create annotation", error);
    throw new Error("创建论文标注失败。");
  }
}

export async function deletePaperAnnotation(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM paper_annotations WHERE id = $1", [id]);
  } catch (error) {
    console.error("Failed to delete annotation", error);
    throw new Error("删除论文标注失败。");
  }
}

export async function deleteAnnotationsByPaper(
  paperId: string,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(
      "DELETE FROM paper_annotations WHERE paper_id = $1",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to delete annotations for paper", error);
    throw new Error("清除论文标注失败。");
  }
}

export async function updatePaperAnnotation(
  id: string,
  fields: Partial<Pick<PaperAnnotation, "color" | "note" | "annotation_type">>,
): Promise<void> {
  const now = new Date().toISOString();
  const entries: Array<[string, unknown]> = [];

  if (fields.color !== undefined) entries.push(["color", fields.color]);
  if (fields.note !== undefined) entries.push(["note", fields.note]);
  if (fields.annotation_type !== undefined) entries.push(["annotation_type", fields.annotation_type]);

  if (entries.length === 0) return;

  entries.push(["updated_at", now]);

  const setClause = entries
    .map(([col], idx) => `${col} = $${idx + 1}`)
    .join(", ");
  const values = entries.map(([, val]) => val);
  values.push(id);

  try {
    const db = await getDatabase();
    await db.execute(
      `UPDATE paper_annotations SET ${setClause} WHERE id = $${entries.length + 1}`,
      values,
    );
  } catch (error) {
    console.error("Failed to update annotation", error);
    throw new Error("更新论文标注失败。");
  }
}
