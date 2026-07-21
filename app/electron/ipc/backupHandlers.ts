import { ipcMain, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppDb } from '../db/appDb';
import type { Logger } from '../util/logger';
import type { BackupRecord } from '../ipcContract';

// Manual/automatic backup of the current `.vsps` file — a thin, desktop-
// native wrapper around the app's own existing, already-shipped Backup &
// Restore subsystem (`catalog/backup/*`, Portfolio Manager P3) for the
// Portfolio/Collection data that already lives in that format; this
// handler additionally covers backing up the *currently open project
// file itself* (a straight file copy with rotation), which is a desktop-
// only concept the web app never needed (the web app has no "current
// open file" on disk to begin with).
//
// Per the brief: stored OUTSIDE the install directory, at
// `Documents\Vector Stock Pattern Studio\Backups`.

const MAX_BACKUPS_PER_PROJECT = 10;

function backupsRoot(): string {
  return path.join(app.getPath('documents'), 'Vector Stock Pattern Studio', 'Backups');
}

function rotateBackupsFor(baseName: string, dir: string): void {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${baseName}.`) && f.endsWith('.vsps'))
    .sort();
  const excess = files.length - MAX_BACKUPS_PER_PROJECT;
  for (let i = 0; i < excess; i++) fs.unlinkSync(path.join(dir, files[i]));
}

export function registerBackupHandlers(db: AppDb, logger: Logger): void {
  ipcMain.handle('backup:runManual', (_event, currentProjectPath: unknown) => {
    return runBackup(typeof currentProjectPath === 'string' ? currentProjectPath : undefined, 'manual', db, logger);
  });

  ipcMain.handle('backup:list', () => db.listBackups());

  ipcMain.handle('backup:restore', (_event, backupId: unknown) => {
    if (typeof backupId !== 'string') return { ok: false, error: 'Invalid backup id.' };
    const record = db.listBackups().find((b) => b.id === backupId);
    if (!record || !fs.existsSync(record.backupPath)) return { ok: false, error: 'ไม่พบไฟล์สำรองข้อมูล' };
    return { ok: true, backupPath: record.backupPath };
  });
}

export function runBackup(currentProjectPath: string | undefined, trigger: BackupRecord['trigger'], db: AppDb, logger: Logger): { ok: boolean; backupPath?: string; error?: string } {
  if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
    return { ok: false, error: 'ไม่มีโปรเจกต์ที่เปิดอยู่ให้สำรองข้อมูล' };
  }
  try {
    const dir = backupsRoot();
    fs.mkdirSync(dir, { recursive: true });
    const baseName = path.basename(currentProjectPath, '.vsps');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(dir, `${baseName}.${timestamp}.vsps`);
    fs.copyFileSync(currentProjectPath, backupPath);
    rotateBackupsFor(baseName, dir);

    const record: BackupRecord = { id: randomUUID(), createdAt: Date.now(), backupPath, trigger, sizeBytes: fs.statSync(backupPath).size };
    db.recordBackup(record);
    logger.info('backup', `${trigger} backup of ${currentProjectPath} -> ${backupPath}`);
    return { ok: true, backupPath };
  } catch (e) {
    logger.error('backup', `Backup failed: ${(e as Error).message}`);
    return { ok: false, error: 'สำรองข้อมูลไม่สำเร็จ' };
  }
}

export { backupsRoot };
