# Desktop Offline Build Report — Vector Stock Pattern Studio

## Summary

- **Branch:** `codex/offline-windows-desktop`
- **Base commit (code checkpoint):** `76bc9f99292e6c84076a0fdda37c5181da83a9f1`
- **This report's commit:** see the commit that adds this file (Phase 9 —
  documentation + helper scripts)
- **App version:** `1.0.0-desktop.1` (`app/package.json`)
- **Electron:** `^43.1.1`
- **electron-builder:** `^26.15.3`
- **better-sqlite3:** `^13.0.1`
- **Files changed (this migration, cumulative):** 36 files in the Phase
  2-7 checkpoint (`76bc9f9`, +5667 lines) plus 12 files in Phase 9
  (`DESKTOP_MIGRATION_AUDIT.md` was committed separately as `50a1107`;
  README.md update + 7 new `docs/*` files + 4 root `*.bat` files +
  this report)

## Architecture summary

Electron main process (`app/electron/main.ts`) hosts a single
`BrowserWindow` loading the existing Vite-built React renderer
(`dist-desktop/index.html`, `vite.config.desktop.ts`, `base: './'`).
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; the
renderer only ever reaches the main process through
`app/electron/preload.ts`'s `contextBridge.exposeInMainWorld('vsp', ...)`,
gated by an explicit IPC channel allowlist (`app/electron/ipcContract.ts`).

Two persistence layers, deliberately kept separate:

- **IndexedDB** (`app/src/storage/db.ts`, unmodified) — all
  app-domain data: patterns, projects, portfolio, Saved Library. Runs
  inside the renderer exactly as it does on the web.
- **SQLite** (`app/electron/db/appDb.ts`, via `better-sqlite3`, new) —
  OS-level-only concerns that don't belong in the browser storage model:
  app settings, recent-projects list, export history, backup log, app
  logs. Lives at `%APPDATA%\Vector Stock Pattern Studio\`.

Project files use a new `.vsps` format (`app/electron/vsps/`): a ZIP
(reusing the app's existing hand-rolled `buildZip` from
`src/export/zip.ts` unmodified) containing `manifest.json` (new) +
`project.json` (byte-for-byte the existing `exportProjectJson()` output)
+ optional `previews/*.png`.

The single integration point for native file export is
`downloadBlobFile()` in `app/src/export/svgExporter.ts`: on desktop it
now delegates to a native Save dialog via IPC; on web it runs the exact
original `<a download>` blob-URL code, unchanged. No other call site in
`App.tsx` was touched.

## Storage locations (Windows)

| Data | Location |
|---|---|
| `.vsps` project files | wherever the user chooses (Save dialog) |
| Exported SVG/EPS/PNG/ZIP | wherever the user chooses (Save dialog) |
| Settings, recent projects, logs, SQLite DB | `%APPDATA%\Vector Stock Pattern Studio\` |
| Backups | `Documents\Vector Stock Pattern Studio\Backups\` |

## Installer / portable filenames (per `electron-builder.yml`)

- `VectorStockPatternStudio-Setup-x64.exe` (NSIS installer, per-user,
  `deleteAppDataOnUninstall: false`)
- `VectorStockPatternStudio-Portable-x64.exe`

## SHA-256 checksums

**Not available.** No installer or portable `.exe` was produced in this
environment (see "What was not verified" below) — there is nothing to
hash yet. `docs/RELEASE_PROCESS_DESKTOP.md` documents the exact
`Get-FileHash` / `sha256sum` commands to run once a real build exists.

## What was actually verified in this environment

All of the following were run for real, in this container, with real
output — not asserted from reading code:

- **Full existing regression suite:** `npm test` → **271/271 test files
  passing, 3063/3063 tests passing** (271 files = the pre-existing 270 +
  the 1 new `app/electron/vsps/vspsFormat.test.ts`). This proves the
  desktop integration (the single `downloadBlobFile()` branch point) did
  not break the existing web app.
- **`.vsps` format round-trip tests** (8/8 passing, inside the same
  suite): includes a real Thai-text project-name round-trip, a
  no-previews case, corrupted-buffer rejection, missing-`project.json`
  rejection, and 4 `security/paths.ts` path-safety unit tests.
- **TypeScript compilation, renderer:** `tsconfig.app.json` — clean.
- **TypeScript compilation, Electron main/preload/IPC/db/vsps:**
  `tsc -p tsconfig.electron.json --noEmit` — clean (after fixing real
  TS1343 `import.meta` error, TS2352 cast error, TS6133 unused-param
  error, and adding the missing `@types/better-sqlite3` — all documented
  in the checkpoint commit).
- **`better-sqlite3` under plain Node:** installs, loads, and its
  CRUD methods work correctly against Node's own ABI.
- **Static offline-dependency scan against a real built bundle:**
  `npx tsx scripts/verifyOfflineBuild.ts` run against a real
  `npm run desktop:build:renderer` output — **PASS, 0 unreviewed
  findings across 12 built files.** Every allowlisted exception (SVG/XML
  namespace URIs, a JSON-Schema identifier, two explicit user-click
  external help links, ~13 pre-existing stock-marketplace contributor
  links, Vite's own modulepreload `fetch()` polyfill) was individually
  traced to its source before being allowed, not blanket-suppressed.
- **Windows `.ico` generation:** `app/build/icons/icon.ico` was
  generated from the app's real existing SVG favicon via Playwright +
  hand-written ICONDIR/ICONDIRENTRY encoding, and verified valid (`file`
  reports a well-formed multi-image ICO; re-decoded correctly with PIL).
- **Compiled output sanity:** `node --check` against every compiled
  `dist-electron/**/*.js` file confirms valid JavaScript syntax (full
  execution isn't possible without a real Electron binary — see below).

## What was NOT verified (real, structural environment limitation)

This container cannot download the Electron binary — confirmed
reproducibly (`npm install electron@latest` in an isolated scratch
directory completes in ~4s having fetched only ~1.2MB, and
`electron --version` then fails with "Electron failed to install
correctly"). This is a network/environment restriction, not a code
defect, and it blocks everything below. Per the user's explicit
direction ("Write all code now, build later"), all such work was
completed as real, complete, reviewed source code, but none of the
following was executed:

- The application has **not** launched under a real Electron process,
  on Windows 11 or anywhere else.
- The NSIS **installer** (`npm run desktop:installer`) has **not** been
  run to completion — it requires the Electron binary plus, for a real
  Windows target, either a Windows build machine or Wine (unverified
  either way in this project).
- The **portable** build (`npm run desktop:portable`) has **not** been
  run to completion, for the same reason.
- No installer or portable smoke test was performed (first-run dialog,
  Start Menu entry, uninstall behavior, SmartScreen prompt, etc.).
- No Thai-path test was performed on a real Windows/NTFS filesystem
  (the `.vsps` Thai-text round-trip was verified at the data layer via
  vitest, not at the OS filesystem layer).
- The `better-sqlite3` → Electron-ABI rebuild
  (`electron-builder`'s `npmRebuild`, or manual
  `electron-rebuild -f -w better-sqlite3`) has **not** been exercised —
  it needs Electron's native headers, which need the same blocked
  download.
- No non-admin-account test, no real Start Menu/desktop-shortcut check,
  no antivirus-interaction check.

## Known limitations / unresolved issues carried into this report

- `app/src/desktop/useDesktopIntegration.ts`'s dirty-state reporting is
  wired to a hook, but `App.tsx` has no existing "has unsaved changes"
  concept to source it from (confirmed via grep — zero prior art in the
  codebase). The main-process close handler still prompts on quit using
  its own state; the hook is present and documented
  (`docs/BACKUP_AND_RECOVERY.md`'s "known limitation" section) but not
  yet fully wired to a granular per-edit dirty flag.
- The `release/VectorStockPatternStudio_Desktop/` folder described in
  `docs/RELEASE_PROCESS_DESKTOP.md` does not exist in this repo — it is
  produced by a real build, which could not run here.

## Exact build commands (for the next environment with real internet + ideally Windows)

```bash
cd app
npm install
npm test                                        # must stay green
npx tsc -p tsconfig.electron.json --noEmit       # must stay clean
npm run desktop:build:renderer
npx tsx scripts/verifyOfflineBuild.ts            # must stay PASS
npm run desktop:build
npm run desktop:installer                        # -> release/VectorStockPatternStudio_Desktop/build-tmp/VectorStockPatternStudio-Setup-x64.exe
npm run desktop:portable                         # -> release/VectorStockPatternStudio_Desktop/build-tmp/VectorStockPatternStudio-Portable-x64.exe
```

Or via the Windows helper scripts at the repo root: `run_desktop_dev.bat`,
`run_all_tests.bat`, `build_desktop_installer.bat`,
`build_desktop_portable.bat`. Full release-folder assembly and checksum
commands are in `docs/RELEASE_PROCESS_DESKTOP.md`.

## Rollback instructions

This entire migration is additive and isolated to `app/electron/**`,
`app/src/desktop/**`, new config files (`tsconfig.electron.json`,
`vite.config.desktop.ts`, `electron-builder.yml`), new `docs/*` files,
and root `*.bat` files, plus one additive change inside
`app/src/export/svgExporter.ts` (the `isDesktop()` branch in
`downloadBlobFile()`). None of the existing web app, vanilla-JS site, or
`/studio` published build were modified. To roll back: revert the commits
on `codex/offline-windows-desktop` (or simply do not merge this branch)
— the `main` branch and the deployed GitHub Pages site are entirely
unaffected either way.

## Final production readiness decision

Per the brief's own stated rule: *"Do not claim YES unless: the
application launches on Windows 11 ... installer works ... portable
build works ... all critical tests pass ... no P0 or P1 defects
remain."* None of the Windows-runtime criteria could be exercised in
this environment (see "What was NOT verified" above), so this must be
reported honestly as:

**DESKTOP OFFLINE PRODUCTION-READY: NO**

Everything achievable without a real Electron binary or a Windows
machine — the full architecture, IPC layer, `.vsps` format with tested
Thai round-trips, SQLite layer, security hardening, icon generation, a
real offline-dependency static-scan pass against a real build, and zero
regressions in the existing 3063-test suite — is complete and real. What
remains before a genuine YES is a single build-and-verify pass on a
machine with normal internet access and ideally a Windows 11 host,
following the exact commands above, then filling in this report's
"SHA-256 checksums," "installer/portable smoke-test," and "Thai-path
test" sections with real results.
