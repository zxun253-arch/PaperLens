import { getDatabase } from "./database";

export type AppSettings = Record<string, string | null>;

function createId() {
  return `setting_${crypto.randomUUID()}`;
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<Array<{ value: string | null }>>(
      "SELECT value FROM app_settings WHERE key = $1",
      [key],
    );

    return rows[0]?.value ?? null;
  } catch (error) {
    console.error("Failed to get setting", error);
    throw new Error("读取设置失败。");
  }
}

export async function setSetting(
  key: string,
  value: string | null,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO app_settings (id, key, value, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [createId(), key, value, new Date().toISOString()],
    );
  } catch (error) {
    console.error("Failed to set setting", error);
    throw new Error("保存设置失败。");
  }
}

export async function getAllSettings(): Promise<AppSettings> {
  try {
    const db = await getDatabase();
    const rows = await db.select<Array<{ key: string; value: string | null }>>(
      "SELECT key, value FROM app_settings",
    );

    return rows.reduce<AppSettings>((settings, row) => {
      settings[row.key] = row.value;
      return settings;
    }, {});
  } catch (error) {
    console.error("Failed to get all settings", error);
    throw new Error("读取全部设置失败。");
  }
}
