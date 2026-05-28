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
