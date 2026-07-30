import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from './util/logger';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerAppHandlers } from './ipc/appHandlers';

// Electron main process — Build 027 Phase 4.
//
// Architecture note (the key difference from the forward-ported
// `codex/offline-windows-desktop` branch this was adapted from): this app
// has NO main-process-owned data store. The renderer loaded below is the
// exact same React application that runs at
// https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/ — it
// persists everything via IndexedDB/localStorage inside its own Chromium
// renderer process, exactly like it does in any browser. Electron's
// BrowserWindow renderer IS a Chromium instance, so none of that needs a
// bridge at all. The main process's only job is the one thing a browser
// genuinely cannot do: native Open/Save file dialogs (for `.vspsb`
// backups and SVG/EPS/PNG/JPEG/ZIP exports) and basic app info — see
// `ipcContract.ts`'s header comment for why the old branch's much larger
// `project:*`/`settings:*`/`backup:*` IPC surface was NOT forward-ported.
//
// Security posture (all satisfied here, verified against the brief):
//   contextIsolation: true, nodeIntegration: false, sandbox: true,
//   webSecurity: true, no remote module (never enabled in any Electron
//   version this app targets), navigation locked to the app's own loaded
//   file, new-window requests blocked (external http(s) links open in the
//   OS default browser via `shell.openExternal`, never inside the app).

const APP_VERSION = '1.0.0-desktop.1';
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let logger: Logger | null = null;

// Single-instance lock — a second launch focuses the existing window
// instead of opening a duplicate one.
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
    show: false, // shown once ready-to-show fires, avoiding a white flash
    icon: path.join(__dirname, '..', 'build', 'icons', 'icon.png'),
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

  // Security: block navigation away from the app's own loaded content,
  // and block window.open()/target=_blank from opening a second Electron
  // window entirely — this app never legitimately needs either. An
  // http(s) link (e.g. the "User Guide" help-menu item) is instead
  // handed to the OS's default browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // `app.getAppPath()` resolves correctly whether running unpacked (dev)
  // or inside an asar archive (packaged) — the officially recommended way
  // to locate bundled app files.
  const indexPath = path.join(app.getAppPath(), 'dist-desktop', 'index.html');

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'Vector Stock Pattern Studio — เริ่มต้นไม่สำเร็จ',
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
        { label: 'Create Backup (.vspsb)...', click: () => mainWindow?.webContents.send('menu:createBackup') },
        { label: 'Restore Backup (.vspsb)...', click: () => mainWindow?.webContents.send('menu:restoreBackup') },
        { label: 'Export Current...', click: () => mainWindow?.webContents.send('menu:exportCurrent') },
        { label: 'Open Export Folder', click: () => mainWindow?.webContents.send('menu:openExportFolder') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
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
      label: 'Help',
      submenu: [
        { label: 'User Guide', click: () => shell.openExternal('https://github.com/cfo-ubon/vector-stock-pattern-studio/blob/main/docs/USER_GUIDE.md') },
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

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  logger = new Logger(userDataDir);
  logger.info('startup', `App starting, version ${APP_VERSION}, platform ${process.platform}`);

  registerAppHandlers(APP_VERSION, logger);
  registerFileHandlers(() => mainWindow);

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
