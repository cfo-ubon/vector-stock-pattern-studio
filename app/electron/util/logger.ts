import * as fs from 'node:fs';
import * as path from 'node:path';

// Minimal main-process file logger. Writes into the configured Workspace's
// `Logs/` folder once a Workspace is set up (Part 1's folder taxonomy);
// before that (first launch, no Workspace chosen yet) falls back to
// Electron's own per-user `userData` directory so nothing is ever silently
// dropped. One log file per calendar day, plain text, append-only — no
// external logging dependency, no SQLite (unlike the reference
// `codex/offline-windows-desktop` Logger, which persisted structured log
// rows into its SQLite `AppDb`; this app has no such database to reuse, and
// adding one would be exactly the kind of architecture change this mission
// forbids).
export class Logger {
  private readonly logsDir: string;

  constructor(logsDir: string) {
    this.logsDir = logsDir;
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  getLogsFolder(): string {
    return this.logsDir;
  }

  private write(level: 'INFO' | 'WARN' | 'ERROR', scope: string, message: string): void {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const file = path.join(this.logsDir, `ai-sbos-${day}.log`);
    const line = `${now.toISOString()} [${level}] [${scope}] ${message}\n`;
    try {
      fs.appendFileSync(file, line, 'utf8');
    } catch {
      // Logging must never crash the app it's trying to observe.
    }
  }

  info(scope: string, message: string): void {
    this.write('INFO', scope, message);
  }

  warn(scope: string, message: string): void {
    this.write('WARN', scope, message);
  }

  error(scope: string, message: string): void {
    this.write('ERROR', scope, message);
  }
}
