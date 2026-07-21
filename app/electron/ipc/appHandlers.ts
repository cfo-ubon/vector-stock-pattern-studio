import { ipcMain, app } from 'electron';

export function registerAppHandlers(appVersion: string): void {
  ipcMain.handle('app:getVersion', () => appVersion);
  ipcMain.handle('app:getPaths', () => ({
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads'),
  }));
}
