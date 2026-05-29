import { getDatabase } from "./database";
import type { LlmCallLog, LlmCallLogInput } from "../../types/paper";

function createId() {
  return `llm_log_${crypto.randomUUID()}`;
}

export async function listRecentLlmCallLogs(limit = 10): Promise<LlmCallLog[]> {
  try {
    const db = await getDatabase();
    return db.select<LlmCallLog[]>(
      "SELECT * FROM llm_call_logs ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
  } catch (error) {
    console.error("Failed to list LLM call logs", error);
    throw new Error("读取调用诊断日志失败。");
  }
}

export async function createLlmCallLog(input: LlmCallLogInput): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO llm_call_logs (
        id, provider, adapter, model, base_url, action, status, error_type, message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        createId(),
        input.provider,
        input.adapter,
        input.model ?? null,
        input.base_url ?? null,
        input.action,
        input.status,
        input.error_type ?? null,
        input.message ?? null,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    console.warn("Failed to write LLM call log", error);
  }
}

export async function clearLlmCallLogs(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM llm_call_logs");
  } catch (error) {
    console.error("Failed to clear LLM call logs", error);
    throw new Error("清空调用诊断日志失败。");
  }
}
