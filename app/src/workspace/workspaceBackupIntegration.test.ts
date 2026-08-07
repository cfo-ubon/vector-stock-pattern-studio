import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBackupToWorkspace } from './workspaceBackupIntegration';
import type { AppBackupBuildResult } from '../backup/appBackupBuilder';

function fakeBackupResult(): AppBackupBuildResult {
  return {
    blob: new Blob(['fake backup content'], { type: 'application/zip' }),
    fileName: 'ai-sbos-backup-20260804-120000.vspsb',
    manifest: {} as AppBackupBuildResult['manifest'],
  };
}

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'workspaceAPI');
  vi.restoreAllMocks();
});

describe('saveBackupToWorkspace', () => {
  it('no-ops outside the Electron desktop runtime', async () => {
    const result = await saveBackupToWorkspace(fakeBackupResult());
    expect(result).toBeNull();
  });

  it('writes the backup blob into Backups/<fileName> when running desktop', async () => {
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/Backups/ai-sbos-backup-20260804-120000.vspsb', bytes: 20 });
    (window as unknown as { workspaceAPI: unknown }).workspaceAPI = { writeFile };

    const backup = fakeBackupResult();
    const result = await saveBackupToWorkspace(backup);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [relativePath, data] = writeFile.mock.calls[0] as [string, ArrayBuffer];
    expect(relativePath).toBe(`Backups/${backup.fileName}`);
    expect(data.byteLength).toBe(await backup.blob.arrayBuffer().then((b) => b.byteLength));
    expect(result).toEqual({ path: '/workspace/Backups/ai-sbos-backup-20260804-120000.vspsb', bytes: 20 });
  });
});
