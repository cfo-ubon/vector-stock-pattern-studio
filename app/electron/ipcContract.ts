// The single source of truth for every IPC channel this app exposes.
// Both `preload.ts` (which builds the allowlisted `contextBridge` surface)
// and every handler in `ipc/*.ts` import from here — a channel that isn't
// listed in `IPC_CHANNELS` cannot be invoked from the renderer no matter
// what, since `preload.ts` only ever calls `ipcRenderer.invoke` with a
// name drawn from this const array, never a renderer-supplied string.
//
// Build 027 — deliberately much smaller than the channel set forward-
// ported from `codex/offline-windows-desktop`. That branch's IPC surface
// (`project:*`, `settings:*`, `backup:*`, `recovery:*`) assumed the main
// process owned persistence via a SQLite database — it does not, here.
// The real application (all of `/app/src`) already persists everything
// in the renderer's own IndexedDB/localStorage, exactly like it does
// running as a plain web app; that code is completely unmodified and
// unaware it's inside Electron. All the main process needs to provide is
// what a browser genuinely cannot: native Save/Open file dialogs and
// basic app/version info.

export const IPC_CHANNELS = [
  'file:openBinary',
  'file:saveBinary',
  'file:selectFolder',
  'file:openFolder',
  'app:getVersion',
  'app:getPaths',
  'diagnostics:openLogsFolder',
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export interface OpenBinaryFileOptions {
  /** File-dialog filters, e.g. [{ name: 'Vector Stock Pattern Backup', extensions: ['vspsb'] }] */
  filters: Array<{ name: string; extensions: string[] }>;
}

export interface OpenBinaryFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  /** Raw file bytes. Electron's IPC uses the structured clone algorithm,
   * which transfers ArrayBuffer/Uint8Array efficiently — important here
   * since a `.vspsb` backup can be tens of megabytes; a plain number[]
   * would be needlessly slow and memory-heavy for that size. */
  data?: ArrayBuffer;
  error?: string;
}

export interface SaveBinaryFileOptions {
  suggestedName: string;
  filters: Array<{ name: string; extensions: string[] }>;
  data: ArrayBuffer;
}

export interface SaveBinaryFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface SelectFolderResult {
  ok: boolean;
  canceled?: boolean;
  folderPath?: string;
}

export interface AppPaths {
  userData: string;
  documents: string;
  downloads: string;
}
