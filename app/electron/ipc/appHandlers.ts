import { ipcMain } from 'electron';
import * as os from 'node:os';

export function registerAppHandlers(appVersion: string): void {
  ipcMain.handle('app:getVersion', () => appVersion);
  ipcMain.handle('app:getPlatformInfo', () => ({
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  }));
}
