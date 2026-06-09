import { getDatabase } from "./database";
import type {
  GlobalSearchResult,
  GlobalSearchHitType,
} from "../../types/paper";

function makeSnippet(value: string | null | undefined, query: string) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, 180);
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + query.length + 110);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function resultId(type: GlobalSearchHitType, id: string) {
  return `${type}_${id}`;
}

/** Convert user plain-text query into FTS5 MATCH syntax */
function buildFts5Query(keyword: string): string {
  const terms = keyword
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      // Escape any double-quotes inside the term
      const clean = t.replace(/"/g, "");
      // Use prefix matching for better UX
      return `"${clean}"*`;
    });
  return terms.join(" AND ");
}

export async function globalSearch(
  query: string,
  limit = 80,
): Promise<GlobalSearchResult[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const db = await getDatabase();
  const like = `%${keyword}%`;
  const results: GlobalSearchResult[] = [];

  // ——— Papers ———
  const papers = await db.select<
    Array<{
      id: string;
      title: string | null;
      file_name: string;
      abstract: string | null;
      authors: string | null;
      keywords: string | null;
      created_at: string;
    }>
  >(
    `SELECT id, title, file_name, abstract, authors, keywords, created_at
     FROM papers
     WHERE title LIKE $1 OR file_name LIKE $1 OR abstract LIKE $1
        OR authors LIKE $1 OR keywords LIKE $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [like, limit],
  );

  for (const paper of papers) {
    const source =
      [paper.title, paper.file_name, paper.authors, paper.keywords].find(
        (value) => value?.toLowerCase().includes(keyword.toLowerCase()),
      ) ?? paper.abstract;
    results.push({
      id: resultId("paper", paper.id),
      paper_id: paper.id,
      paper_title: paper.title,
      file_name: paper.file_name,
      hit_type: paper.abstract?.toLowerCase().includes(keyword.toLowerCase())
        ? "abstract"
        : "paper",
      label: "论文信息",
      snippet: makeSnippet(source, keyword),
      created_at: paper.created_at,
    });
  }

  // ——— Paper Chunks (FTS5 with LIKE fallback) ———
  const ftsQuery = buildFts5Query(keyword);
  let chunks: Array<{
    id: string;
    paper_id: string;
    chunk_index: number;
    section_title: string | null;
    content: string;
    title: string | null;
    file_name: string;
    created_at: string;
  }> = [];

  try {
    chunks = await db.select<
      Array<{
        id: string;
        paper_id: string;
        chunk_index: number;
        section_title: string | null;
        content: string;
        title: string | null;
        file_name: string;
        created_at: string;
      }>
    >(
      `SELECT c.id, c.paper_id, c.chunk_index, c.section_title, c.content,
              p.title, p.file_name, c.created_at
       FROM paper_chunks_fts fts
       JOIN paper_chunks c ON c.rowid = fts.rowid
       JOIN papers p ON p.id = c.paper_id
       WHERE paper_chunks_fts MATCH $1
       ORDER BY c.paper_id, c.chunk_index ASC
       LIMIT $2`,
      [ftsQuery, limit],
    );
  } catch (ftsError) {
    console.warn("FTS5 search failed, falling back to LIKE:", ftsError);
    // FTS5 unavailable or query failed — fall back to LIKE
    chunks = await db.select<
      Array<{
        id: string;
        paper_id: string;
        chunk_index: number;
        section_title: string | null;
        content: string;
        title: string | null;
        file_name: string;
        created_at: string;
      }>
    >(
      `SELECT c.id, c.paper_id, c.chunk_index, c.section_title, c.content,
              p.title, p.file_name, c.created_at
       FROM paper_chunks c
       JOIN papers p ON p.id = c.paper_id
       WHERE c.content LIKE $1 OR c.section_title LIKE $1
       ORDER BY c.paper_id, c.chunk_index ASC
       LIMIT $2`,
      [like, limit],
    );
  }

  for (const chunk of chunks) {
    results.push({
      id: resultId("chunk", chunk.id),
      paper_id: chunk.paper_id,
      paper_title: chunk.title,
      file_name: chunk.file_name,
      hit_type: "chunk",
      label: `Chunk ${chunk.chunk_index + 1}${chunk.section_title ? ` / ${chunk.section_title}` : ""}`,
      snippet: makeSnippet(chunk.content, keyword),
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      created_at: chunk.created_at,
    });
  }

  // ——— Notes ———
  const notes = await db.select<
    Array<{
      id: string;
      paper_id: string;
      title: string;
      note_content: string;
      paper_title: string | null;
      file_name: string;
      updated_at: string;
    }>
  >(
    `SELECT n.id, n.paper_id, n.title, n.note_content,
            p.title AS paper_title, p.file_name, n.updated_at
     FROM paper_notes n
     JOIN papers p ON p.id = n.paper_id
     WHERE n.title LIKE $1 OR n.note_content LIKE $1
     ORDER BY n.updated_at DESC
     LIMIT $2`,
    [like, limit],
  );

  for (const note of notes) {
    results.push({
      id: resultId("note", note.id),
      paper_id: note.paper_id,
      paper_title: note.paper_title,
      file_name: note.file_name,
      hit_type: "note",
      label: `阅读笔记 / ${note.title}`,
      snippet: makeSnippet(note.note_content, keyword),
      created_at: note.updated_at,
    });
  }

  // ——— QA ———
  const qaRows = await db.select<
    Array<{
      id: string;
      paper_id: string;
      question: string;
      answer: string;
      paper_title: string | null;
      file_name: string;
      created_at: string;
    }>
  >(
    `SELECT q.id, q.paper_id, q.question, q.answer,
            p.title AS paper_title, p.file_name, q.created_at
     FROM paper_qa q
     JOIN papers p ON p.id = q.paper_id
     WHERE q.question LIKE $1 OR q.answer LIKE $1
     ORDER BY q.created_at DESC
     LIMIT $2`,
    [like, limit],
  );

  for (const qa of qaRows) {
    results.push({
      id: resultId("qa", qa.id),
      paper_id: qa.paper_id,
      paper_title: qa.paper_title,
      file_name: qa.file_name,
      hit_type: "qa",
      label: "论文问答",
      snippet: makeSnippet(`${qa.question} ${qa.answer}`, keyword),
      created_at: qa.created_at,
    });
  }

  // ——— Annotations ———
  const annRows = await db.select<
    Array<{
      id: string;
      paper_id: string;
      selected_text: string | null;
      note: string | null;
      title: string | null;
      file_name: string;
      created_at: string;
    }>
  >(
    `SELECT a.id, a.paper_id, a.selected_text, a.note,
            p.title AS paper_title, p.file_name, a.created_at
     FROM paper_annotations a
     JOIN papers p ON p.id = a.paper_id
     WHERE a.selected_text LIKE $1 OR a.note LIKE $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [like, limit],
  );

  for (const ann of annRows) {
    results.push({
      id: resultId("annotation", ann.id),
      paper_id: ann.paper_id,
      paper_title: ann.title,
      file_name: ann.file_name,
      hit_type: "annotation",
      label: "论文标注",
      snippet: makeSnippet(ann.selected_text ?? ann.note ?? "", keyword),
      created_at: ann.created_at,
    });
  }

  // ——— Tags ———
  const tags = await db.select<
    Array<{
      id: string;
      paper_id: string;
      tag: string;
      title: string | null;
      file_name: string;
      created_at: string;
    }>
  >(
    `SELECT t.id, t.paper_id, t.tag, p.title, p.file_name, t.created_at
     FROM paper_tags t
     JOIN papers p ON p.id = t.paper_id
     WHERE t.tag LIKE $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [like, limit],
  );

  for (const tag of tags) {
    results.push({
      id: resultId("tag", tag.id),
      paper_id: tag.paper_id,
      paper_title: tag.title,
      file_name: tag.file_name,
      hit_type: "tag",
      label: "论文标签",
      snippet: tag.tag,
      created_at: tag.created_at,
    });
  }

  return results.slice(0, limit);
}
