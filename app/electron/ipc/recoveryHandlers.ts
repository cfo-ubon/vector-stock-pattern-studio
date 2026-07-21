import { ipcMain, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RecoveryCheckResult } from '../ipcContract';

// Crash recovery: a small marker file (`recovery.json`) is written to
// `userData` every time an autosave completes (see `main.ts`'s autosave
// timer) and is only ever deleted on a *clean* shutdown (the renderer's
// `beforeunload`, having confirmed no unsaved changes, tells main to
// clear it). If the marker still exists the next time the app starts,
// the previous session did not shut down cleanly — the renderer asks the
// user whether to recover.

function recoveryFilePath(): string {
  return path.join(app.getPath('userData'), 'recovery.json');
}

export function writeRecoveryMarker(data: { projectName: string; filePath?: string; autosavePath: string }): void {
  try {
    fs.writeFileSync(recoveryFilePath(), JSON.stringify({ ...data, savedAt: Date.now() }, null, 2), 'utf-8');
  } catch {
    // Non-fatal — recovery is a convenience, not a correctness guarantee.
  }
}

export function clearRecoveryMarker(): void {
  try {
    if (fs.existsSync(recoveryFilePath())) fs.unlinkSync(recoveryFilePath());
  } catch {
    // Non-fatal.
  }
}

export function registerRecoveryHandlers(): void {
  ipcMain.handle('recovery:check', (): RecoveryCheckResult => {
    try {
      if (!fs.existsSync(recoveryFilePath())) return { hasRecoveryData: false };
      const data = JSON.parse(fs.readFileSync(recoveryFilePath(), 'utf-8'));
      return { hasRecoveryData: true, recoveredAt: data.savedAt, projectName: data.projectName, filePath: data.autosavePath };
    } catch {
      return { hasRecoveryData: false };
    }
  });

  ipcMain.handle('recovery:clear', () => clearRecoveryMarker());
}
