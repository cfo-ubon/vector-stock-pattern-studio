import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// releaseHandlers.ts imports `electron` (ipcMain/shell) purely to register
// IPC handlers — `publishRelease` itself never touches those APIs, so a
// minimal stub is enough to let the module load under vitest.
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn() },
}));

const { publishRelease } = await import('./releaseHandlers');

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

describe('publishRelease', () => {
  it('copies real installer/portable artifacts into <Workspace>/Releases/<version> with matching checksums', () => {
    const workspace = tmpDir('ai-sbos-release-ws-');
    const buildOutput = tmpDir('ai-sbos-release-build-');
    const setupContent = crypto.randomBytes(300_000);
    const portableContent = crypto.randomBytes(300_000);
    const setupPath = path.join(buildOutput, 'AI-SBOS-Setup-x64.exe');
    const portablePath = path.join(buildOutput, 'AI-SBOS-Portable-x64.exe');
    fs.writeFileSync(setupPath, setupContent);
    fs.writeFileSync(portablePath, portableContent);

    const result = publishRelease(workspace, {
      version: '1.0.0',
      artifactPaths: [setupPath, portablePath],
      releaseNotes: 'v1.0.0 release notes',
    });

    expect(result.error).toBeNull();
    expect(result.files.sort()).toEqual(
      ['AI-SBOS-Portable-x64.exe', 'AI-SBOS-Setup-x64.exe', 'checksums.sha256', 'RELEASE_NOTES.txt'].sort(),
    );

    const releaseDir = path.join(workspace, 'Releases', '1.0.0');
    const copiedSetup = fs.readFileSync(path.join(releaseDir, 'AI-SBOS-Setup-x64.exe'));
    const copiedPortable = fs.readFileSync(path.join(releaseDir, 'AI-SBOS-Portable-x64.exe'));
    expect(sha256(copiedSetup)).toBe(sha256(setupContent));
    expect(sha256(copiedPortable)).toBe(sha256(portableContent));

    const checksums = fs.readFileSync(path.join(releaseDir, 'checksums.sha256'), 'utf8');
    expect(checksums).toContain(`${sha256(setupContent)}  AI-SBOS-Setup-x64.exe`);
    expect(checksums).toContain(`${sha256(portableContent)}  AI-SBOS-Portable-x64.exe`);

    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(buildOutput, { recursive: true, force: true });
  });

  it('skips artifact paths that do not exist instead of throwing', () => {
    const workspace = tmpDir('ai-sbos-release-ws-missing-');
    const result = publishRelease(workspace, {
      version: '2.0.0',
      artifactPaths: ['/nonexistent/path/AI-SBOS-Setup-x64.exe'],
      releaseNotes: 'notes',
    });
    expect(result.error).toBeNull();
    expect(result.files).toEqual(['checksums.sha256', 'RELEASE_NOTES.txt']);
    fs.rmSync(workspace, { recursive: true, force: true });
  });
});
