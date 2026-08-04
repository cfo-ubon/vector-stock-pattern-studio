import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type IpcChannel } from './ipcContract';

// The ONLY bridge between the renderer and the OS. `contextIsolation: true`
// + `nodeIntegration: false` (set in `main.ts`) mean the renderer has zero
// access to Node/Electron APIs except through `window.workspaceAPI` below —
// every method here calls `ipcRenderer.invoke` with a channel name drawn
// from the shared `IPC_CHANNELS` allowlist, never a renderer-supplied
// string, so there is no way for renderer code to invoke an arbitrary
// main-process IPC handler. Same pattern as
// `codex/offline-windows-desktop`'s `preload.ts`, reused because it is a
// generic Electron security pattern, not something tied to that branch's
// app model — the exposed API surface below is new and specific to this
// app's actual Workspace/Backup/Export needs.
function safeInvoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown> {
  if (!IPC_CHANNELS.includes(channel)) return Promise.reject(new Error(`Channel "${channel}" is not allowlisted.`));
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('workspaceAPI', {
  // ---- workspace ----
  selectFolder: () => safeInvoke('workspace:selectFolder') as Promise<string | null>,
  getConfiguredPath: () => safeInvoke('workspace:getConfiguredPath') as Promise<string | null>,
  setConfiguredPath: (workspacePath: string) => safeInvoke('workspace:setConfiguredPath', workspacePath) as Promise<boolean>,
  getDefaultSuggestedPath: () => safeInvoke('workspace:getDefaultSuggestedPath') as Promise<string>,
  initialize: (workspacePath: string) => safeInvoke('workspace:initialize', workspacePath) as Promise<{ created: string[]; allFolders: string[] }>,
  verify: (workspacePath: string) => safeInvoke('workspace:verify', workspacePath),
  migrate: (oldPath: string, newPath: string) => safeInvoke('workspace:migrate', { oldPath, newPath }),
  writeFile: (relativePath: string, data: ArrayBuffer) => safeInvoke('workspace:writeFile', { relativePath, data }),
  readFile: (relativePath: string) => safeInvoke('workspace:readFile', relativePath) as Promise<ArrayBuffer>,
  listDir: (relativePath: string) => safeInvoke('workspace:listDir', relativePath),
  publishRelease: (input: unknown) => safeInvoke('workspace:publishRelease', input),

  // ---- app ----
  getVersion: () => safeInvoke('app:getVersion') as Promise<string>,
  getPlatformInfo: () => safeInvoke('app:getPlatformInfo'),
  openPath: (targetPath: string) => safeInvoke('app:openPath', targetPath),
});
