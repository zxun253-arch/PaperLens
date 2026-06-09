import { invoke } from "@tauri-apps/api/core";

/** Store an API key in the OS keychain (Windows Credential Manager / macOS Keychain) */
export async function storeApiKey(provider: string, apiKey: string): Promise<void> {
  const clean = apiKey.trim();
  if (!clean) {
    await invoke("delete_api_key", { service: provider }).catch(() => {});
    return;
  }
  await invoke("store_api_key", { service: provider, key: clean });
}

/** Retrieve an API key from the OS keychain. Returns empty string if not found or unavailable. */
export async function getApiKey(provider: string): Promise<string> {
  try {
    return await invoke<string>("get_api_key", { service: provider });
  } catch {
    return "";
  }
}

/** Delete an API key from the OS keychain */
export async function deleteApiKey(provider: string): Promise<void> {
  await invoke("delete_api_key", { service: provider }).catch(() => {});
}
