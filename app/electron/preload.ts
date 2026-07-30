import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel } from './ipcContract';

// The ONLY bridge between the renderer and the OS. `contextIsolation:
// true` + `nodeIntegration: false` + `sandbox: true` (set in `main.ts`)
// mean the renderer has zero access to Node/Electron APIs except through
// `window.vsp` below — and every method here calls `ipcRenderer.invoke`
// with a channel name drawn from the shared `IPC_CHANNELS` allowlist,
// never a renderer-supplied string, so there is no way for renderer code
// to invoke an arbitrary main-process IPC handler even if a future
// dependency's XSS-class bug were to compromise the renderer.
//
// Forward-ported from `codex/offline-windows-desktop`'s `preload.ts` —
// the allowlist PATTERN is reused verbatim (it never depended on the old
// SQLite architecture), but the actual surface below is new and much
// smaller: generic file open/save/folder-select, not project/settings/
// backup passthroughs, since the renderer already owns all of that via
// IndexedDB/localStorage/`.vspsb`.
//
// IPC_CHANNELS is duplicated from `ipcContract.ts` (rather than imported
// as a value) because Electron's sandboxed preload context — required by
// `sandbox: true` — cannot `require()` arbitrary project-relative files,
// only Electron/Node builtins; a value import compiles to a `require`
// call that fails at runtime with "module not found". Only the type
// (erased at compile time, no runtime require) is imported normally.
// Keep this array in sync with `IPC_CHANNELS` in `ipcContract.ts`.
const IPC_CHANNELS = [
  'file:openBinary',
  'file:saveBinary',
  'file:selectFolder',
  'file:openFolder',
  'app:getVersion',
  'app:getPaths',
  'diagnostics:openLogsFolder',
] as const satisfies readonly IpcChannel[];

function safeInvoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown> {
  if (!IPC_CHANNELS.includes(channel)) return Promise.reject(new Error(`Channel "${channel}" is not allowlisted.`));
  return ipcRenderer.invoke(channel, ...args);
}

const MENU_EVENTS = ['menu:createBackup', 'menu:restoreBackup', 'menu:exportCurrent', 'menu:openExportFolder', 'menu:preferences'] as const;
type MenuEvent = (typeof MENU_EVENTS)[number];

contextBridge.exposeInMainWorld('vsp', {
  openBinaryFile: (filters: Array<{ name: string; extensions: string[] }>) => safeInvoke('file:openBinary', { filters }),
  saveBinaryFile: (input: { suggestedName: string; filters: Array<{ name: string; extensions: string[] }>; data: ArrayBuffer }) =>
    safeInvoke('file:saveBinary', input),
  selectFolder: () => safeInvoke('file:selectFolder'),
  openFolder: (folderPath: string) => safeInvoke('file:openFolder', folderPath),
  getVersion: () => safeInvoke('app:getVersion'),
  getPaths: () => safeInvoke('app:getPaths'),
  openLogsFolder: () => safeInvoke('diagnostics:openLogsFolder'),

  // Main -> renderer: menu clicks. `onMenuEvent` only ever registers a
  // listener for a name in the fixed `MENU_EVENTS` list — the renderer
  // cannot subscribe to an arbitrary IPC channel.
  onMenuEvent: (event: MenuEvent, callback: () => void) => {
    if (!MENU_EVENTS.includes(event)) return undefined;
    const listener = () => callback();
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
});
