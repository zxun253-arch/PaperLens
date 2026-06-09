import { getDatabase } from "./database";
import type { PaperTag } from "../../types/paper";

function createId() {
  return `tag_${crypto.randomUUID()}`;
}

export async function listPaperTags(paperId: string): Promise<PaperTag[]> {
  try {
    const db = await getDatabase();
    return db.select<PaperTag[]>(
      "SELECT * FROM paper_tags WHERE paper_id = $1 ORDER BY tag ASC",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list paper tags", error);
    throw new Error("读取论文标签失败。");
  }
}

export async function listAllTags(): Promise<string[]> {
  try {
    const db = await getDatabase();
    const rows = await db.select<Array<{ tag: string }>>(
      "SELECT DISTINCT tag FROM paper_tags ORDER BY tag ASC",
    );
    return rows.map((row) => row.tag);
  } catch (error) {
    console.error("Failed to list all tags", error);
    throw new Error("读取标签列表失败。");
  }
}

export async function listTagsForPapers(
  paperIds: string[],
): Promise<Record<string, string[]>> {
  try {
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
  } catch (error) {
    console.error("Failed to list tags for papers", error);
    throw new Error("读取论文标签列表失败。");
  }
}

export async function addPaperTag(paperId: string, tag: string): Promise<void> {
  const cleanTag = tag.trim();
  if (!cleanTag) return;

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT OR IGNORE INTO paper_tags (id, paper_id, tag, created_at)
       VALUES ($1, $2, $3, $4)`,
      [createId(), paperId, cleanTag, new Date().toISOString()],
    );
  } catch (error) {
    console.error("Failed to add paper tag", error);
    throw new Error("添加论文标签失败。");
  }
}

export async function deletePaperTag(
  paperId: string,
  tag: string,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(
      "DELETE FROM paper_tags WHERE paper_id = $1 AND tag = $2",
      [paperId, tag],
    );
  } catch (error) {
    console.error("Failed to delete paper tag", error);
    throw new Error("删除论文标签失败。");
  }
}
