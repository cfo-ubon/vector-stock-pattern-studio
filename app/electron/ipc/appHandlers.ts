import { app, ipcMain, shell } from 'electron';
import type { AppPaths } from '../ipcContract';
import type { Logger } from '../util/logger';

export function registerAppHandlers(appVersion: string, logger: Logger): void {
  ipcMain.handle('app:getVersion', async (): Promise<string> => appVersion);

  ipcMain.handle('app:getPaths', async (): Promise<AppPaths> => ({
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads'),
  }));

  ipcMain.handle('diagnostics:openLogsFolder', async (): Promise<void> => {
    await shell.openPath(logger.getLogsFolder());
  });
}
