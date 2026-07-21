# Desktop Release Process

## Prerequisites

- A machine with normal internet access, for the one-time downloads
  `npm install` / `electron-builder` need (the Electron binary itself,
  and on first run, NSIS/winCodeSign tooling). This build could not be
  produced end-to-end inside this repo's own development container — see
  `DESKTOP_MIGRATION_AUDIT.md`'s environment disclosure.
- Windows 11 64-bit recommended for building the Windows targets and for
  all Windows-specific verification (electron-builder can cross-build
  Windows NSIS installers from other platforms via Wine, but this has not
  been exercised or verified for this project).
- Node.js (same major version as this repo's own `engines`/CI
  expectations — check `app/package.json`'s devDependencies for the
  `@types/node` version in use as a floor).

## Build steps

All commands run from `/app`:

```bash
npm install

# 1. Full existing regression suite must pass first — no desktop work
#    ships on top of a red build.
npm test

# 2. Type-check the Electron main/preload/IPC code.
npx tsc -p tsconfig.electron.json --noEmit

# 3. Static offline-dependency check against a real build.
npm run desktop:build:renderer
npx tsx scripts/verifyOfflineBuild.ts

# 4. Full desktop build (renderer + main process).
npm run desktop:build

# 5. Dev-mode smoke check (requires a real Electron binary + display —
#    not runnable in a headless CI container without Xvfb or similar).
npm run desktop:dev

# 6. Installer.
npm run desktop:installer
# -> release/VectorStockPatternStudio_Desktop/build-tmp/
#    VectorStockPatternStudio-Setup-x64.exe (per electron-builder.yml's
#    artifactName)

# 7. Portable build.
npm run desktop:portable
# -> release/VectorStockPatternStudio_Desktop/build-tmp/
#    VectorStockPatternStudio-Portable-x64.exe
```

Windows helper batch files (repo root) wrap the equivalent commands for a
user without a terminal habit:

- `run_desktop_dev.bat`
- `build_desktop_installer.bat`
- `build_desktop_portable.bat`
- `run_all_tests.bat`

## Native module rebuild (`better-sqlite3`)

`better-sqlite3` is a native Node module. `npm install` in this
container installed and ran it correctly against **plain Node's** ABI
(verified — see `DESKTOP_MIGRATION_AUDIT.md` Section 11), but the
packaged Electron app needs it rebuilt against **Electron's** own Node
ABI. `electron-builder`'s default `npmRebuild: true` handles this
automatically as part of `desktop:installer`/`desktop:portable` — but
this container could not verify that rebuild step succeeds, since it
requires downloading Electron's native headers (blocked here). **Verify
this step completes without error on the actual build machine** before
trusting a produced installer; if it fails, run
`npx electron-rebuild -f -w better-sqlite3` manually and retry.

## Assembling the release folder

After a successful build, arrange output as:

```
release/VectorStockPatternStudio_Desktop/
├── installer/
│   └── VectorStockPatternStudio-Setup-x64.exe
├── portable/
│   └── VectorStockPatternStudio-Portable-x64.exe
├── checksums/
│   └── SHA256SUMS.txt
├── documentation/
│   └── (copies of the docs/ desktop guides)
├── test-reports/
│   └── (vitest output, tsc output, verifyOfflineBuild.ts output)
└── DESKTOP_RELEASE_NOTES.md
```

`electron-builder.yml`'s `directories.output` points at
`release/VectorStockPatternStudio_Desktop/build-tmp/` — move the two
`.exe` files out of there into `installer/`/`portable/` respectively as
the last packaging step (keeps electron-builder's own intermediate
artifacts, like the NSIS `.exe`'s unpacked staging directory, out of the
final release folder).

## Checksums

From the Windows build machine (PowerShell):

```powershell
Get-FileHash release\VectorStockPatternStudio_Desktop\installer\VectorStockPatternStudio-Setup-x64.exe -Algorithm SHA256
Get-FileHash release\VectorStockPatternStudio_Desktop\portable\VectorStockPatternStudio-Portable-x64.exe -Algorithm SHA256
```

Or from any machine with the built files and a POSIX shell:

```bash
sha256sum installer/VectorStockPatternStudio-Setup-x64.exe portable/VectorStockPatternStudio-Portable-x64.exe > checksums/SHA256SUMS.txt
```

## Versioning

`app/package.json`'s `version` field is the single source of truth
(currently `1.0.0-desktop.1`, derived from the repo's real shipped tag
`v1.0.0-production` plus a `-desktop.N` suffix per the brief — not an
invented major version). Bump the `-desktop.N` suffix for each desktop-
only release that doesn't change the underlying web app version; bump the
base version to match whenever the web app itself ships a new tagged
release.

## Upgrade behavior

NSIS installer config (`electron-builder.yml`): `perMachine: false`
(per-user install), `deleteAppDataOnUninstall: false`. A user installing
a newer version over an older one keeps their `userData` (SQLite
settings/recent-projects/logs) and any `.vsps` project files (which live
wherever the user saved them, never inside the install directory) intact
automatically — NSIS's default upgrade behavior replaces only the
installed application files.
