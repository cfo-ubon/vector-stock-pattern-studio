// The single source of truth for every IPC channel this app exposes.
// Both `preload.ts` (which builds the allowlisted `contextBridge` surface)
// and every handler in `ipc/*.ts` import from here — a channel that isn't
// listed in `IPC_CHANNELS` cannot be invoked from the renderer no matter
// what, since `preload.ts` only ever calls `ipcRenderer.invoke` with a
// name drawn from this const array, never a renderer-supplied string.

export const IPC_CHANNELS = [
  'project:new',
  'project:open',
  'project:openPath',
  'project:save',
  'project:saveAs',
  'project:listRecent',
  'project:removeRecent',
  'export:saveFile',
  'export:selectFolder',
  'export:openFolder',
  'settings:get',
  'settings:set',
  'settings:getAll',
  'backup:runManual',
  'backup:list',
  'backup:restore',
  'recovery:check',
  'recovery:clear',
  'diagnostics:openLogsFolder',
  'diagnostics:exportPackage',
  'diagnostics:getSummary',
  'app:getVersion',
  'app:getPaths',
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export interface VspsManifest {
  schema_version: number;
  app_version: string;
  created_at: number;
  updated_at: number;
  project_id: string;
  project_name: string;
}

export interface OpenProjectResult {
  ok: boolean;
  filePath?: string;
  projectJson?: string; // exact string exportProjectJson() would produce; importProjectJson() parses it renderer-side, unchanged
  manifest?: VspsManifest;
  error?: string;
}

export interface SaveProjectInput {
  filePath?: string; // undefined = "Save As" must prompt
  projectJson: string; // exact output of the existing exportProjectJson()
  projectName: string;
  projectId: string;
  previews?: Array<{ filename: string; base64Png: string }>;
}

export interface SaveProjectResult {
  ok: boolean;
  filePath?: string;
  error?: string;
}

export interface RecentProjectEntry {
  path: string;
  projectName: string;
  lastOpenedAt: number;
}

export interface SaveExportFileInput {
  suggestedName: string;
  extension: 'svg' | 'eps' | 'png' | 'json' | 'zip' | 'csv';
  data: string | ArrayBuffer; // text formats as string, PNG/ZIP as ArrayBuffer
  isBinary: boolean;
}

export interface SaveExportFileResult {
  ok: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface SettingsMap {
  defaultExportFolder: string;
  defaultProjectFolder: string;
  pngExportDimensions: number;
  previewDimensions: number;
  autosaveIntervalMinutes: number;
  backupIntervalMinutes: number;
  language: 'th' | 'en';
  theme: 'light' | 'dark' | 'system';
  defaultStockPlatform: string;
  filenameFormat: string;
  openExportFolderAfterExport: boolean;
  rememberLastUsedValues: boolean;
}

export const DEFAULT_SETTINGS: SettingsMap = {
  defaultExportFolder: '',
  defaultProjectFolder: '',
  pngExportDimensions: 2000,
  previewDimensions: 800,
  autosaveIntervalMinutes: 5,
  backupIntervalMinutes: 30,
  language: 'th',
  theme: 'system',
  defaultStockPlatform: 'shutterstock',
  filenameFormat: 'content',
  openExportFolderAfterExport: false,
  rememberLastUsedValues: true,
};

export interface BackupRecord {
  id: string;
  createdAt: number;
  backupPath: string;
  trigger: 'manual' | 'automatic' | 'preRestore';
  sizeBytes: number;
}

export interface RecoveryCheckResult {
  hasRecoveryData: boolean;
  recoveredAt?: number;
  projectName?: string;
  filePath?: string;
}

export interface DiagnosticsSummary {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  dbSchemaVersion: number;
  userDataPath: string;
}
