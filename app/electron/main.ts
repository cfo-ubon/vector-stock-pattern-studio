import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from './util/logger';
import { registerAppHandlers } from './ipc/appHandlers';
import { registerWorkspaceHandlers } from './ipc/workspaceHandlers';
import { registerReleaseHandlers } from './ipc/releaseHandlers';
import { readWorkspaceConfig } from './workspaceConfig';

// Electron main process for AI-SBOS (Production Deployment Phase 1).
// Security posture (same generic pattern as the reference Electron shell
// on `codex/offline-windows-desktop`, re-verified here rather than
// assumed): contextIsolation: true, nodeIntegration: false, sandbox: true,
// navigation locked to the app's own loaded file, external links opened in
// the OS browser instead of a second window.
//
// Unlike that reference shell, this app has no "current project file"
// concept — it is a multi-screen dashboard (Mission Control, Today's
// Production, Portfolio, Backup Manager) backed entirely by IndexedDB,
// already complete and already certified (see PRODUCTION_CERTIFICATION.md).
// This main process therefore has no File > New/Open/Save Project menu and
// no autosave/backup timer tied to a project path — its only job is to
// host that already-built web app in a window and give it filesystem
// access to a user-chosen Workspace folder via IPC.

const APP_VERSION = '1.0.0';
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let logger: Logger | null = null;

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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  const indexPath = path.join(app.getAppPath(), 'dist-desktop', 'index.html');
  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'AI-SBOS — เริ่มต้นไม่สำเร็จ',
      `ไม่พบไฟล์แอปพลิเคชันที่ ${indexPath}\n\nกรุณาสร้างแอปด้วยคำสั่ง "npm run desktop:build" ก่อนเปิดใช้งาน หรือติดตั้งแอปใหม่อีกครั้ง`,
    );
    app.quit();
    return;
  }
  mainWindow.loadFile(indexPath);
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace Folder',
          click: async () => {
            const userDataDir = app.getPath('userData');
            const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
            if (workspacePath) shell.openPath(workspacePath);
          },
        },
        { label: 'Open Logs Folder', click: () => logger && shell.openPath(logger.getLogsFolder()) },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
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
      label: 'Help',
      submenu: [
        {
          label: 'About AI-SBOS',
          click: () =>
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About',
              message: 'AI-SBOS — Vector Stock Pattern Studio',
              detail: `Version ${APP_VERSION}\nPublisher: CFO Ubon\nOffline-first vector seamless pattern production studio`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
  logger = new Logger(workspacePath ? path.join(workspacePath, 'Logs') : path.join(userDataDir, 'logs'));
  logger.info('startup', `App starting, version ${APP_VERSION}, platform ${process.platform}`);

  registerAppHandlers(APP_VERSION);
  registerWorkspaceHandlers(() => mainWindow, userDataDir, APP_VERSION, logger);
  registerReleaseHandlers(userDataDir, logger);

  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  logger?.error('crash', `Uncaught exception: ${error.stack ?? error.message}`);
});
