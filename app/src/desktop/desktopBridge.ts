// Thin, additive adapter over the Electron preload bridge
// (`electron/preload.ts`'s `contextBridge.exposeInMainWorld('vsp', ...)`).
// This file is the ONLY place in `src/` that touches `window.vsp` — every
// existing export/save call site keeps calling the same functions it
// always has (`downloadBlobFile`, etc.); those functions branch on
// `isDesktop()` internally so behavior is byte-for-byte unchanged when
// running as the plain web app (where `window.vsp` is undefined) and only
// takes the native-dialog path when actually running inside the Electron
// shell. See DESKTOP_MIGRATION_AUDIT.md Section 7.

export interface DesktopExportFileInput {
  suggestedName: string;
  extension: 'svg' | 'eps' | 'png' | 'json' | 'zip' | 'csv';
  data: string | ArrayBuffer;
  isBinary: boolean;
}

export interface DesktopBridge {
  openProject: () => Promise<unknown>;
  openProjectFromPath: (filePath: string) => Promise<unknown>;
  saveProject: (input: unknown) => Promise<unknown>;
  saveProjectAs: (input: unknown) => Promise<unknown>;
  listRecentProjects: () => Promise<unknown>;
  removeRecentProject: (filePath: string) => Promise<unknown>;
  saveExportFile: (input: DesktopExportFileInput) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  selectFolder: () => Promise<{ ok: boolean; folderPath?: string }>;
  openFolder: (folderPath: string) => Promise<void>;
  getSetting: (key: string) => Promise<unknown>;
  setSetting: (key: string, value: unknown) => Promise<unknown>;
  getAllSettings: () => Promise<unknown>;
  runManualBackup: (currentProjectPath?: string) => Promise<unknown>;
  listBackups: () => Promise<unknown>;
  restoreBackup: (backupId: string) => Promise<unknown>;
  checkRecovery: () => Promise<unknown>;
  clearRecovery: () => Promise<unknown>;
  openLogsFolder: () => Promise<void>;
  exportDiagnosticPackage: () => Promise<unknown>;
  getDiagnosticsSummary: () => Promise<unknown>;
  getVersion: () => Promise<string>;
  getPaths: () => Promise<{ userData: string; documents: string; downloads: string }>;
  reportState: (state: { hasUnsavedChanges: boolean; currentProjectPath?: string; projectName?: string; autosavePath?: string }) => void;
  onMenuEvent: (event: string, callback: () => void) => (() => void) | undefined;
}

declare global {
  interface Window {
    vsp?: DesktopBridge;
  }
}

/** True only when running inside the Electron shell (the preload script
 * ran and exposed `window.vsp`) — false for the ordinary web app, exactly
 * the branch point every additive desktop code path uses. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.vsp !== 'undefined';
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? window.vsp : undefined;
}
