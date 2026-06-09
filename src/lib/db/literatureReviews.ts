import { getDatabase } from "./database";
import type {
  LiteratureReview,
  LiteratureReviewInput,
} from "../../types/paper";

function createId() {
  return `review_${crypto.randomUUID()}`;
}

export async function listLiteratureReviews(): Promise<LiteratureReview[]> {
  try {
    const db = await getDatabase();
    return db.select<LiteratureReview[]>(
      "SELECT * FROM literature_reviews ORDER BY updated_at DESC",
    );
  } catch (error) {
    console.error("Failed to list literature reviews", error);
    throw new Error("读取文献综述列表失败。");
  }
}

export async function createLiteratureReview(
  input: LiteratureReviewInput,
): Promise<LiteratureReview> {
  const now = new Date().toISOString();
  const review: LiteratureReview = {
    id: createId(),
    title: input.title.trim() || "文献综述草稿",
    paper_ids: JSON.stringify(input.paper_ids),
    content: input.content,
    created_at: now,
    updated_at: now,
  };
  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO literature_reviews (id, title, paper_ids, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        review.id,
        review.title,
        review.paper_ids,
        review.content,
        review.created_at,
        review.updated_at,
      ],
    );
    return review;
  } catch (error) {
    console.error("Failed to create literature review", error);
    throw new Error("创建文献综述失败。");
  }
}

export async function updateLiteratureReview(
  id: string,
  input: Partial<Pick<LiteratureReviewInput, "title" | "content">>,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(
      `UPDATE literature_reviews
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = $3
       WHERE id = $4`,
      [
        input.title ?? null,
        input.content ?? null,
        new Date().toISOString(),
        id,
      ],
    );
  } catch (error) {
    console.error("Failed to update literature review", error);
    throw new Error("更新文献综述失败。");
  }
}

export async function deleteLiteratureReview(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute("DELETE FROM literature_reviews WHERE id = $1", [id]);
  } catch (error) {
    console.error("Failed to delete literature review", error);
    throw new Error("删除文献综述失败。");
  }
}
