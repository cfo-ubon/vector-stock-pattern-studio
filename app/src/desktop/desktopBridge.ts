// Thin, additive adapter over the Electron preload bridge
// (`electron/preload.ts`'s `contextBridge.exposeInMainWorld('vsp', ...)`).
// This file is the ONLY place in `src/` that touches `window.vsp`.
// `export/svgExporter.ts`'s `downloadBlobFile` — the single function
// every export/backup-download call site in the app already funnels
// through — branches on `isDesktop()` internally, so behavior is
// byte-for-byte unchanged when running as the plain web app/PWA (where
// `window.vsp` is undefined) and only takes the native-dialog path when
// actually running inside the Electron shell.
//
// Build 027 — much smaller than `codex/offline-windows-desktop`'s
// original `DesktopBridge` interface, which modeled main-process-owned
// projects/settings/backups. This app has no main-process data store —
// see `electron/ipcContract.ts`'s header comment — so the only native
// capability this bridge exposes is generic file open/save/folder-select.

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenBinaryFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  data?: ArrayBuffer;
  error?: string;
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

export interface DesktopBridge {
  openBinaryFile: (filters: FileFilter[]) => Promise<OpenBinaryFileResult>;
  saveBinaryFile: (input: { suggestedName: string; filters: FileFilter[]; data: ArrayBuffer }) => Promise<SaveBinaryFileResult>;
  selectFolder: () => Promise<SelectFolderResult>;
  openFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
  getVersion: () => Promise<string>;
  getPaths: () => Promise<{ userData: string; documents: string; downloads: string }>;
  openLogsFolder: () => Promise<void>;
  onMenuEvent: (event: string, callback: () => void) => (() => void) | undefined;
}

declare global {
  interface Window {
    vsp?: DesktopBridge;
  }
}

/** True only when running inside the Electron shell (the preload script
 * ran and exposed `window.vsp`) — false for the ordinary web app/PWA,
 * exactly the branch point every additive desktop code path uses. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.vsp !== 'undefined';
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? window.vsp : undefined;
}

/** Maps a filename's extension to the file-dialog filter the native Save
 * dialog should offer — kept here (not duplicated at each call site)
 * since every export/backup download already funnels through one place. */
export function filtersForFilename(filename: string): FileFilter[] {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  const known: Record<string, FileFilter> = {
    vspsb: { name: 'Vector Stock Pattern Backup', extensions: ['vspsb'] },
    svg: { name: 'SVG Image', extensions: ['svg'] },
    eps: { name: 'EPS File', extensions: ['eps'] },
    png: { name: 'PNG Image', extensions: ['png'] },
    jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    json: { name: 'JSON File', extensions: ['json'] },
    zip: { name: 'ZIP Archive', extensions: ['zip'] },
    csv: { name: 'CSV File', extensions: ['csv'] },
  };
  const primary = known[ext];
  return primary ? [primary, { name: 'All Files', extensions: ['*'] }] : [{ name: 'All Files', extensions: ['*'] }];
}
