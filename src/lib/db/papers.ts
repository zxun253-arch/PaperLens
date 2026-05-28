import { getDatabase } from "./database";
import type { CreatePaperInput, Paper } from "../../types/paper";

type UpdatePaperInput = Partial<Omit<CreatePaperInput, "id">>;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listPapers(): Promise<Paper[]> {
  try {
    const db = await getDatabase();
    return db.select<Paper[]>(
      "SELECT * FROM papers ORDER BY created_at DESC, updated_at DESC",
    );
  } catch (error) {
    console.error("Failed to list papers", error);
    throw new Error("读取论文列表失败。");
  }
}

export async function getPaperById(id: string): Promise<Paper | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<Paper[]>("SELECT * FROM papers WHERE id = $1", [
      id,
    ]);
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to get paper", error);
    throw new Error("读取论文详情失败。");
  }
}

export async function createPaper(input: CreatePaperInput): Promise<Paper> {
  const now = new Date().toISOString();
  const paper: Paper = {
    id: input.id ?? createId("paper"),
    title: input.title ?? null,
    authors: input.authors ?? null,
    year: input.year ?? null,
    journal: input.journal ?? null,
    file_name: input.file_name,
    file_path: input.file_path ?? null,
    file_size: input.file_size ?? null,
    abstract: input.abstract ?? null,
    keywords: input.keywords ?? null,
    paper_type: input.paper_type ?? null,
    research_field: input.research_field ?? null,
    status: input.status ?? "unparsed",
    created_at: now,
    updated_at: now,
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO papers (
        id, title, authors, year, journal, file_name, file_path, file_size,
        abstract, keywords, paper_type, research_field, status, created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        paper.id,
        paper.title,
        paper.authors,
        paper.year,
        paper.journal,
        paper.file_name,
        paper.file_path,
        paper.file_size,
        paper.abstract,
        paper.keywords,
        paper.paper_type,
        paper.research_field,
        paper.status,
        paper.created_at,
        paper.updated_at,
      ],
    );

    return paper;
  } catch (error) {
    console.error("Failed to create paper", error);
    throw new Error("创建论文记录失败。");
  }
}

export async function updatePaper(
  id: string,
  input: UpdatePaperInput,
): Promise<void> {
  const existing = await getPaperById(id);

  if (!existing) {
    throw new Error("论文记录不存在。");
  }

  const updated = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  try {
    const db = await getDatabase();
    await db.execute(
      `UPDATE papers SET
        title = $1,
        authors = $2,
        year = $3,
        journal = $4,
        file_name = $5,
        file_path = $6,
        file_size = $7,
        abstract = $8,
        keywords = $9,
        paper_type = $10,
        research_field = $11,
        status = $12,
        updated_at = $13
      WHERE id = $14`,
      [
        updated.title,
        updated.authors,
        updated.year,
        updated.journal,
        updated.file_name,
        updated.file_path,
        updated.file_size,
        updated.abstract,
        updated.keywords,
        updated.paper_type,
        updated.research_field,
        updated.status,
        updated.updated_at,
        id,
      ],
    );
  } catch (error) {
    console.error("Failed to update paper", error);
    throw new Error("更新论文记录失败。");
  }
}

export async function deletePaper(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM papers WHERE id = $1", [id]);
  } catch (error) {
    console.error("Failed to delete paper", error);
    throw new Error("删除论文记录失败。");
  }
}
