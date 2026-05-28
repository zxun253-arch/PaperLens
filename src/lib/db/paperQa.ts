import { getDatabase } from "./database";
import type { PaperQa, PaperQaInput } from "../../types/paper";

function createId() {
  return `qa_${crypto.randomUUID()}`;
}

export async function listPaperQa(paperId: string): Promise<PaperQa[]> {
  try {
    const db = await getDatabase();
    return db.select<PaperQa[]>(
      "SELECT * FROM paper_qa WHERE paper_id = $1 ORDER BY created_at DESC",
      [paperId],
    );
  } catch (error) {
    console.error("Failed to list paper QA", error);
    throw new Error("读取论文问答记录失败。");
  }
}

export async function createPaperQa(input: PaperQaInput): Promise<PaperQa> {
  const qa: PaperQa = {
    id: createId(),
    paper_id: input.paper_id,
    question: input.question,
    answer: input.answer,
    evidence: input.evidence ?? null,
    created_at: new Date().toISOString(),
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO paper_qa (
        id, paper_id, question, answer, evidence, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [qa.id, qa.paper_id, qa.question, qa.answer, qa.evidence, qa.created_at],
    );
    return qa;
  } catch (error) {
    console.error("Failed to create paper QA", error);
    throw new Error("保存论文问答记录失败。");
  }
}

export async function deletePaperQa(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM paper_qa WHERE id = $1", [id]);
  } catch (error) {
    console.error("Failed to delete paper QA", error);
    throw new Error("删除论文问答记录失败。");
  }
}
