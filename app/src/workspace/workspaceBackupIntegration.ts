import type { AppBackupBuildResult } from '../backup/appBackupBuilder';
import { isDesktopRuntime, writeBlobToWorkspace } from './workspaceApi';

/** Part 8: additive Workspace destination for the existing, unmodified
 * `.vspsb` backup flow. The browser download (`BackupManagerView`'s
 * "ดาวน์โหลดไฟล์") stays the primary path everywhere, including inside
 * Electron — this only writes a second copy into `<Workspace>/Backups/`
 * when running desktop with a configured Workspace, so the folder Part 1
 * promises actually gets used. No-ops outside Electron. */
export async function saveBackupToWorkspace(backup: AppBackupBuildResult): Promise<{ path: string; bytes: number } | null> {
  if (!isDesktopRuntime()) return null;
  return writeBlobToWorkspace(`Backups/${backup.fileName}`, backup.blob);
}
