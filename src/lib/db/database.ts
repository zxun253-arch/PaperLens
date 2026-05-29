import Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:paperlens.db";

let databasePromise: Promise<Database> | null = null;
let initializedPromise: Promise<Database> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT,
    authors TEXT,
    year TEXT,
    journal TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    abstract TEXT,
    keywords TEXT,
    paper_type TEXT,
    research_field TEXT,
    status TEXT NOT NULL DEFAULT 'unparsed',
    reading_status TEXT NOT NULL DEFAULT 'unread',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS paper_chunks (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    section_title TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS paper_notes (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'manual',
    title TEXT NOT NULL DEFAULT '阅读笔记',
    note_content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS paper_qa (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    evidence TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS llm_call_logs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    adapter TEXT NOT NULL,
    model TEXT,
    base_url TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    error_type TEXT,
    message TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS ai_outputs (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    action TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    structured_json TEXT,
    source_chunk_ids TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS paper_tags (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE (paper_id, tag)
  );`,
  `CREATE TABLE IF NOT EXISTS literature_reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    paper_ids TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];

async function ensureColumn(
  db: Database,
  tableName: string,
  columnName: string,
  alterStatement: string,
) {
  const columns = await db.select<Array<{ name: string }>>(
    `PRAGMA table_info(${tableName})`,
  );

  if (!columns.some((column) => column.name === columnName)) {
    await db.execute(alterStatement);
  }
}

async function runCompatibleMigrations(db: Database) {
  await ensureColumn(
    db,
    "papers",
    "reading_status",
    "ALTER TABLE papers ADD COLUMN reading_status TEXT NOT NULL DEFAULT 'unread'",
  );
  await ensureColumn(
    db,
    "papers",
    "is_favorite",
    "ALTER TABLE papers ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    db,
    "paper_notes",
    "note_type",
    "ALTER TABLE paper_notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'manual'",
  );
  await ensureColumn(
    db,
    "paper_notes",
    "title",
    "ALTER TABLE paper_notes ADD COLUMN title TEXT NOT NULL DEFAULT '阅读笔记'",
  );
}

async function loadDatabase() {
  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL);
  }

  return databasePromise;
}

export async function initDatabase() {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      const db = await loadDatabase();
      await db.execute("PRAGMA foreign_keys = ON;");

      for (const statement of schemaStatements) {
        await db.execute(statement);
      }

      await runCompatibleMigrations(db);

      return db;
    })();
  }

  return initializedPromise;
}

export async function getDatabase() {
  return initDatabase();
}

export function getDatabaseUrl() {
  return DATABASE_URL;
}
