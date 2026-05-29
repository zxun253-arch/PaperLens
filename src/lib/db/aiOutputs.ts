import { getDatabase } from "./database";
import type {
  AiOutput,
  AiOutputInput,
  AiOutputUpdateInput,
} from "../../types/paper";

function createId() {
  return `ai_output_${crypto.randomUUID()}`;
}

export async function listAiOutputsByPaper(
  paperId: string,
): Promise<AiOutput[]> {
  try {
    const db = await getDatabase();
    return db.select<AiOutput[]>(
      "SELECT * FROM ai_outputs WHERE paper_id = $1 ORDER BY created_at DESC",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list AI outputs", error);
    throw new Error("读取 AI 结果历史失败。");
  }
}

export async function getAiOutputById(id: string): Promise<AiOutput | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<AiOutput[]>(
      "SELECT * FROM ai_outputs WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to get AI output", error);
    throw new Error("读取 AI 结果详情失败。");
  }
}

export async function createAiOutput(input: AiOutputInput): Promise<AiOutput> {
  const now = new Date().toISOString();
  const output: AiOutput = {
    id: createId(),
    paper_id: input.paper_id,
    action: input.action,
    provider: input.provider,
    model: input.model ?? null,
    title: input.title,
    content: input.content,
    structured_json: input.structured_json ?? null,
    source_chunk_ids: input.source_chunk_ids ?? null,
    status: input.status,
    created_at: now,
    updated_at: now,
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO ai_outputs (
        id, paper_id, action, provider, model, title, content, structured_json,
        source_chunk_ids, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        output.id,
        output.paper_id,
        output.action,
        output.provider,
        output.model,
        output.title,
        output.content,
        output.structured_json,
        output.source_chunk_ids,
        output.status,
        output.created_at,
        output.updated_at,
      ],
    );
    return output;
  } catch (error) {
    console.error("Failed to create AI output", error);
    throw new Error("保存 AI 结果历史失败。");
  }
}

export async function updateAiOutput(
  id: string,
  input: AiOutputUpdateInput,
): Promise<void> {
  const existing = await getAiOutputById(id);
  if (!existing) throw new Error("AI 结果记录不存在。");

  const updated = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `UPDATE ai_outputs SET
        title = $1,
        content = $2,
        structured_json = $3,
        source_chunk_ids = $4,
        status = $5,
        updated_at = $6
      WHERE id = $7`,
      [
        updated.title,
        updated.content,
        updated.structured_json,
        updated.source_chunk_ids,
        updated.status,
        updated.updated_at,
        id,
      ],
    );
  } catch (error) {
    console.error("Failed to update AI output", error);
    throw new Error("更新 AI 结果历史失败。");
  }
}

export async function deleteAiOutput(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM ai_outputs WHERE id = $1", [id]);
  } catch (error) {
    console.error("Failed to delete AI output", error);
    throw new Error("删除 AI 结果历史失败。");
  }
}
