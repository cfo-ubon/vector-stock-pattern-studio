import * as fs from 'node:fs';
import * as path from 'node:path';

// Structured local logging (startup/crash/diagnostics events only — never
// file contents or artwork). Forward-ported from
// `codex/offline-windows-desktop`'s `electron/util/logger.ts` with its
// `AppDb`/SQLite dependency removed: the old version also wrote every log
// line into a SQLite `app_logs` table for an in-app "recent activity"
// view, but that table doesn't exist in this build (there is no
// main-process database at all — see `ipcContract.ts`'s header comment).
// A plain rotating text file under `userData/logs/` covers the same real
// need (a human can open it directly, or attach it to a support request,
// without the app running) without a native-module dependency.

export class Logger {
  private logDir: string;
  private currentFile: string;

  constructor(userDataDir: string) {
    this.logDir = path.join(userDataDir, 'logs');
    fs.mkdirSync(this.logDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    this.currentFile = path.join(this.logDir, `vsp-${dateStr}.log`);
    this.rotateOldLogs();
  }

  /** Keeps at most the 14 most recent daily log files — simple rotation,
   * no external dependency. */
  private rotateOldLogs(): void {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith('vsp-') && f.endsWith('.log'))
        .sort();
      const toDelete = files.slice(0, Math.max(0, files.length - 14));
      for (const f of toDelete) fs.unlinkSync(path.join(this.logDir, f));
    } catch {
      // Non-fatal — logging must never crash the app.
    }
  }

  private write(level: 'INFO' | 'ERROR', category: string, message: string): void {
    try {
      const line = `${new Date().toISOString()} [${level}] [${category}] ${message}\n`;
      fs.appendFileSync(this.currentFile, line);
    } catch {
      // Non-fatal — logging must never crash the app.
    }
  }

  info(category: string, message: string): void {
    this.write('INFO', category, message);
  }

  error(category: string, message: string): void {
    this.write('ERROR', category, message);
  }

  getLogsFolder(): string {
    return this.logDir;
  }
}
