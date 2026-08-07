import { ipcMain, dialog, app, type BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { listWorkspaceFolders, WORKSPACE_MANIFEST_FILENAME, type WorkspaceManifest } from '../workspaceLayout';
import { readWorkspaceConfig, writeWorkspaceConfig } from '../workspaceConfig';
import { resolveWithinBase, sanitizeFilename } from '../security/paths';
import type { Logger } from '../util/logger';

export interface WorkspaceVerifyResult {
  exists: boolean;
  isDirectory: boolean;
  writable: boolean;
  freeBytes: number | null;
  missingFolders: string[];
  error: string | null;
}

export interface WorkspaceMigrateResult {
  filesCopied: number;
  bytesCopied: number;
  verified: boolean;
  mismatches: string[];
  error: string | null;
}

function probeWritable(dir: string): boolean {
  const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

async function getFreeBytes(dir: string): Promise<number | null> {
  try {
    const stats = await fs.promises.statfs(dir);
    return stats.bavail * stats.bsize;
  } catch {
    return null; // Never silently fail the whole verify — free-space is best-effort, reported as unknown instead of crashing the check.
  }
}

/** Creates every folder Part 1 requires, idempotently — re-running on an
 * already-initialized Workspace just fills in whatever is missing rather
 * than erroring, since a fresh app upgrade or a folder deleted by the user
 * outside the app must never brick Workspace verification. */
export function initializeWorkspaceFolders(workspaceRoot: string, appVersion: string): string[] {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const created: string[] = [];
  for (const folder of listWorkspaceFolders()) {
    const full = path.join(workspaceRoot, folder);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      created.push(folder);
    }
  }
  const manifestPath = path.join(workspaceRoot, WORKSPACE_MANIFEST_FILENAME);
  const now = new Date().toISOString();
  const existing: Partial<WorkspaceManifest> = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Partial<WorkspaceManifest>)
    : {};
  const manifest: WorkspaceManifest = {
    schemaVersion: 1,
    createdAt: existing.createdAt ?? now,
    lastVerifiedAt: now,
    appVersion,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return created;
}

export async function verifyWorkspace(workspaceRoot: string): Promise<WorkspaceVerifyResult> {
  if (!fs.existsSync(workspaceRoot)) {
    return { exists: false, isDirectory: false, writable: false, freeBytes: null, missingFolders: listWorkspaceFolders(), error: null };
  }
  const stat = fs.statSync(workspaceRoot);
  if (!stat.isDirectory()) {
    return { exists: true, isDirectory: false, writable: false, freeBytes: null, missingFolders: [], error: 'Path exists but is not a folder.' };
  }
  const writable = probeWritable(workspaceRoot);
  const freeBytes = await getFreeBytes(workspaceRoot);
  const missingFolders = listWorkspaceFolders().filter((f) => !fs.existsSync(path.join(workspaceRoot, f)));
  return { exists: true, isDirectory: true, writable, freeBytes, missingFolders, error: null };
}

async function copyFileVerified(src: string, dest: string): Promise<{ bytes: number; ok: boolean }> {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
  const [srcStat, destStat] = [fs.statSync(src), fs.statSync(dest)];
  return { bytes: destStat.size, ok: srcStat.size === destStat.size };
}

async function walkFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full, base)));
    else files.push(path.relative(base, full));
  }
  return files;
}

/** Copies every file from `oldRoot` into `newRoot`, verifying each copy by
 * size before considering it successful (Part 6: "No data loss"). Never
 * deletes `oldRoot` — that is a deliberate, separate, user-confirmed step,
 * not something this function does automatically. */
export async function migrateWorkspace(oldRoot: string, newRoot: string): Promise<WorkspaceMigrateResult> {
  if (!fs.existsSync(oldRoot)) return { filesCopied: 0, bytesCopied: 0, verified: true, mismatches: [], error: 'Source Workspace does not exist.' };
  try {
    const relativeFiles = await walkFiles(oldRoot);
    let bytesCopied = 0;
    const mismatches: string[] = [];
    for (const rel of relativeFiles) {
      const src = path.join(oldRoot, rel);
      const dest = path.join(newRoot, rel);
      const result = await copyFileVerified(src, dest);
      bytesCopied += result.bytes;
      if (!result.ok) mismatches.push(rel);
    }
    return { filesCopied: relativeFiles.length, bytesCopied, verified: mismatches.length === 0, mismatches, error: null };
  } catch (e) {
    return { filesCopied: 0, bytesCopied: 0, verified: false, mismatches: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function registerWorkspaceHandlers(getWindow: () => BrowserWindow | null, userDataDir: string, appVersion: string, logger: Logger): void {
  ipcMain.handle('workspace:selectFolder', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win ?? undefined!, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('workspace:getConfiguredPath', () => readWorkspaceConfig(userDataDir).workspacePath);

  ipcMain.handle('workspace:setConfiguredPath', (_event, workspacePath: string) => {
    writeWorkspaceConfig(userDataDir, { workspacePath });
    logger.info('workspace', `Workspace path set to ${workspacePath}`);
    return true;
  });

  ipcMain.handle('workspace:getDefaultSuggestedPath', () => path.join(app.getPath('documents'), 'AI-SBOS'));

  ipcMain.handle('workspace:initialize', (_event, workspacePath: string) => {
    const created = initializeWorkspaceFolders(workspacePath, appVersion);
    logger.info('workspace', `Initialized Workspace at ${workspacePath}; created ${created.length} new folder(s).`);
    return { created, allFolders: listWorkspaceFolders() };
  });

  ipcMain.handle('workspace:verify', async (_event, workspacePath: string) => verifyWorkspace(workspacePath));

  ipcMain.handle('workspace:migrate', async (_event, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    logger.info('workspace', `Migrating Workspace from ${oldPath} to ${newPath}`);
    const result = await migrateWorkspace(oldPath, newPath);
    logger.info('workspace', `Migration result: ${JSON.stringify(result)}`);
    return result;
  });

  ipcMain.handle('workspace:writeFile', async (_event, { relativePath, data }: { relativePath: string; data: ArrayBuffer }) => {
    const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
    if (!workspacePath) throw new Error('No Workspace configured.');
    const safeName = relativePath
      .split('/')
      .map((seg) => sanitizeFilename(seg))
      .join('/');
    const dest = resolveWithinBase(workspacePath, safeName);
    if (!dest) throw new Error('Refused to write outside the Workspace.');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, Buffer.from(data));
    return { path: dest, bytes: data.byteLength };
  });

  ipcMain.handle('workspace:readFile', async (_event, relativePath: string) => {
    const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
    if (!workspacePath) throw new Error('No Workspace configured.');
    const src = resolveWithinBase(workspacePath, relativePath);
    if (!src) throw new Error('Refused to read outside the Workspace.');
    const buf = await fs.promises.readFile(src);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });

  ipcMain.handle('workspace:listDir', async (_event, relativePath: string) => {
    const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
    if (!workspacePath) throw new Error('No Workspace configured.');
    const dir = resolveWithinBase(workspacePath, relativePath);
    if (!dir) throw new Error('Refused to list outside the Workspace.');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  });
}
