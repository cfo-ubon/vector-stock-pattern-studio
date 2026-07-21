import { ipcMain, app, shell, dialog, type BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AppDb } from '../db/appDb';
import type { Logger } from '../util/logger';
import type { DiagnosticsSummary } from '../ipcContract';
import { DB_SCHEMA_VERSION } from '../db/appDb';

// "Help > Open Logs Folder / Copy Diagnostic Information / Export
// Diagnostic Package" — per the brief's Logging & Diagnostics section.
// The diagnostic package deliberately never includes user artwork
// (SVG/EPS/PNG pattern files) or project content, only environment info,
// the log files, and a settings *summary* (keys, not raw values that
// could contain a folder path revealing the user's real name via
// C:\Users\<name>\... — that path is still useful for support, so it is
// included, but nothing beyond configuration).

export function registerDiagnosticsHandlers(getWindow: () => BrowserWindow | null, db: AppDb, logger: Logger, appVersion: string): void {
  ipcMain.handle('diagnostics:openLogsFolder', () => {
    shell.openPath(logger.getLogsFolder());
  });

  ipcMain.handle('diagnostics:getSummary', (): DiagnosticsSummary => {
    return buildSummary(appVersion);
  });

  ipcMain.handle('diagnostics:exportPackage', async () => {
    const win = getWindow();
    if (!win) return { ok: false as const };
    const result = await dialog.showSaveDialog(win, {
      title: 'ส่งออกข้อมูลวินิจฉัย (Export Diagnostic Package)',
      defaultPath: `vsp-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false as const };

    const summary = buildSummary(appVersion);
    const logFiles = fs
      .readdirSync(logger.getLogsFolder())
      .filter((f) => f.endsWith('.log'))
      .sort()
      .slice(-3); // last 3 days only — bounded size
    const logs: Record<string, string> = {};
    for (const f of logFiles) logs[f] = fs.readFileSync(path.join(logger.getLogsFolder(), f), 'utf-8');

    const pkg = { generatedAt: new Date().toISOString(), summary, recentDbLogs: db.recentLogs(200), logFiles: logs };
    fs.writeFileSync(result.filePath, JSON.stringify(pkg, null, 2), 'utf-8');
    logger.info('diagnostics', `Exported diagnostic package to ${result.filePath}`);
    return { ok: true as const, filePath: result.filePath };
  });
}

function buildSummary(appVersion: string): DiagnosticsSummary {
  return {
    appVersion,
    electronVersion: process.versions.electron ?? 'unknown',
    chromeVersion: process.versions.chrome ?? 'unknown',
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    dbSchemaVersion: DB_SCHEMA_VERSION,
    userDataPath: app.getPath('userData'),
  };
}
