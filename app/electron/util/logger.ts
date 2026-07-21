import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppDb } from '../db/appDb';

// Structured local logging — required by the brief's "Logging and
// diagnostics" section. Writes to both the SQLite `app_logs` table (for
// the in-app "recent activity" view) and a plain rotating text file under
// `userData/logs/` (for a human to open directly, or attach to a support
// request, without needing the app running). Never logs full file
// contents/artwork — only event metadata (category, a short message).

export class Logger {
  private db: AppDb | null;
  private logDir: string;
  private currentFile: string;

  constructor(userDataDir: string, db: AppDb | null) {
    this.db = db;
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

  private write(level: 'info' | 'warn' | 'error', category: string, message: string): void {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${category}] ${message}\n`;
    try {
      fs.appendFileSync(this.currentFile, line, 'utf-8');
    } catch {
      // Non-fatal.
    }
    try {
      this.db?.log(level, category, message);
    } catch {
      // Non-fatal.
    }
  }

  info(category: string, message: string): void {
    this.write('info', category, message);
  }

  warn(category: string, message: string): void {
    this.write('warn', category, message);
  }

  error(category: string, message: string): void {
    this.write('error', category, message);
  }

  getLogsFolder(): string {
    return this.logDir;
  }
}
