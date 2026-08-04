// Shared allowlist of every IPC channel the renderer may invoke. Both
// `preload.ts` (renderer side, validates before calling `ipcRenderer.invoke`)
// and each `ipc/*Handlers.ts` module (main side, registers `ipcMain.handle`
// for exactly these names) import from here, so the two can never drift —
// there is exactly one source of truth for "what the renderer is allowed to
// ask the main process to do."
export const IPC_CHANNELS = [
  // ---- workspace (Production Deployment Phase 1, Parts 1-3, 6, 9, 10) ----
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
  // ---- app ----
  'app:getVersion',
  'app:getPlatformInfo',
  'app:openPath',
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];
