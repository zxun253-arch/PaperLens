import { getDatabase } from "./database";
import { updatePaper } from "./papers";
import type { PaperChunk, PaperChunkInput } from "../../types/paper";

function createId() {
  return `chunk_${crypto.randomUUID()}`;
}

export async function listPaperChunks(paperId: string): Promise<PaperChunk[]> {
  try {
    const db = await getDatabase();
    return db.select<PaperChunk[]>(
      "SELECT * FROM paper_chunks WHERE paper_id = $1 ORDER BY chunk_index ASC",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list paper chunks", error);
    throw new Error("读取论文分块失败。");
  }
}

export async function deletePaperChunksByPaperId(
  paperId: string,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM paper_chunks WHERE paper_id = $1", [paperId]);
  } catch (error) {
    console.error("Failed to delete paper chunks", error);
    throw new Error("删除旧论文分块失败。");
  }
}

export async function createPaperChunks(
  paperId: string,
  chunks: PaperChunkInput[],
): Promise<void> {
  if (chunks.length === 0) {
    throw new Error("没有可写入的论文分块。");
  }

  try {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const chunk of chunks) {
      await db.execute(
        `INSERT INTO paper_chunks (
          id, paper_id, chunk_index, section_title, content, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId(),
          paperId,
          chunk.chunk_index,
          chunk.section_title,
          chunk.content,
          now,
        ],
      );
    }
  } catch (error) {
    console.error("Failed to create paper chunks", error);
    throw new Error("写入论文分块失败。");
  }
}

export async function replacePaperChunks(
  paperId: string,
  chunks: PaperChunkInput[],
): Promise<void> {
  await deletePaperChunksByPaperId(paperId);
  await createPaperChunks(paperId, chunks);
  await updatePaper(paperId, { status: "parsed" });
}
