# Desktop Migration Audit — Vector Stock Pattern Studio → Offline Windows App

**Branch:** `codex/offline-windows-desktop`
**Base:** `origin/main` @ `5a947f3` (tag `v1.0.0-production`)
**Audit method:** direct repository inspection (package.json, vite config, `index.html`,
static grep across `app/src` for remote calls / storage / browser-only APIs), no
assumptions.

## Environment disclosure (read this first)

This audit and the implementation that follows it are being done in a Linux
container with no Windows machine attached. Everything that can be verified
without a Windows GUI — code correctness, Electron main-process logic, IPC
contracts, project-file round-trips, build commands succeeding, static
"does this reference anything remote" checks — will be built and verified for
real. Anything that requires an actual Windows 11 desktop (Start Menu
integration, the NSIS installer's UI, non-admin account behavior, Thai-path
handling in the real Windows filesystem, "does the taskbar icon look right")
**cannot be executed here** and will be delivered as code-complete plus an
exact, numbered verification checklist for a real Windows machine to run.
The final report will never claim a Windows-only test passed unless it was
actually run on Windows.

## 1. Current framework

- **Frontend**: React 19.2 + TypeScript (strict), built with **Vite 8**.
  Single-page app, no router (all navigation is in-component state).
- **App location**: `/app` (the repo also has an older, independent
  vanilla-JS static site at the repo root — `/index.html`, `/js`, `/css` —
  which is explicitly out of scope per this repo's own `CLAUDE.md`: "do not
  break"; the desktop app wraps `/app` only).
- **No UI framework/component library** (no MUI, no Tailwind) — plain CSS
  (`App.css`, `workbench.css`, `portfolio.css`). No router library.
- **Runtime dependencies** (`app/package.json`): only `react` + `react-dom`.
  Zero other runtime deps — no HTTP client, no state-management library, no
  UI kit. This is a very "flat" dependency surface for an Electron wrap.
- **Dev dependencies**: `vite`, `@vitejs/plugin-react`, `vitest` +
  `jsdom` + Testing Library (tests), `typescript`, `oxlint`, `tsx` (for
  Node-side scripts), `fake-indexeddb` (test-only IndexedDB polyfill).
- **Package version**: `app/package.json` says `"version": "0.0.0"`
  (Vite's scaffold default, never bumped) — this is **not** the real
  product version. The actual shipped version is the git tag
  `v1.0.0-production` (created this session after merging RC-1, PR #42).
  Recommendation: desktop `package.json` uses `1.0.0` as the base and the
  brief's suggested `-desktop.1` suffix → **`1.0.0-desktop.1`**.

## 2. Current build/test/lint commands

All run from `/app`:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` → outputs to `../studio` (repo-root, GitHub Pages subpath) |
| `npm run lint` | `oxlint` |
| `npm test` | `vitest run` — **279 test files**, full suite takes ~380s (confirmed this session during RC-1) |
| `npm run preview` | Vite's static preview server over the built output |
| `npm run validate:*` | ~18 permanent Node scripts (`tsx scripts/*.ts`) — large-portfolio/stress/soak/recovery validation harnesses, not part of the desktop scope directly but must keep working since they're this repo's own regression tooling |

`vite.config.ts` hardcodes `base: '/vector-stock-pattern-studio/studio/'`
and `outDir: '../studio'` — **this must NOT change** for the existing
GitHub Pages web deployment (the whole point of that config, per its own
comment, is that GitHub Pages serves the committed `/studio` build
directly). The desktop build needs a **second, separate Vite build
config/mode** with `base: './'` (relative paths, required for `file://`
loading in Electron) and a different `outDir` (e.g. `app/dist-desktop`) —
additive, not a modification of the existing config.

## 3. Browser-only APIs found

Surveyed `app/src` (excluding tests):

| API | Files | Electron/Chromium compatible? |
|---|---|---|
| `document.createElement` | 5 | Yes (canvas/anchor creation for rasterizing/downloading) |
| `URL.createObjectURL` | 6 | Yes |
| `navigator.storage` (persist) | 3 | Yes, but meaningless in Electron (quota isn't the same concern) — safe no-op |
| `indexedDB` (direct) | 8 (`storage/db.ts`, `storage/savedStore.ts`, `storage/projectStore.ts`, `storage/assetStore.ts`, `catalog/storage/portfolioStore.ts`, `catalog/storage/collectionStore.ts`, `catalog/validation/{recoveryEngine,validationDb}.ts`) | Yes — Electron's renderer is full Chromium, IndexedDB works identically and persists to disk in `userData` automatically |
| `localStorage` | ~19 files (settings, favorites, backup history, legacy IDB-fallback keys) | Yes, same story as IndexedDB |
| `<a download>` blob-URL trick | `export/svgExporter.ts` (`link.download`), `App.tsx`'s `downloadBlobFile` and every export callsite | Works in Electron's renderer too, but for a real desktop app this should be **additively** replaced by a native save dialog via IPC (task's own requirement) — the existing blob-building code (SVG/EPS/ZIP string/byte construction) is untouched; only the final "hand the bytes to the user" step changes |
| `fetch` / `XMLHttpRequest` / `axios` | **0 files** | N/A — confirms zero remote calls anywhere in the app |
| `showOpenFilePicker`/`showSaveFilePicker` (File System Access API) | 0 files | N/A — the app never used these, so there's no File System Access-specific code to migrate away from |
| Web Workers | **0 files** | Nothing to reuse — moving heavy work off the UI thread (task's Performance requirement) is genuinely new work, not a reuse |
| `matchMedia`, `ResizeObserver`, `IntersectionObserver` | 0 files | N/A |

## 4. Remote/CDN dependencies found

**None.** Specifically checked and confirmed absent:

- No `<link>`/`<script>` tags pointing at a CDN in `index.html` (the only
  external-looking thing in `index.html` is a `data:image/svg+xml,...`
  favicon — inline, not remote).
- No `@import`/`@font-face`/`fonts.googleapis.com` in any of the 3 CSS
  files. Every `font-family` declaration uses system fonts only (`'Segoe
  UI'`, `system-ui`, `-apple-system`, `sans-serif`, `'SF Mono'`,
  `Consolas`, `monospace`) — **no font files need to be bundled at all**,
  Windows already ships Segoe UI and Consolas.
- No `fetch`/`XMLHttpRequest`/`axios` calls anywhere in `app/src`.
- No analytics, no telemetry, no crash-reporting SDK, no AI/LLM API calls
  (the "AI assist" feature mentioned in old changelogs is a rule-based
  local heuristic, not a real API call — confirmed no API-key handling
  code exists anywhere in the repo).

**Conclusion**: the web app is already fully self-contained. Phase 6
("offline dependency removal") of the desktop migration has essentially
nothing to *remove* — the work there is verification (prove nothing was
missed) rather than remediation.

## 5. Current storage mechanisms (important finding)

The app already has a **mature, tested, IndexedDB-backed persistence
layer** — this changes the desktop migration's risk profile substantially
for the better, and directly satisfies the brief's own constraint #1/#2
("do not rebuild... reuse existing"):

- **`storage/db.ts`**: one shared IndexedDB database (`vsp-db`, currently
  schema `DB_VERSION = 5`) with stores for `saved` (pattern library),
  `projects`, `assets`, `portfolioAssets`/`portfolioFiles`, `collections`.
  Upgrade path is already idempotent and version-gated.
- **`project/projectTypes.ts` + `projectManager.ts` + `projectJson.ts`**:
  a full, already-shipped **Project domain model** — `PROJECT_SCHEMA_VERSION`,
  `exportProjectJson()`/`importProjectJson()` with structural validation and
  Thai-language error messages. This is functionally the same concept the
  brief asks for under the name `.vsps` — see Section 9 below.
- **`catalog/backup/*`**: a full, already-shipped, already-documented
  Backup & Restore subsystem (`backupFormat.ts`, `backupBuilder.ts`,
  `backupCodec.ts`, `backupValidation.ts`, `restoreService.ts`,
  `backupExportImport.ts`, `backupHistoryStore.ts`) — versioned
  (`BACKUP_SCHEMA_VERSION`), gzip+base64 payload, checksum-validated,
  restore preview / overwrite / merge / cancel modes, with 5 existing docs
  under `docs/portfolio/`. This is the brief's Section 9 ("Backup and
  recovery") **already built**, not something to invent.
- **`export/zip.ts`**: a hand-rolled, dependency-free STORE-method ZIP
  writer (CRC32 + local/central directory records), already used by the
  Collection Generator and Production Mode ZIP downloads.
- Every store falls back to `localStorage` when IndexedDB is unavailable
  (`idbAvailable()` checks) — a pre-existing resilience pattern the
  desktop build inherits for free.

**Desktop implication**: Electron's renderer is full Chromium — IndexedDB
and localStorage work identically and persist to disk under the app's
`userData` profile directory automatically, with **zero code changes**.
The correct architecture (Section 9 below) is to **keep this entire layer
as-is** and add a **thin, separate SQLite (or single JSON config file)
layer only for OS-level concerns that don't belong in a browser-origin
database**: the recent-projects list surfaced in the native File menu
before the renderer has necessarily loaded, last-used export/project
folder, window bounds, and structured app logs. This is additive, not a
replacement of the existing persistence.

## 6. Export pipeline dependencies

All confirmed pure/dependency-free, already reused across many builds this
session (Build 018-021, Portfolio Phase 1):

- `export/svgExporter.ts` — `buildSingleTileSvg`, `buildExportFilename`,
  `buildFilenameParts` (filename derivation from pattern content).
- `export/epsExporter.ts` — `buildEps` (direct EPS text generation, no
  external tool dependency).
- `export/zip.ts` — `buildZip` (pure JS, works identically in Node and
  browser — confirmed this session by reimplementing an equivalent writer
  for the Phase 1B review script and running it under plain Node).
- PNG rasterization (`App.tsx`'s `rasterizeSvgToPngBlob`) uses `Image` +
  `<canvas>` — a DOM API, meaning **this one path needs Electron's
  renderer (has DOM/canvas)**, not the main process; confirmed working
  this session via Playwright + headless Chromium for the same technique,
  so Electron's own Chromium renderer will behave identically.
- `metadata/shutterstock.ts` (SEO fields), `catalog/seo/*` (Build 016 SEO
  engine), `engine/scoring.ts` + `critic/*` (commercial scoring),
  `catalog/import/duplicates.ts` (duplicate detection) — all pure
  TypeScript/data, zero DOM or network dependency, already confirmed to
  run headlessly under plain Node (every `app/scripts/build0NN*.ts` this
  session did exactly that).

**Conclusion**: only PNG rasterization strictly requires a Chromium
context; everything else in the export/scoring/SEO/validation pipeline is
already environment-agnostic pure logic.

## 7. Proposed Electron architecture

```
app/
  electron/
    main.ts              # BrowserWindow, app lifecycle, single-instance lock,
                          # menu construction, IPC handler registration
    preload.ts            # contextBridge.exposeInMainWorld — the ONLY surface
                          # the renderer can call into main/Node from
    ipc/
      projectHandlers.ts   # open/save/save-as/.vsps read-write
      exportHandlers.ts    # native save dialogs for SVG/EPS/PNG/JSON/ZIP
      settingsHandlers.ts  # get/set settings (backed by better-sqlite3 or a JSON file)
      backupHandlers.ts    # manual/auto backup, restore, list backups
      diagnosticsHandlers.ts # open logs folder, export diagnostic package
    db/
      appDb.ts             # SQLite (better-sqlite3) — settings, recent projects,
                            # export history, logs. NOT the app's IndexedDB data.
    security/
      ipcAllowlist.ts       # explicit channel allowlist, path validation, filename sanitization
  src/                      # UNCHANGED — the existing React app, reused as-is
  vite.config.desktop.ts    # new, additive build config (base:'./', separate outDir)
```

- **contextIsolation: true, nodeIntegration: false, sandbox: true** where
  compatible (per the brief's own security requirements).
- The renderer talks to the OS exclusively through `window.vsp.*` methods
  the preload script exposes via `contextBridge` — a small, explicit,
  typed surface (open project, save project, export file, get/set setting,
  list recent projects, etc.), never a raw `fs`/`child_process` handle.
- The existing React app (`app/src`) is loaded into the `BrowserWindow`
  from the desktop-mode Vite build's static output via `file://` — no
  changes to its own logic; only a thin adapter layer (new files, e.g.
  `src/desktop/desktopBridge.ts`) detects `window.vsp` and, when present,
  routes "download this file" actions through it instead of the existing
  `<a download>` blob trick. When `window.vsp` is absent (i.e. running as
  the normal web app), behavior is 100% unchanged — this is how "do not
  reduce existing functionality" and "existing browser-based behavior
  must remain as close as possible" are satisfied simultaneously.

## 8. Proposed project file format (`.vsps`)

A `.vsps` file is a ZIP (built with the app's own existing `export/zip.ts`
writer) containing:

```
project.json          # exact output of the existing exportProjectJson() —
                       # unmodified, already schema-versioned (PROJECT_SCHEMA_VERSION)
manifest.json          # NEW, thin wrapper: schema_version, app_version, created_at,
                        # updated_at, project_id, project_name, checksum of project.json
previews/*.png          # already-generated PNG previews for the project's patterns
assets/*.svg, *.eps     # already-generated export files, if the project has any saved
```

`manifest.json` is new (small, ~10 fields); `project.json`'s content is
**entirely reused, unmodified** from the existing `projectJson.ts`. This
satisfies the brief's required top-level fields (`schema_version`,
`app_version`, `created_at`, `updated_at`, `project_id`, `project_name`)
without duplicating or reinventing the Project domain model. Opening a
`.vsps` = unzip + `importProjectJson()` (existing, already
Thai-error-messaged) on `project.json`'s content, restore the IndexedDB
`projects` store entry — new glue code, zero new validation logic.

## 9. Proposed SQLite schema

Only for OS-level, non-Project-domain data (everything Project/pattern/
portfolio-shaped stays in the existing IndexedDB, per Section 5):

```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE recent_projects (
  path TEXT PRIMARY KEY, project_name TEXT, last_opened_at INTEGER
);
CREATE TABLE export_history (
  id TEXT PRIMARY KEY, exported_at INTEGER, export_type TEXT,
  target_path TEXT, pattern_id TEXT, collection_name TEXT
);
CREATE TABLE backup_log (
  id TEXT PRIMARY KEY, created_at INTEGER, backup_path TEXT,
  trigger TEXT, size_bytes INTEGER
);
CREATE TABLE app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, level TEXT,
  category TEXT, message TEXT
);
PRAGMA user_version = 1;
```

Stored at Electron's `app.getPath('userData')` (Windows:
`%APPDATA%\Vector Stock Pattern Studio\`), never inside the install
directory — satisfies the brief's own requirement directly.

## 10. Security risks identified

- The existing `<a download>` export mechanism, if left wired to a raw
  filename derived from pattern content, must be **filename-sanitized**
  before being handed to a native save dialog (strip path separators,
  reserved Windows characters `< > : " / \ | ? *`, reserved device names
  `CON`/`PRN`/`AUX`/`COM1`.../`LPT1`...) — this repo's own
  `buildExportFilename` already produces safe slugs in practice, but the
  IPC boundary must not trust it blindly (defense in depth).
- `.vsps` is a ZIP — must validate entry names before extraction (reject
  `../` path traversal, absolute paths, symlinks) before writing any
  extracted file to disk.
- Imported JSON (`importProjectJson`, and any future imported asset JSON)
  must go through the existing structural validation (already does) before
  being trusted — the IPC layer must not let the renderer request
  arbitrary file reads/writes outside the allowlisted project/export/
  settings/backup directories.
- `webPreference`s must set `nodeIntegration: false`, `contextIsolation:
  true`; `will-navigate` and `setWindowOpenHandler` must be locked down to
  prevent the renderer from navigating to or opening an arbitrary URL
  (there is no legitimate reason for this app to navigate anywhere once
  loaded).

## 11. Migration risks

| Risk | Mitigation |
|---|---|
| PNG rasterization needs a real Chromium `<canvas>` — must run in the renderer, not main process | Already true today (runs in the browser tab); Electron's `BrowserWindow` renderer is the same Chromium, no change needed |
| Worker-thread offloading (brief's Performance section) is genuinely new — nothing to reuse | Scope this as new, bounded work; do not claim it was "already there" |
| Windows-only verification (installer UX, Start Menu, non-admin account, Thai paths on real NTFS) cannot be executed in this Linux container | Deliver code-complete + an exact checklist; never fabricate a pass |
| `better-sqlite3` (or equivalent) is a native Node module — must be rebuilt/prebuilt for Electron's ABI, and for cross-compiling from Linux this needs `electron-rebuild`/prebuilt binaries, which needs network access to npm; if unavailable in this session's egress policy, this specific piece may need to be finished on a Windows/CI runner | Document exact fallback: a pure-JS/JSON settings store (no native module) as an unconditional working fallback if SQLite's native binary can't be produced here |
| `app/package.json`'s `"version": "0.0.0"` doesn't reflect the real shipped version | Desktop `package.json` uses `1.0.0-desktop.1`, documented and not silently invented |
| electron-builder needs to download Electron + winCodeSign/NSIS tooling from the internet on first run | May be blocked or slow under this session's egress policy; if so, the installer step becomes code-complete-but-unbuilt here, with exact commands documented for a machine with normal internet access |

## 12. Files expected to change

**New files only** (additive — the existing web app's own source tree is
not modified beyond the small `window.vsp` adapter layer):

- `app/electron/**` (main, preload, IPC handlers, SQLite wrapper, security)
- `app/src/desktop/desktopBridge.ts` (thin adapter: existing export
  callsites check for `window.vsp` and route through it; web behavior
  unchanged when absent)
- `app/vite.config.desktop.ts`
- `app/electron-builder.yml` (or `.json`) — installer/portable config
- `build/icons/*.ico`, `*.png` (icon set)
- `run_desktop_dev.bat`, `build_desktop_installer.bat`,
  `build_desktop_portable.bat`, `run_all_tests.bat`
- `docs/DESKTOP_INSTALLATION_GUIDE_TH.md`, `docs/DESKTOP_USER_GUIDE_TH.md`,
  `docs/DESKTOP_TROUBLESHOOTING_TH.md`, `docs/OFFLINE_ARCHITECTURE.md`,
  `docs/PROJECT_FILE_FORMAT.md`, `docs/BACKUP_AND_RECOVERY.md`,
  `docs/RELEASE_PROCESS_DESKTOP.md`
- `README.md` — additive section on the desktop build
- `.gitignore` — add Electron/SQLite/installer build output exclusions

**Existing files touched (small, additive edits only)**:

- `app/package.json` — add `electron`, `electron-builder`,
  `better-sqlite3` (or fallback) devDependencies and `desktop:*` npm
  scripts; version bump to `1.0.0-desktop.1`.
- A handful of export callsites in `App.tsx` / `ControlPanel.tsx` — wrap
  the existing blob-building call with an `if (window.vsp)` branch.

## 13. Estimated compatibility impact

- **Generation engine, scoring, SEO, validation, duplicate detection,
  Style DNA, composition engines, portfolio workflow**: **zero impact** —
  none of this code touches the DOM, network, or file system directly; it
  already runs identically under plain Node (proven repeatedly this
  session via `app/scripts/*.ts`).
- **Persistence (IndexedDB/localStorage)**: **zero impact** — Electron's
  Chromium renderer implements both identically to a browser tab.
- **Export/download mechanism**: **small, additive impact** — existing
  blob-construction logic unchanged; only the final hand-off step gets an
  Electron-native alternative path.
- **PNG rasterization**: **zero impact** — must stay in a Chromium
  context, which the Electron renderer already is.
- **New surface area**: Electron main process, IPC, SQLite, installer/
  portable packaging, worker-thread offloading, Windows-native
  integration (Start Menu, native dialogs) — this is real, substantial new
  code, not a reuse of anything existing, and is where essentially all
  desktop-migration risk and effort actually lives.

## 14. Implementation phases (tracked)

Matches the brief's own phase numbering; tracked as tasks #511-#518 in
this session's task list:

1. ~~Repository audit (this document)~~ — done
2. Electron shell (main + preload + security)
3. Native file system (dialogs, recent projects, path sanitization)
4. `.vsps` format + SQLite persistence
5. Backup, autosave, crash recovery
6. Offline dependency removal + verification
7. Installer + portable build + icons
8. Testing (regression + desktop + Thai paths — with an explicit
   Linux-verified vs. Windows-unverified split)
9. Documentation + final `DESKTOP_OFFLINE_BUILD_REPORT.md`

Proceeding to Phase 2 now, per the brief's instruction to continue without
waiting for further approval.
