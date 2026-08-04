import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// workspaceHandlers.ts imports `electron` (ipcMain/dialog/app) purely to
// register IPC handlers — the pure logic under test here (initialize/
// verify/migrate) never touches those APIs, so a minimal stub is enough to
// let the module load under vitest's Node/jsdom test environment (no real
// Electron process available there).
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  app: { getPath: vi.fn(() => '') },
}));

const { initializeWorkspaceFolders, verifyWorkspace, migrateWorkspace } = await import('./workspaceHandlers');
const { listWorkspaceFolders, WORKSPACE_MANIFEST_FILENAME } = await import('../workspaceLayout');

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

describe('initializeWorkspaceFolders', () => {
  it('creates every folder in the taxonomy plus a manifest, idempotently', () => {
    const root = tmpDir('ai-sbos-init-');
    const created = initializeWorkspaceFolders(root, '1.0.0');
    expect(created.sort()).toEqual([...listWorkspaceFolders()].sort());
    for (const folder of listWorkspaceFolders()) {
      expect(fs.existsSync(path.join(root, folder))).toBe(true);
    }
    expect(fs.existsSync(path.join(root, WORKSPACE_MANIFEST_FILENAME))).toBe(true);

    // Re-running must not error and must not report anything as newly
    // created — a deleted-by-user folder is the only case that should
    // reappear in `created`.
    const secondRun = initializeWorkspaceFolders(root, '1.0.0');
    expect(secondRun).toEqual([]);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('recreates a folder the user deleted outside the app, without re-creating the rest', () => {
    const root = tmpDir('ai-sbos-init-partial-');
    initializeWorkspaceFolders(root, '1.0.0');
    fs.rmSync(path.join(root, 'Backups'), { recursive: true, force: true });
    const created = initializeWorkspaceFolders(root, '1.0.0');
    expect(created).toEqual(['Backups']);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('verifyWorkspace', () => {
  it('reports a non-existent path honestly, with every folder listed as missing', async () => {
    const root = path.join(os.tmpdir(), `ai-sbos-does-not-exist-${Date.now()}`);
    const result = await verifyWorkspace(root);
    expect(result.exists).toBe(false);
    expect(result.missingFolders.sort()).toEqual([...listWorkspaceFolders()].sort());
  });

  it('reports a fully initialized workspace as writable with no missing folders', async () => {
    const root = tmpDir('ai-sbos-verify-');
    initializeWorkspaceFolders(root, '1.0.0');
    const result = await verifyWorkspace(root);
    expect(result.exists).toBe(true);
    expect(result.isDirectory).toBe(true);
    expect(result.writable).toBe(true);
    expect(result.missingFolders).toEqual([]);
    expect(result.error).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports a path that exists but is a file, not a directory, as an explicit error', async () => {
    const parent = tmpDir('ai-sbos-verify-file-');
    const filePath = path.join(parent, 'not-a-folder.txt');
    fs.writeFileSync(filePath, 'x');
    const result = await verifyWorkspace(filePath);
    expect(result.exists).toBe(true);
    expect(result.isDirectory).toBe(false);
    expect(result.error).not.toBeNull();
    fs.rmSync(parent, { recursive: true, force: true });
  });
});

describe('migrateWorkspace', () => {
  it('copies every file byte-for-byte identically into the new root and never deletes the old root', async () => {
    const oldRoot = tmpDir('ai-sbos-migrate-old-');
    const newParent = tmpDir('ai-sbos-migrate-new-parent-');
    const newRoot = path.join(newParent, 'NewWorkspace');

    initializeWorkspaceFolders(oldRoot, '1.0.0');
    fs.writeFileSync(path.join(oldRoot, 'Portfolio', 'sample.svg'), '<svg>content</svg>'.repeat(50));
    fs.writeFileSync(path.join(oldRoot, 'Backups', 'backup.vspsb'), crypto.randomBytes(500_000));
    fs.mkdirSync(path.join(oldRoot, 'Marketplace', 'Shutterstock', 'nested', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(oldRoot, 'Marketplace', 'Shutterstock', 'nested', 'deep', 'submission.json'), JSON.stringify({ ok: true }));

    const before = new Map<string, string>();
    const walk = (dir: string, base: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, base);
        else before.set(path.relative(base, full), sha256(fs.readFileSync(full)));
      }
    };
    walk(oldRoot, oldRoot);

    const result = await migrateWorkspace(oldRoot, newRoot);

    expect(result.error).toBeNull();
    expect(result.verified).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.filesCopied).toBe(before.size);

    for (const [rel, hash] of before) {
      const destPath = path.join(newRoot, rel);
      expect(fs.existsSync(destPath)).toBe(true);
      expect(sha256(fs.readFileSync(destPath))).toBe(hash);
    }

    // Part 6: "No data loss" — the old copy must survive migration.
    expect(fs.existsSync(oldRoot)).toBe(true);
    expect(fs.existsSync(path.join(oldRoot, 'Portfolio', 'sample.svg'))).toBe(true);

    fs.rmSync(oldRoot, { recursive: true, force: true });
    fs.rmSync(newParent, { recursive: true, force: true });
  });

  it('reports a missing source root as an explicit error instead of throwing', async () => {
    const oldRoot = path.join(os.tmpdir(), `ai-sbos-migrate-missing-${Date.now()}`);
    const newRoot = tmpDir('ai-sbos-migrate-new-');
    const result = await migrateWorkspace(oldRoot, newRoot);
    expect(result.error).not.toBeNull();
    fs.rmSync(newRoot, { recursive: true, force: true });
  });
});
