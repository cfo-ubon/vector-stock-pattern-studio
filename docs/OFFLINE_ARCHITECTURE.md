# Offline Desktop Architecture

Developer-facing reference for the Electron desktop shell around Vector
Stock Pattern Studio's existing web app. See `DESKTOP_MIGRATION_AUDIT.md`
at the repo root for the original audit this architecture was designed
against, and `DESKTOP_OFFLINE_BUILD_REPORT.md` for what has actually been
verified.

## Guiding principle

The existing web app (`app/src/**`) is reused **unmodified** wherever
possible. The desktop shell is additive: a new `app/electron/` main
process, a new `app/src/desktop/` renderer-side adapter, and one
already-centralized function (`downloadBlobFile` in
`app/src/export/svgExporter.ts`) that branches to a native save dialog
when running inside Electron. Nothing about the web app's own behavior
changes when `window.vsp` (the desktop bridge) is absent.

## Process layout

```
app/electron/
  main.ts              BrowserWindow, app lifecycle, single-instance lock,
                        menu, autosave/backup timers, close confirmation
  preload.ts             contextBridge.exposeInMainWorld('vsp', ...) — the
                        ONLY renderer↔main bridge
  ipcContract.ts          shared channel allowlist + payload types (imported
                        by both preload.ts and every ipc/*.ts handler)
  ipc/
    projectHandlers.ts    open/save/save-as .vsps, recent projects
    exportHandlers.ts     native save dialogs for SVG/EPS/PNG/JSON/ZIP/CSV
    settingsHandlers.ts    get/set/getAll app settings
    backupHandlers.ts      manual/automatic backup + restore
    recoveryHandlers.ts    crash-recovery marker check/clear
    diagnosticsHandlers.ts logs folder, diagnostic package export
    appHandlers.ts         version, OS paths
  db/
    appDb.ts              SQLite (better-sqlite3) — OS-level data only
  vsps/
    vspsWriter.ts          builds a .vsps package
    vspsReader.ts           reads a .vsps package back (new — no prior
                          ZIP reader existed in this repo)
  security/
    paths.ts               filename sanitization, path-traversal checks,
                          safe-zip-entry-name validation
  util/
    logger.ts               structured file + SQLite logging

app/src/desktop/
  desktopBridge.ts          typed window.vsp accessor, isDesktop() check
  useDesktopIntegration.ts   React hook: dirty-state reporting, menu event
                            listeners, save-before-close/autosave requests
```

## Why two persistence layers

The web app already ships a mature IndexedDB persistence layer
(`app/src/storage/db.ts`, schema v5: `saved`, `projects`, `assets`,
`portfolioAssets`, `portfolioFiles`, `collections`) plus a full Project
domain model (`app/src/project/*`) and a full Backup & Restore subsystem
(`app/src/catalog/backup/*`, Portfolio Manager P3). Electron's renderer is
full Chromium — IndexedDB and localStorage persist to disk under the
app's `userData` profile directory identically to a browser tab, with
zero code changes.

So: **all Project/pattern/portfolio data stays in IndexedDB, unmodified.**
A second, much smaller SQLite database (`electron/db/appDb.ts`) exists
only for OS-level concerns that don't belong in a browser-origin
database: app settings, the recent-projects list (needed by the native
File menu before the renderer may have loaded), export history, the
backup log, and structured app logs.

## Security model

Matches Electron's own current best practices:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer's only access to the OS is `window.vsp.*`
  (`preload.ts`) — every method calls `ipcRenderer.invoke` with a channel
  name drawn from the shared `IPC_CHANNELS` allowlist (`ipcContract.ts`),
  never a renderer-supplied string.
- `will-navigate` and `setWindowOpenHandler` are locked down in
  `main.ts` — the app never navigates away from its own loaded content;
  an `https://` link (e.g. a marketplace contributor-portal help link)
  opens the user's default browser via `shell.openExternal`, never inside
  the app window.
- Every file-system-touching IPC handler validates its own input
  (`electron/security/paths.ts`): filenames are sanitized against
  Windows-reserved characters/names, `.vsps` ZIP entries are checked for
  path traversal before extraction, and export paths are constrained to
  what the user picked via a native dialog.
- `better-sqlite3` runs in the main process only — the renderer never
  gets a database handle, only the narrow `settings:get`/`settings:set`
  IPC surface.

## Build pipeline

Two independent Vite build configs:

- `vite.config.ts` (unchanged) — `base:
  '/vector-stock-pattern-studio/studio/'`, outputs to `../studio` for the
  existing GitHub Pages deployment. Never touched by desktop work.
- `vite.config.desktop.ts` (new) — `base: './'` (relative paths, required
  for `file://` loading), outputs to `app/dist-desktop` (gitignored).

`app/electron/**/*.ts` compiles separately via `tsconfig.electron.json`
(CommonJS output, since Electron's preload/main process loading is most
reliably CommonJS across Electron versions) to `app/dist-electron`
(gitignored). `npm run desktop:build:main` also writes a
`dist-electron/package.json` with `{"type":"commonjs"}` so Node doesn't
misinterpret the compiled output as ESM under the app's own top-level
`"type": "module"`.

`electron-builder.yml` packages `dist-desktop/` + `dist-electron/` +
`package.json` into the NSIS installer and portable `.exe` (see
`docs/RELEASE_PROCESS_DESKTOP.md`).

## Known environment limitation (documented, not a design flaw)

This architecture was built and statically verified (TypeScript
compilation, ESLint/oxlint-equivalent checks, unit tests, an offline
static-scan of the real built bundle) in a Linux container that could not
download the actual Electron runtime binary (blocked by that
environment's network policy) or run a Windows machine. See
`DESKTOP_OFFLINE_BUILD_REPORT.md` for the exact list of what has been
verified by running real code versus what is code-complete but needs a
Windows/CI machine to execute for the first time.
