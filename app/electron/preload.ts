import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type IpcChannel } from './ipcContract';

// The ONLY bridge between the renderer and the OS. `contextIsolation:
// true` + `nodeIntegration: false` (set in `main.ts`) mean the renderer
// has zero access to Node/Electron APIs except through `window.vsp`
// below — and every method here calls `ipcRenderer.invoke` with a
// channel name drawn from the shared `IPC_CHANNELS` allowlist, never a
// renderer-supplied string, so there is no way for renderer code (even if
// compromised via an XSS-class bug in some future dependency) to invoke
// an arbitrary main-process IPC handler.

function safeInvoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown> {
  if (!IPC_CHANNELS.includes(channel)) return Promise.reject(new Error(`Channel "${channel}" is not allowlisted.`));
  return ipcRenderer.invoke(channel, ...args);
}

const MENU_EVENTS = [
  'menu:newProject', 'menu:openProject', 'menu:save', 'menu:saveAs', 'menu:importJson', 'menu:export',
  'menu:undo', 'menu:redo', 'menu:resetPattern', 'menu:preferences',
  'menu:validatePattern', 'menu:duplicateCheck', 'menu:generatePreview', 'menu:rebuildMetadata',
  'menu:openExportFolder', 'menu:restoreData', 'menu:keyboardShortcuts',
  'app:requestSaveBeforeClose', 'app:requestAutosave',
] as const;
type MenuEvent = (typeof MENU_EVENTS)[number];

contextBridge.exposeInMainWorld('vsp', {
  // ---- project ----
  openProject: () => safeInvoke('project:open'),
  openProjectFromPath: (filePath: string) => safeInvoke('project:openPath', filePath),
  saveProject: (input: unknown) => safeInvoke('project:save', input),
  saveProjectAs: (input: unknown) => safeInvoke('project:saveAs', input),
  listRecentProjects: () => safeInvoke('project:listRecent'),
  removeRecentProject: (filePath: string) => safeInvoke('project:removeRecent', filePath),

  // ---- export ----
  saveExportFile: (input: unknown) => safeInvoke('export:saveFile', input),
  selectFolder: () => safeInvoke('export:selectFolder'),
  openFolder: (folderPath: string) => safeInvoke('export:openFolder', folderPath),

  // ---- settings ----
  getSetting: (key: string) => safeInvoke('settings:get', key),
  setSetting: (key: string, value: unknown) => safeInvoke('settings:set', { key, value }),
  getAllSettings: () => safeInvoke('settings:getAll'),

  // ---- backup ----
  runManualBackup: (currentProjectPath?: string) => safeInvoke('backup:runManual', currentProjectPath),
  listBackups: () => safeInvoke('backup:list'),
  restoreBackup: (backupId: string) => safeInvoke('backup:restore', backupId),

  // ---- recovery ----
  checkRecovery: () => safeInvoke('recovery:check'),
  clearRecovery: () => safeInvoke('recovery:clear'),

  // ---- diagnostics ----
  openLogsFolder: () => safeInvoke('diagnostics:openLogsFolder'),
  exportDiagnosticPackage: () => safeInvoke('diagnostics:exportPackage'),
  getDiagnosticsSummary: () => safeInvoke('diagnostics:getSummary'),

  // ---- app ----
  getVersion: () => safeInvoke('app:getVersion'),
  getPaths: () => safeInvoke('app:getPaths'),

  // Renderer -> main: dirty-state + current file, so main knows whether
  // it's safe to quit and where autosave/crash-recovery should write.
  reportState: (state: { hasUnsavedChanges: boolean; currentProjectPath?: string; projectName?: string; autosavePath?: string }) =>
    ipcRenderer.send('app:reportState', state),

  // Main -> renderer: menu clicks and lifecycle requests. `onMenuEvent`
  // only ever registers a listener for a name in the fixed `MENU_EVENTS`
  // list — the renderer cannot subscribe to an arbitrary IPC channel.
  onMenuEvent: (event: MenuEvent, callback: () => void) => {
    if (!MENU_EVENTS.includes(event)) return;
    const listener = () => callback();
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
});
