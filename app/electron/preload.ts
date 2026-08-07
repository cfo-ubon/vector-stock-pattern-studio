import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel } from './ipcContract';

// The ONLY bridge between the renderer and the OS. `contextIsolation: true`
// + `nodeIntegration: false` (set in `main.ts`) mean the renderer has zero
// access to Node/Electron APIs except through `window.workspaceAPI` below —
// every method here calls `ipcRenderer.invoke` with a channel name drawn
// from the `IPC_CHANNELS` allowlist below, never a renderer-supplied
// string, so there is no way for renderer code to invoke an arbitrary
// main-process IPC handler. Same pattern as
// `codex/offline-windows-desktop`'s `preload.ts`, reused because it is a
// generic Electron security pattern, not something tied to that branch's
// app model — the exposed API surface below is new and specific to this
// app's actual Workspace/Backup/Export needs.
//
// The allowlist is duplicated here (not imported from `./ipcContract.ts`)
// deliberately: Electron's sandboxed preload environment does not support
// `require()`-ing sibling project files — only Electron/Node built-ins —
// so a preload script must be fully self-contained. Verified directly in
// this session: importing `./ipcContract` from preload.ts produced a real
// runtime failure ("Unable to load preload script... module not found:
// ./ipcContract") the very first time this shell was launched in Electron,
// not just a theoretical concern. `import type` above is compile-time only
// (erased, no runtime require) and stays safe to keep in sync with
// `ipcContract.ts`'s `IpcChannel` union.
const IPC_CHANNELS: readonly IpcChannel[] = [
  'workspace:selectFolder',
  'workspace:getConfiguredPath',
  'workspace:setConfiguredPath',
  'workspace:getDefaultSuggestedPath',
  'workspace:initialize',
  'workspace:verify',
  'workspace:migrate',
  'workspace:writeFile',
  'workspace:readFile',
  'workspace:listDir',
  'workspace:publishRelease',
  'app:getVersion',
  'app:getPlatformInfo',
  'app:openPath',
];

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
