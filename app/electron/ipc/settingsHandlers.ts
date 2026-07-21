import { ipcMain } from 'electron';
import type { AppDb } from '../db/appDb';
import { DEFAULT_SETTINGS, type SettingsMap } from '../ipcContract';

const SETTINGS_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export function registerSettingsHandlers(db: AppDb): void {
  ipcMain.handle('settings:get', (_event, key: unknown) => {
    if (typeof key !== 'string' || !SETTINGS_KEYS.has(key)) return undefined;
    return db.getSetting(key as keyof SettingsMap);
  });

  ipcMain.handle('settings:set', (_event, payload: unknown) => {
    const p = payload as { key?: unknown; value?: unknown } | undefined;
    if (!p || typeof p.key !== 'string' || !SETTINGS_KEYS.has(p.key)) return { ok: false };
    db.setSetting(p.key as keyof SettingsMap, p.value as never);
    return { ok: true };
  });

  ipcMain.handle('settings:getAll', () => db.getAllSettings());
}
