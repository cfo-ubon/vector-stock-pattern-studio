import { ipcMain, dialog, type BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import { hasAllowedExtension, sanitizeFilename } from '../security/paths';
import type { OpenBinaryFileResult, SaveBinaryFileResult, SelectFolderResult } from '../ipcContract';

// Build 027 — the ONLY filesystem-writing IPC surface this app exposes.
// Deliberately generic (open/save arbitrary allowlisted-extension bytes)
// rather than modeling "projects" or "backups" as main-process concepts —
// the renderer already owns all of that via IndexedDB/localStorage and
// `.vspsb`; the main process's only job is the one thing a browser
// cannot do: show a native file dialog.
//
// Security invariant: the path written to or read from is ALWAYS exactly
// what `dialog.showSaveDialog`/`showOpenDialog` returned — never a raw
// string supplied by the renderer. This eliminates path traversal for
// these handlers by construction, not just by validation; the extension
// allowlist below is a second, independent layer on top of that.

function getWindow(getMainWindow: () => BrowserWindow | null): BrowserWindow {
  const win = getMainWindow();
  if (!win) throw new Error('No application window is available.');
  return win;
}

export function registerFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('file:openBinary', async (_event, options: { filters: Array<{ name: string; extensions: string[] }> }): Promise<OpenBinaryFileResult> => {
    try {
      const result = await dialog.showOpenDialog(getWindow(getMainWindow), {
        properties: ['openFile'],
        filters: options.filters,
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true };
      const filePath = result.filePaths[0];
      if (!hasAllowedExtension(filePath)) {
        return { ok: false, error: 'This file type is not supported.' };
      }
      const buffer = await fs.readFile(filePath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      return { ok: true, filePath, data: arrayBuffer };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'file:saveBinary',
    async (_event, options: { suggestedName: string; filters: Array<{ name: string; extensions: string[] }>; data: ArrayBuffer }): Promise<SaveBinaryFileResult> => {
      try {
        const safeName = sanitizeFilename(options.suggestedName);
        const result = await dialog.showSaveDialog(getWindow(getMainWindow), {
          defaultPath: safeName,
          filters: options.filters,
        });
        if (result.canceled || !result.filePath) return { ok: true, canceled: true };
        if (!hasAllowedExtension(result.filePath)) {
          return { ok: false, error: 'This file type is not supported.' };
        }
        await fs.writeFile(result.filePath, Buffer.from(options.data));
        return { ok: true, filePath: result.filePath };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle('file:selectFolder', async (): Promise<SelectFolderResult> => {
    try {
      const result = await dialog.showOpenDialog(getWindow(getMainWindow), { properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true };
      return { ok: true, folderPath: result.filePaths[0] };
    } catch {
      return { ok: false, canceled: false };
    }
  });

  ipcMain.handle('file:openFolder', async (_event, folderPath: string): Promise<{ ok: boolean; error?: string }> => {
    // `shell.openPath` on a *file* launches that file with its default
    // OS handler — effectively arbitrary execution if pointed at an
    // executable. This handler is only ever meant to reveal a directory
    // in the system file explorer, so it verifies the target is actually
    // an existing directory (never a file, never a nonexistent path)
    // before ever calling `shell.openPath`, regardless of what string the
    // renderer sends.
    try {
      const stat = await fs.stat(folderPath);
      if (!stat.isDirectory()) return { ok: false, error: 'Not a directory.' };
      const { shell } = await import('electron');
      const openError = await shell.openPath(folderPath);
      return openError ? { ok: false, error: openError } : { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
