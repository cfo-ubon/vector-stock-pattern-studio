import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AppDb } from './db/appDb';
import { Logger } from './util/logger';
import { registerProjectHandlers } from './ipc/projectHandlers';
import { registerExportHandlers } from './ipc/exportHandlers';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerBackupHandlers, runBackup } from './ipc/backupHandlers';
import { registerRecoveryHandlers, writeRecoveryMarker, clearRecoveryMarker } from './ipc/recoveryHandlers';
import { registerDiagnosticsHandlers } from './ipc/diagnosticsHandlers';
import { registerAppHandlers } from './ipc/appHandlers';

// Electron main process — per DESKTOP_MIGRATION_AUDIT.md Section 7.
// Security posture (brief Section 11, all satisfied here):
//   contextIsolation: true, nodeIntegration: false, sandbox: true,
//   navigation locked to the app's own loaded file, new-window requests
//   blocked entirely (this app never needs to open a second window or
//   navigate to an external URL).

const APP_VERSION = '1.0.0-desktop.1';
const isDev = !app.isPackaged;

// Compiled to CommonJS (tsconfig.electron.json) specifically so `__dirname`
// is available natively here — no ESM `import.meta.url` workaround needed.
function __dirnameFromUrl(): string {
  return __dirname;
}

let mainWindow: BrowserWindow | null = null;
let db: AppDb | null = null;
let logger: Logger | null = null;
let currentProjectPath: string | undefined;
let hasUnsavedChanges = false;
let autosaveTimer: NodeJS.Timeout | null = null;
let backupTimer: NodeJS.Timeout | null = null;

// Single-instance lock — required by the brief ("Prevent duplicate app
// instances where appropriate"). A second launch focuses the existing
// window instead of opening a second one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false, // shown once ready-to-show fires — avoids a white flash, doubles as the "loading state" the brief asks for
    icon: path.join(__dirnameFromUrl(), '..', 'build', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirnameFromUrl(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Security: block navigation away from the app's own loaded content and
  // block window.open()/target=_blank entirely — this app never
  // legitimately navigates anywhere else.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // `app.getAppPath()` resolves correctly whether the app is running
  // unpacked (dev) or inside an asar archive (packaged) — the officially
  // recommended way to locate bundled app files, rather than hand-
  // constructing a path from `process.resourcesPath` that would only be
  // correct for one of the two cases.
  const indexPath = path.join(app.getAppPath(), 'dist-desktop', 'index.html');

  if (!fs.existsSync(indexPath)) {
    // Startup error handling per the brief — never a blank window with no
    // explanation.
    dialog.showErrorBox(
      'Vector Stock Pattern Studio — เริ่มต้นไม่สำเร็จ',
      `ไม่พบไฟล์แอปพลิเคชันที่ ${indexPath}\n\nกรุณาสร้างแอปด้วยคำสั่ง "npm run desktop:build" ก่อนเปิดใช้งาน หรือติดตั้งแอปใหม่อีกครั้ง`,
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(indexPath);

  mainWindow.on('close', (event) => {
    if (hasUnsavedChanges) {
      const choice = dialog.showMessageBoxSync(mainWindow!, {
        type: 'warning',
        buttons: ['บันทึกแล้วปิด', 'ปิดโดยไม่บันทึก', 'ยกเลิก'],
        defaultId: 0,
        cancelId: 2,
        title: 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก',
        message: 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการบันทึกก่อนปิดหรือไม่?',
      });
      if (choice === 2) {
        event.preventDefault();
        return;
      }
      if (choice === 0) {
        event.preventDefault();
        mainWindow!.webContents.send('app:requestSaveBeforeClose');
        return;
      }
    }
    clearRecoveryMarker();
  });
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:newProject') },
        { label: 'Open Project...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:openProject') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu:saveAs') },
        { label: 'Import JSON...', click: () => mainWindow?.webContents.send('menu:importJson') },
        { label: 'Export', click: () => mainWindow?.webContents.send('menu:export') },
        { label: 'Recent Projects', submenu: [{ label: '(loaded from app)', enabled: false }] },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu:redo') },
        { label: 'Reset Current Pattern', click: () => mainWindow?.webContents.send('menu:resetPattern') },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu:preferences') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'togglefullscreen', label: 'Full Screen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const, label: 'Toggle Developer Tools' }] : []),
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Validate Current Pattern', click: () => mainWindow?.webContents.send('menu:validatePattern') },
        { label: 'Duplicate Check', click: () => mainWindow?.webContents.send('menu:duplicateCheck') },
        { label: 'Generate Preview', click: () => mainWindow?.webContents.send('menu:generatePreview') },
        { label: 'Rebuild Metadata', click: () => mainWindow?.webContents.send('menu:rebuildMetadata') },
        { label: 'Open Export Folder', click: () => mainWindow?.webContents.send('menu:openExportFolder') },
        { type: 'separator' },
        { label: 'Backup Data', click: () => runBackup(currentProjectPath, 'manual', db!, logger!) },
        { label: 'Restore Data', click: () => mainWindow?.webContents.send('menu:restoreData') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Guide', click: () => shell.openPath(path.join(__dirnameFromUrl(), '..', '..', 'docs', 'DESKTOP_USER_GUIDE_TH.md')) },
        { label: 'Keyboard Shortcuts', click: () => mainWindow?.webContents.send('menu:keyboardShortcuts') },
        { label: 'Open Logs Folder', click: () => logger && shell.openPath(logger.getLogsFolder()) },
        {
          label: 'About Vector Stock Pattern Studio',
          click: () =>
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About',
              message: 'Vector Stock Pattern Studio',
              detail: `Version ${APP_VERSION}\nPublisher: CFO Ubon\nOffline vector seamless pattern design and stock production studio`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function startAutosave(): void {
  const intervalMinutes = db?.getSetting('autosaveIntervalMinutes') ?? 5;
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(
    () => {
      if (hasUnsavedChanges) mainWindow?.webContents.send('app:requestAutosave');
    },
    Math.max(1, intervalMinutes) * 60 * 1000,
  );
}

function startBackupTimer(): void {
  const intervalMinutes = db?.getSetting('backupIntervalMinutes') ?? 30;
  if (backupTimer) clearInterval(backupTimer);
  backupTimer = setInterval(
    () => {
      if (currentProjectPath) runBackup(currentProjectPath, 'automatic', db!, logger!);
    },
    Math.max(5, intervalMinutes) * 60 * 1000,
  );
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  db = new AppDb(userDataDir);
  logger = new Logger(userDataDir, db);
  logger.info('startup', `App starting, version ${APP_VERSION}, platform ${process.platform}`);

  registerAppHandlers(APP_VERSION);
  registerProjectHandlers(() => mainWindow, db, logger, APP_VERSION);
  registerExportHandlers(() => mainWindow, db, logger);
  registerSettingsHandlers(db);
  registerBackupHandlers(db, logger);
  registerRecoveryHandlers();
  registerDiagnosticsHandlers(() => mainWindow, db, logger, APP_VERSION);

  // Renderer reports its own dirty/current-file state so main knows when
  // it's safe to quit without prompting, and where autosave/backup should
  // write.
  ipcMain.on('app:reportState', (_event, state: { hasUnsavedChanges: boolean; currentProjectPath?: string; projectName?: string; autosavePath?: string }) => {
    hasUnsavedChanges = state.hasUnsavedChanges;
    currentProjectPath = state.currentProjectPath;
    if (state.autosavePath && state.projectName) {
      writeRecoveryMarker({ projectName: state.projectName, filePath: state.currentProjectPath, autosavePath: state.autosavePath });
    }
  });

  createWindow();
  buildMenu();
  startAutosave();
  startBackupTimer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  db?.close();
});

process.on('uncaughtException', (error) => {
  logger?.error('crash', `Uncaught exception: ${error.stack ?? error.message}`);
});
