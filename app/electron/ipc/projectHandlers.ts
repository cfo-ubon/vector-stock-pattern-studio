import { ipcMain, dialog, type BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildVspsPackage } from '../vsps/vspsWriter';
import { parseVspsPackage, VspsFormatError } from '../vsps/vspsReader';
import { sanitizeFilename, resolveWithinBase } from '../security/paths';
import type { AppDb } from '../db/appDb';
import type { Logger } from '../util/logger';
import type { OpenProjectResult, SaveProjectInput, SaveProjectResult } from '../ipcContract';

// Project open/save/save-as over the `.vsps` format — the desktop-native
// front door to the existing, unmodified `project/projectJson.ts`
// (`exportProjectJson`/`importProjectJson`) in the renderer. This module
// never parses or validates Project *content* itself; it only handles the
// file-system envelope (native dialogs, the .vsps ZIP, recent-projects
// list) and hands the raw `project.json` string back to the renderer,
// which already knows how to validate and load it.

export function registerProjectHandlers(getWindow: () => BrowserWindow | null, db: AppDb, logger: Logger, appVersion: string): void {
  ipcMain.handle('project:open', async (): Promise<OpenProjectResult> => {
    const win = getWindow();
    if (!win) return { ok: false, error: 'No active window.' };
    const result = await dialog.showOpenDialog(win, {
      title: 'เปิดโปรเจกต์ (Open Project)',
      filters: [{ name: 'Vector Stock Pattern Studio Project', extensions: ['vsps'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'canceled' };
    return openProjectFromPath(result.filePaths[0], db, logger);
  });

  ipcMain.handle('project:openPath', async (_event, filePath: unknown): Promise<OpenProjectResult> => {
    if (typeof filePath !== 'string') return { ok: false, error: 'Invalid path.' };
    return openProjectFromPath(filePath, db, logger);
  });

  ipcMain.handle('project:save', async (_event, input: unknown): Promise<SaveProjectResult> => {
    return handleSave(getWindow, input, db, logger, appVersion, false);
  });

  ipcMain.handle('project:saveAs', async (_event, input: unknown): Promise<SaveProjectResult> => {
    return handleSave(getWindow, input, db, logger, appVersion, true);
  });

  ipcMain.handle('project:listRecent', () => {
    return db.listRecentProjects();
  });

  ipcMain.handle('project:removeRecent', (_event, filePath: unknown) => {
    if (typeof filePath === 'string') db.removeRecentProject(filePath);
  });
}

function openProjectFromPath(filePath: string, db: AppDb, logger: Logger): OpenProjectResult {
  try {
    if (path.extname(filePath).toLowerCase() !== '.vsps') {
      return { ok: false, error: 'ไฟล์ต้องเป็นนามสกุล .vsps เท่านั้น' };
    }
    const buf = fs.readFileSync(filePath);
    const parsed = parseVspsPackage(buf);
    db.addRecentProject({ path: filePath, projectName: parsed.manifest.project_name, lastOpenedAt: Date.now() });
    logger.info('project', `Opened project "${parsed.manifest.project_name}" from ${filePath}`);
    return { ok: true, filePath, projectJson: parsed.projectJson, manifest: parsed.manifest };
  } catch (e) {
    const message = e instanceof VspsFormatError ? e.message : 'ไม่สามารถเปิดไฟล์โปรเจกต์นี้ได้ ไฟล์อาจเสียหาย';
    logger.error('project', `Failed to open ${filePath}: ${message}`);
    return { ok: false, error: message };
  }
}

async function handleSave(
  getWindow: () => BrowserWindow | null,
  input: unknown,
  db: AppDb,
  logger: Logger,
  appVersion: string,
  forceSaveAs: boolean,
): Promise<SaveProjectResult> {
  const data = input as Partial<SaveProjectInput> | undefined;
  if (!data || typeof data.projectJson !== 'string' || typeof data.projectName !== 'string' || typeof data.projectId !== 'string') {
    return { ok: false, error: 'ข้อมูลโปรเจกต์ไม่ถูกต้อง' };
  }

  let targetPath = !forceSaveAs && typeof data.filePath === 'string' ? data.filePath : undefined;

  if (!targetPath) {
    const win = getWindow();
    if (!win) return { ok: false, error: 'No active window.' };
    const result = await dialog.showSaveDialog(win, {
      title: forceSaveAs ? 'บันทึกเป็น (Save As)' : 'บันทึกโปรเจกต์ (Save Project)',
      defaultPath: `${sanitizeFilename(data.projectName)}.vsps`,
      filters: [{ name: 'Vector Stock Pattern Studio Project', extensions: ['vsps'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'canceled' };
    targetPath = result.filePath;
  }

  try {
    const now = Date.now();
    const previews = (data.previews ?? []).map((p) => ({
      filename: sanitizeFilename(p.filename, 'preview.png'),
      pngBytes: Buffer.from(p.base64Png, 'base64'),
    }));
    const buf = await buildVspsPackage({
      projectJson: data.projectJson!,
      projectId: data.projectId!,
      projectName: data.projectName!,
      appVersion,
      createdAt: now,
      updatedAt: now,
      previews,
    });

    // Write to a temp file first, then rename — an interrupted write
    // (crash, power loss) never leaves a half-written .vsps in place of
    // the previous good save.
    const dir = path.dirname(targetPath);
    const resolvedTmp = resolveWithinBase(dir, `.${path.basename(targetPath)}.tmp`);
    const tmpPath = resolvedTmp ?? `${targetPath}.tmp`;
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, targetPath);

    db.addRecentProject({ path: targetPath, projectName: data.projectName!, lastOpenedAt: now });
    logger.info('project', `Saved project "${data.projectName}" to ${targetPath}`);
    return { ok: true, filePath: targetPath };
  } catch (e) {
    const message = (e as Error).message;
    logger.error('project', `Failed to save to ${targetPath}: ${message}`);
    return { ok: false, error: 'บันทึกไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}
