/**
 * PaperLens Plugin System v0.1 — MVP
 *
 * Discovers and runs plugins from `plugins/` directory at the app data root.
 * Plugins are TypeScript modules that export a PaperLensPlugin object.
 *
 * Usage in App.tsx startup:
 *   import { initPluginSystem } from "./plugins/pluginSystem";
 *   initPluginSystem().then(…);
 */
import type { PaperLensPlugin, PluginLoadResult } from "./types";

const loadedPlugins = new Map<string, PaperLensPlugin>();

export function getLoadedPlugins(): PaperLensPlugin[] {
  return Array.from(loadedPlugins.values());
}

export function getPlugin(id: string): PaperLensPlugin | undefined {
  return loadedPlugins.get(id);
}

/**
 * Register a plugin at runtime. Called by plugin modules themselves
 * or by the app's plugin loader.
 */
export function registerPlugin(plugin: PaperLensPlugin): PluginLoadResult {
  if (loadedPlugins.has(plugin.id)) {
    return {
      id: plugin.id,
      name: plugin.name,
      loaded: false,
      error: `Plugin "${plugin.id}" already registered`,
    };
  }

  loadedPlugins.set(plugin.id, plugin);

  // Fire onAppStart hook immediately
  if (plugin.hooks.onAppStart) {
    try {
      void plugin.hooks.onAppStart();
    } catch (err) {
      console.error(`[Plugin ${plugin.id}] onAppStart error:`, err);
    }
  }

  console.log(`[PluginSystem] Loaded: ${plugin.name} v${plugin.version}`);
  return { id: plugin.id, name: plugin.name, loaded: true };
}

/**
 * Initialize the plugin system: discover + load bundled plugins.
 * In future versions this will scan a directory for user-installed plugins.
 */
export async function initPluginSystem(): Promise<PluginLoadResult[]> {
  const results: PluginLoadResult[] = [];

  // ——— Inline example: built-in "Citation Helper" ———
  // This demonstrates the plugin API. Users can disable by
  // toggling a config key in app_settings.
  results.push(
    registerPlugin({
      id: "paperlens.citation-helper",
      name: "Citation Helper",
      version: "0.1.0",
      description: "Provides additional citation format suggestions per paper.",
      hooks: {
        onPaperLoaded(ctx) {
          const title = ctx.paper?.title ?? "Untitled";
          ctx.log(`[CitationHelper] Paper loaded: ${title}`);
        },
        onBeforeExport(format, data) {
          if (format === "bibtex") {
            data._generatedBy = "PaperLens + CitationHelper";
          }
          return data;
        },
      },
    }),
  );

  return results;
}

/** Convenience: fire onPaperLoaded for all interested plugins */
export function notifyPaperLoaded(ctx: {
  paper?: import("../types/paper").Paper;
  chunks?: import("../types/paper").PaperChunk[];
  dataDir: string;
}): void {
  const plugins = Array.from(loadedPlugins.values());
  for (const plugin of plugins) {
    if (plugin.hooks.onPaperLoaded) {
      try {
        Promise.resolve(
          plugin.hooks.onPaperLoaded({
            ...ctx,
            log: (...args) => console.log(`[${plugin.name}]`, ...args),
          })
        ).catch((err: unknown) => {
          console.error(`[Plugin ${plugin.id}] onPaperLoaded error:`, err);
        });
      } catch (err) {
        console.error(`[Plugin ${plugin.id}] onPaperLoaded error:`, err);
      }
    }
  }
}

/** Convenience: fire onBeforeExport for all interested plugins */
export async function notifyBeforeExport(
  format: "markdown" | "word" | "bibtex" | "ris",
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let merged = { ...data };
  const plugins = Array.from(loadedPlugins.values());
  for (const plugin of plugins) {
    if (plugin.hooks.onBeforeExport) {
      try {
        merged = await plugin.hooks.onBeforeExport(format, merged, {
          dataDir: "",
          log: (...args) => console.log(`[${plugin.name}]`, ...args),
        });
      } catch (err) {
        console.error(`[Plugin ${plugin.id}] onBeforeExport error:`, err);
      }
    }
  }
  return merged;
}
