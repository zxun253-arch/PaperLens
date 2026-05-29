import { getDatabase } from "./database";
import type { PaperTag } from "../../types/paper";

function createId() {
  return `tag_${crypto.randomUUID()}`;
}

export async function listPaperTags(paperId: string): Promise<PaperTag[]> {
  const db = await getDatabase();
  return db.select<PaperTag[]>(
    "SELECT * FROM paper_tags WHERE paper_id = $1 ORDER BY tag ASC",
    [paperId],
  );
}

export async function listAllTags(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ tag: string }>>(
    "SELECT DISTINCT tag FROM paper_tags ORDER BY tag ASC",
  );
  return rows.map((row) => row.tag);
}

export async function listTagsForPapers(
  paperIds: string[],
): Promise<Record<string, string[]>> {
  if (paperIds.length === 0) return {};
  const db = await getDatabase();
  const placeholders = paperIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.select<Array<{ paper_id: string; tag: string }>>(
    `SELECT paper_id, tag FROM paper_tags WHERE paper_id IN (${placeholders}) ORDER BY tag ASC`,
    paperIds,
  );
  return rows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.paper_id] = [...(acc[row.paper_id] ?? []), row.tag];
    return acc;
  }, {});
}

export async function addPaperTag(paperId: string, tag: string): Promise<void> {
  const cleanTag = tag.trim();
  if (!cleanTag) return;

  const db = await getDatabase();
  await db.execute(
    `INSERT OR IGNORE INTO paper_tags (id, paper_id, tag, created_at)
     VALUES ($1, $2, $3, $4)`,
    [createId(), paperId, cleanTag, new Date().toISOString()],
  );
}

export async function deletePaperTag(
  paperId: string,
  tag: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM paper_tags WHERE paper_id = $1 AND tag = $2", [
    paperId,
    tag,
  ]);
}
