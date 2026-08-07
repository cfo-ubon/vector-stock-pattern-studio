// Thin, safe client wrapper around `window.workspaceAPI` (exposed only by
// the Electron preload script — see `electron/preload.ts`). Every function
// here no-ops (or returns a "not available" result) when running as the
// plain browser build (GitHub Pages `/studio`), so nothing in this module
// can ever change behavior for the existing web app — it only does
// anything when actually running inside the new Electron shell.
//
// This file intentionally duplicates nothing from `electron/workspaceLayout.ts`
// (no folder-name list here): the renderer never needs to know the folder
// names in advance, it just asks `initialize()` and gets the real list back.

export interface WorkspaceVerifyResult {
  exists: boolean;
  isDirectory: boolean;
  writable: boolean;
  freeBytes: number | null;
  missingFolders: string[];
  error: string | null;
}

interface WorkspaceApiWindow {
  workspaceAPI?: {
    selectFolder: () => Promise<string | null>;
    getConfiguredPath: () => Promise<string | null>;
    setConfiguredPath: (path: string) => Promise<boolean>;
    getDefaultSuggestedPath: () => Promise<string>;
    initialize: (path: string) => Promise<{ created: string[]; allFolders: string[] }>;
    verify: (path: string) => Promise<WorkspaceVerifyResult>;
    migrate: (oldPath: string, newPath: string) => Promise<unknown>;
    writeFile: (relativePath: string, data: ArrayBuffer) => Promise<{ path: string; bytes: number }>;
    readFile: (relativePath: string) => Promise<ArrayBuffer>;
    listDir: (relativePath: string) => Promise<{ name: string; isDirectory: boolean }[]>;
    publishRelease: (input: unknown) => Promise<unknown>;
    getVersion: () => Promise<string>;
    getPlatformInfo: () => Promise<unknown>;
    openPath: (path: string) => Promise<void>;
  };
}

function api() {
  return (window as unknown as WorkspaceApiWindow).workspaceAPI;
}

/** True only inside the Electron desktop shell — always false in the
 * browser/GitHub-Pages build, which has no `window.workspaceAPI`. */
export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && !!api();
}

export async function getConfiguredWorkspacePath(): Promise<string | null> {
  const a = api();
  return a ? a.getConfiguredPath() : null;
}

export async function setConfiguredWorkspacePath(path: string): Promise<boolean> {
  const a = api();
  return a ? a.setConfiguredPath(path) : false;
}

export async function getDefaultSuggestedWorkspacePath(): Promise<string | null> {
  const a = api();
  return a ? a.getDefaultSuggestedPath() : null;
}

export async function selectWorkspaceFolder(): Promise<string | null> {
  const a = api();
  return a ? a.selectFolder() : null;
}

export async function initializeWorkspace(path: string): Promise<{ created: string[]; allFolders: string[] } | null> {
  const a = api();
  return a ? a.initialize(path) : null;
}

export async function verifyWorkspace(path: string): Promise<WorkspaceVerifyResult | null> {
  const a = api();
  return a ? a.verify(path) : null;
}

export async function migrateWorkspace(oldPath: string, newPath: string): Promise<unknown> {
  const a = api();
  return a ? a.migrate(oldPath, newPath) : null;
}

/** Writes a Blob into the configured Workspace at `relativePath` (e.g.
 * `Backups/2026-08-04.vspsb`). No-ops (returns null) outside Electron —
 * callers must keep their existing browser-download behavior as the
 * primary path and treat this purely as an additional destination. */
export async function writeBlobToWorkspace(relativePath: string, blob: Blob): Promise<{ path: string; bytes: number } | null> {
  const a = api();
  if (!a) return null;
  const buf = await blob.arrayBuffer();
  return a.writeFile(relativePath, buf);
}

export async function listWorkspaceDir(relativePath: string): Promise<{ name: string; isDirectory: boolean }[]> {
  const a = api();
  return a ? a.listDir(relativePath) : [];
}

export async function openWorkspacePath(path: string): Promise<void> {
  const a = api();
  if (a) await a.openPath(path);
}
