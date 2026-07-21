import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RecentProjectEntry, BackupRecord, SettingsMap } from '../ipcContract';
import { DEFAULT_SETTINGS } from '../ipcContract';

// SQLite persistence for OS-level desktop concerns only (settings, recent
// projects, export history, backup log, app logs) — per
// DESKTOP_MIGRATION_AUDIT.md Section 5/9: everything Project/pattern/
// portfolio-shaped stays in the existing, unmodified IndexedDB layer
// inside the renderer. This file never touches that data.
//
// Build note (documented, not hidden): `better-sqlite3` is a native Node
// module. It installs and runs correctly under plain Node (verified this
// session), but for the packaged Electron app it must be rebuilt against
// Electron's own Node ABI on the actual Windows/CI build machine before
// `npm run desktop:build`, via `npx electron-rebuild -f -w better-sqlite3`
// (or electron-builder's own `npmRebuild: true`, the default) — this
// container could not verify that rebuild step since it cannot download
// Electron's own binary (see DESKTOP_MIGRATION_AUDIT.md Section 11).

export const DB_SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recent_projects (
  path TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  last_opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS export_history (
  id TEXT PRIMARY KEY,
  exported_at INTEGER NOT NULL,
  export_type TEXT NOT NULL,
  target_path TEXT NOT NULL,
  pattern_id TEXT,
  collection_name TEXT
);
CREATE TABLE IF NOT EXISTS backup_log (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  backup_path TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL
);
`;

export class AppDb {
  private db: Database.Database;

  constructor(userDataDir: string) {
    fs.mkdirSync(userDataDir, { recursive: true });
    const dbPath = path.join(userDataDir, 'vsp-desktop.sqlite3');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
    this.migrate();
  }

  /** Placeholder for future `PRAGMA user_version`-gated migrations —
   * DB_SCHEMA_VERSION is bumped and a branch added here whenever the
   * schema shape changes, never a silent ALTER with no version check. */
  private migrate(): void {
    const current = this.db.pragma('user_version', { simple: true }) as number;
    if (current < DB_SCHEMA_VERSION) {
      this.db.pragma(`user_version = ${DB_SCHEMA_VERSION}`);
    }
  }

  close(): void {
    this.db.close();
  }

  // ---- settings ----
  getSetting<K extends keyof SettingsMap>(key: K): SettingsMap[K] {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return DEFAULT_SETTINGS[key];
    try {
      return JSON.parse(row.value) as SettingsMap[K];
    } catch {
      return DEFAULT_SETTINGS[key];
    }
  }

  setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): void {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  getAllSettings(): SettingsMap {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const out: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      try {
        (out as unknown as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        // corrupted single value — keep the default for that key
      }
    }
    return out;
  }

  // ---- recent projects ----
  addRecentProject(entry: RecentProjectEntry): void {
    this.db
      .prepare('INSERT INTO recent_projects (path, project_name, last_opened_at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET project_name = excluded.project_name, last_opened_at = excluded.last_opened_at')
      .run(entry.path, entry.projectName, entry.lastOpenedAt);
    // Keep only the most recent 20.
    const ids = this.db.prepare('SELECT path FROM recent_projects ORDER BY last_opened_at DESC').all() as Array<{ path: string }>;
    const toDrop = ids.slice(20);
    for (const row of toDrop) this.db.prepare('DELETE FROM recent_projects WHERE path = ?').run(row.path);
  }

  listRecentProjects(): RecentProjectEntry[] {
    const rows = this.db.prepare('SELECT path, project_name, last_opened_at FROM recent_projects ORDER BY last_opened_at DESC LIMIT 20').all() as Array<{
      path: string;
      project_name: string;
      last_opened_at: number;
    }>;
    return rows.map((r) => ({ path: r.path, projectName: r.project_name, lastOpenedAt: r.last_opened_at }));
  }

  removeRecentProject(filePath: string): void {
    this.db.prepare('DELETE FROM recent_projects WHERE path = ?').run(filePath);
  }

  // ---- export history ----
  recordExport(entry: { id: string; exportedAt: number; exportType: string; targetPath: string; patternId?: string; collectionName?: string }): void {
    this.db
      .prepare('INSERT INTO export_history (id, exported_at, export_type, target_path, pattern_id, collection_name) VALUES (?, ?, ?, ?, ?, ?)')
      .run(entry.id, entry.exportedAt, entry.exportType, entry.targetPath, entry.patternId ?? null, entry.collectionName ?? null);
  }

  // ---- backup log ----
  recordBackup(record: BackupRecord): void {
    this.db
      .prepare('INSERT INTO backup_log (id, created_at, backup_path, trigger_type, size_bytes) VALUES (?, ?, ?, ?, ?)')
      .run(record.id, record.createdAt, record.backupPath, record.trigger, record.sizeBytes);
  }

  listBackups(): BackupRecord[] {
    const rows = this.db.prepare('SELECT id, created_at, backup_path, trigger_type, size_bytes FROM backup_log ORDER BY created_at DESC').all() as Array<{
      id: string;
      created_at: number;
      backup_path: string;
      trigger_type: BackupRecord['trigger'];
      size_bytes: number;
    }>;
    return rows.map((r) => ({ id: r.id, createdAt: r.created_at, backupPath: r.backup_path, trigger: r.trigger_type, sizeBytes: r.size_bytes }));
  }

  // ---- logs ----
  log(level: 'info' | 'warn' | 'error', category: string, message: string): void {
    this.db.prepare('INSERT INTO app_logs (ts, level, category, message) VALUES (?, ?, ?, ?)').run(Date.now(), level, category, message);
  }

  recentLogs(limit = 500): Array<{ ts: number; level: string; category: string; message: string }> {
    return this.db.prepare('SELECT ts, level, category, message FROM app_logs ORDER BY id DESC LIMIT ?').all(limit) as Array<{
      ts: number;
      level: string;
      category: string;
      message: string;
    }>;
  }
}
