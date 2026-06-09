/** PaperLens Plugin API — type definitions */
import type { Paper, PaperChunk } from "../types/paper";

/** Context passed to each plugin hook */
export interface PluginContext {
  paper?: Paper;
  chunks?: PaperChunk[];
  /** App data directory for persistent storage */
  dataDir: string;
  /** Log a message (shown in dev console) */
  log: (...args: unknown[]) => void;
}

/** Hooks a plugin can implement */
export interface PluginHooks {
  /** Called after PaperLens loads a paper's detail page */
  onPaperLoaded?: (ctx: PluginContext) => void | Promise<void>;
  /** Called before exporting a paper. Return modified data or original. */
  onBeforeExport?: (
    format: "markdown" | "word" | "bibtex" | "ris",
    data: Record<string, unknown>,
    ctx: PluginContext,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Called when the app starts. Good for adding custom menu items. */
  onAppStart?: () => void | Promise<void>;
}

/** A PaperLens plugin module */
export interface PaperLensPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  hooks: PluginHooks;
}

/** Registration result */
export interface PluginLoadResult {
  id: string;
  name: string;
  loaded: boolean;
  error?: string;
}
