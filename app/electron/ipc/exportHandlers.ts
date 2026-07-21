import { ipcMain, dialog, shell, type BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeFilename } from '../security/paths';
import type { AppDb } from '../db/appDb';
import type { Logger } from '../util/logger';
import type { SaveExportFileInput, SaveExportFileResult } from '../ipcContract';
import { randomUUID } from 'node:crypto';

// Native save dialogs for every export format the app already produces
// (SVG/EPS/PNG/JSON/ZIP/CSV) — replaces the web version's `<a download>`
// blob-URL trick with a real Windows save dialog. The bytes/text being
// saved are entirely unchanged (built by the existing, untouched
// `export/svgExporter.ts`/`epsExporter.ts`/`zip.ts` in the renderer) —
// this handler's only job is "take these already-correct bytes and let
// the user pick where they go on disk."

const EXTENSION_FILTERS: Record<SaveExportFileInput['extension'], { name: string; extensions: string[] }> = {
  svg: { name: 'SVG Vector', extensions: ['svg'] },
  eps: { name: 'EPS Vector', extensions: ['eps'] },
  png: { name: 'PNG Image', extensions: ['png'] },
  json: { name: 'JSON', extensions: ['json'] },
  zip: { name: 'ZIP Archive', extensions: ['zip'] },
  csv: { name: 'CSV', extensions: ['csv'] },
};

export function registerExportHandlers(getWindow: () => BrowserWindow | null, db: AppDb, logger: Logger): void {
  ipcMain.handle('export:saveFile', async (_event, input: unknown): Promise<SaveExportFileResult> => {
    const data = input as Partial<SaveExportFileInput> | undefined;
    if (!data || typeof data.suggestedName !== 'string' || !data.extension || !(data.extension in EXTENSION_FILTERS)) {
      return { ok: false, error: 'Invalid export request.' };
    }
    const win = getWindow();
    if (!win) return { ok: false, error: 'No active window.' };

    const settings = db.getAllSettings();
    const suggestedFile = `${sanitizeFilename(data.suggestedName)}.${data.extension}`;
    const defaultPath = settings.defaultExportFolder ? path.join(settings.defaultExportFolder, suggestedFile) : suggestedFile;

    const result = await dialog.showSaveDialog(win, {
      title: 'บันทึกไฟล์ (Export)',
      defaultPath,
      filters: [EXTENSION_FILTERS[data.extension], { name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    try {
      if (data.isBinary) {
        const bytes = data.data as ArrayBuffer;
        fs.writeFileSync(result.filePath, Buffer.from(bytes));
      } else {
        fs.writeFileSync(result.filePath, data.data as string, 'utf-8');
      }
      db.recordExport({ id: randomUUID(), exportedAt: Date.now(), exportType: data.extension, targetPath: result.filePath });
      if (settings.openExportFolderAfterExport) shell.showItemInFolder(result.filePath);
      logger.info('export', `Exported ${data.extension.toUpperCase()} to ${result.filePath}`);
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      logger.error('export', `Export failed: ${(e as Error).message}`);
      return { ok: false, error: 'บันทึกไฟล์ไม่สำเร็จ' };
    }
  });

  ipcMain.handle('export:selectFolder', async () => {
    const win = getWindow();
    if (!win) return { ok: false as const };
    const result = await dialog.showOpenDialog(win, { title: 'เลือกโฟลเดอร์ (Select Folder)', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return { ok: false as const };
    return { ok: true as const, folderPath: result.filePaths[0] };
  });

  ipcMain.handle('export:openFolder', (_event, folderPath: unknown) => {
    if (typeof folderPath === 'string' && fs.existsSync(folderPath)) {
      shell.openPath(folderPath);
    }
  });
}
