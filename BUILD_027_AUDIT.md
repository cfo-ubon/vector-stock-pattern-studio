# Build 027 — Offline PC & iPad Application: Phase 1 Audit

**Status: Phases 2-4 implemented and verified below. Phases 5-11 remain (see
`docs/build_reports` when written). Branch: `claude/build-027-offline-pc-ipad`.**
**Branch not yet created** (this audit was done on `main` at commit `4344c99`, read-only).

---

## Phase 4 results — Windows desktop app (Electron)

Per the user's explicit instruction, Phase 4 forward-ported the proven
Electron/IPC/security/installer components from `codex/offline-windows-desktop`
onto this branch, rebased onto the current `.vspsb`/IndexedDB architecture
(Builds 022-026 + Application Backup System) instead of that branch's obsolete
`.vsps`/SQLite (`better-sqlite3`) format, which was dropped entirely — the app's
real persistence layer needed no main-process reimplementation at all, since
Electron's `BrowserWindow` renderer is a full Chromium instance where IndexedDB
already works exactly as it does in the browser. Only native file dialogs
(Open/Save `.vspsb`/exports) and basic app-info genuinely needed a main-process
bridge.

### What was reused vs. rewritten from `codex/offline-windows-desktop`

| Component | Reused | Rewritten |
|---|---|---|
| `electron/security/paths.ts` (path-traversal guards, filename sanitization) | Yes, near-verbatim | Extension allowlist updated (dropped `.vsps`, added `.vspsb`) |
| `electron/main.ts` (window creation, security `webPreferences`, menu, navigation lockdown) | Security posture/pattern reused | Autosave timers, backup timers, and "unsaved changes" close-confirmation dropped entirely — no such concept applies when persistence is continuous IndexedDB |
| `electron/preload.ts` (contextBridge allowlist pattern) | Pattern reused | Channel surface rewritten: generic file open/save/folder-select + app info, not project/settings/backup passthroughs |
| `electron/ipcContract.ts`, `ipc/*.ts` | — | New: 7-channel allowlist, ArrayBuffer-based binary transfer (not `number[]`) for efficient large `.vspsb` transfer |
| `src/desktop/desktopBridge.ts`, `useDesktopIntegration.ts` | `isDesktop()`/bridge pattern reused | Much smaller interface; no dirty-state reporting |
| `electron-builder.yml` | Reused/adapted | `asarUnpack: better-sqlite3` removed — no native module dependency remains |
| `app/build/icons/*` | Copied verbatim | — |

### Electron security requirements (user requirement #7) — verified in code

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` — set in `electron/main.ts`'s `webPreferences`.
- No remote module; `contextBridge.exposeInMainWorld('vsp', ...)` is the only renderer-facing surface.
- IPC channels are an explicit allowlist (`IPC_CHANNELS` in `ipcContract.ts`); `preload.ts` rejects any channel not in the list before calling `ipcRenderer.invoke`.
- `will-navigate` and `setWindowOpenHandler` lock down navigation/new windows.
- All file-dialog paths come from the dialog itself, never a renderer-supplied string; `file:openFolder` additionally verifies the path is a real directory (`fs.stat().isDirectory()`) before calling `shell.openPath`, closing an arbitrary-execution risk that a bare `shell.openPath(rendererString)` would allow.

### Honest verification results (per the user's mandated result policy)

| Check | Result |
|---|---|
| Source implementation (`tsc -p tsconfig.electron.json --noEmit`) | **PASS** — zero errors |
| Full app regression suite (`npm test`) | **PASS** — 326/326 files, 3520/3520 tests |
| `tsc -b` (whole `/app`) | **PASS** — zero errors |
| `oxlint` (whole `/app` incl. `electron/`) | **PASS** — one pre-existing, unrelated warning in `submissionPackageBuilder.ts` (Build 026 code, not touched here) |
| Linux Electron smoke test (`npm run desktop:smoke`, via Playwright's Electron driver + `xvfb-run`) | **PASS** — real app shell rendered (`.app-shell`, `.offline-status-bar` present), `window.vsp` bridge exposed with working methods, a real IPC round-trip (`getVersion()`) returned `1.0.0-desktop.1`, **zero console errors** |
| Windows NSIS installer build (`electron-builder --win nsis --x64`, this Linux sandbox) | **PASS** — required installing `wine`/`wine32:i386` in-sandbox first (not present by default); produced `VectorStockPatternStudio-Setup-x64.exe` (~100.4 MB) |
| Windows portable build (`electron-builder --win portable --x64`) | **PASS** — produced `VectorStockPatternStudio-Portable-x64.exe` (~89.3 MB) |
| SHA-256 checksums | **PASS** — computed from the real built files, in `SHA256SUMS.txt` |
| **Actual install + launch + use on a real Windows 11 machine** | **PENDING USER-PC VERIFICATION** — categorically impossible to perform from this Linux sandbox (no Windows runtime, no WebView2). See `docs/WINDOWS_INSTALLATION.md` and `app/scripts/verifyWindowsInstall.ps1`. |

Per user requirement #10 ("Do not report PASS based on Linux cross-build alone")
and #12 ("Final status must be PARTIAL until the actual Windows installer is
installed and smoke-tested on a real Windows 11 machine"), **Phase 4's overall
status is PARTIAL**, not PASS, until that last row is completed by the user.

The build artifacts themselves (both `.exe` files, ~90-100 MB each) are not
committed to git — they are reproducible any time via `npm run desktop:installer`
/ `npm run desktop:portable` inside `/app`, and were delivered to the user
directly for real-machine testing.

## 1. Repository state relevant to this build

- **App**: `/app` — React 19 + TypeScript + Vite 8 SPA. Single entry (`src/main.tsx` →
  `src/App.tsx`), **no router** — view switching is manual `useState<'editor'|'workbench'|'backup'|...>`.
  This is good news for an app-shell PWA: there's exactly one HTML shell to cache, no
  route-based code-splitting to reason about for offline navigation.
- **Persistence**: IndexedDB only (`src/storage/db.ts`, `DB_VERSION` currently 7),
  plus a handful of `localStorage` keys (settings/presets) via a shared
  `readJson`/`writeJson` convention. No server, no fetch calls to a backend anywhere
  in `/app/src` (confirmed by the earlier Firebase-hosting audit finding zero network
  dependency in the app itself).
- **`vite.config.ts`**: `base: '/vector-stock-pattern-studio/studio/'`, `outDir: '../studio'`
  — hardcoded for the GitHub Pages project-page path. This will need a **second,
  parallel Vite config** for offline builds (PWA and desktop), since neither should
  emit absolute `/vector-stock-pattern-studio/studio/...` asset URLs — those 404 under
  `file://` (desktop) and break Safari's PWA scope resolution.
- **No CSP** anywhere (`app/index.html`, `studio/index.html`) — nothing to loosen or
  fight with when adding a service worker.
- **No PWA plugin, no service worker, no manifest** currently exist on `main`. This is
  a from-scratch PWA build, same as the earlier from-scratch finding for Firebase.
- **Backup System** (`app/src/backup/*`, shipped this session): already produces a
  single portable `.vspsb` ZIP (IndexedDB dump + binary assets + settings, SHA-256
  checksums, DEFLATE compression, mandatory Safety Backup before restore, upsert-only).
  This is exactly the artifact Phase 3's PC↔iPad transfer workflow needs — no new
  format required, this build should *use* it, not replace it.
- **Versioning**: `docs/USER_GUIDE.md` header tracks two independent counters —
  *Application Version* (currently v1.81) and *Development Build* (Build 026, with
  the Backup System noted as a same-branch follow-on rather than a new numbered
  Build). Per your instruction not to invent new conventions, this build will bump
  Application Version once (e.g. v1.82) and register as **Build 027**, matching the
  existing scheme exactly.

## 2. Prior art: a Windows desktop build already exists, and it's stale

There is a **previous, substantial Electron-based desktop implementation** on branch
`codex/offline-windows-desktop` (last commit `6d43582`). It is **not on `main`** and
**31 commits behind** it — its merge-base with `main` predates Builds 022–026 and the
entire Backup System, and it implements its own separate `.vsps` project format with
a SQLite persistence layer (`app/electron/vsps/vspsReader.ts` / `vspsWriter.ts`,
`app/electron/db/appDb.ts`), distinct from `.vspsb`.

What it already built (verified by inspecting the branch, not just its commit messages):
- `app/electron/main.ts`, `preload.ts`, IPC handlers for app/backup/export/project/
  recovery/settings/diagnostics, path-safety module (`electron/security/paths.ts`)
- `app/electron-builder.yml` + generated icon set (`app/build/icons/*`, including
  `icon.ico`)
- `app/vite.config.desktop.ts`, `tsconfig.electron.json`
- `app/src/desktop/desktopBridge.ts` + `useDesktopIntegration.ts` — a
  desktop-vs-web capability-detection layer, which is the right shape for what
  Phase 4/5 of this build need (native file dialogs with a web fallback)
- Batch files (`build_desktop_installer.bat`, `build_desktop_portable.bat`,
  `run_desktop_dev.bat`) meant to be run **on an actual Windows machine**
- A `DESKTOP_OFFLINE_BUILD_REPORT.md` documenting its own install-upgrade-persistence
  testing — which, notably, was also written from this same kind of sandboxed
  environment, so its "Windows verification" claims deserve the same scrutiny this
  audit is applying to Build 027.

This is a major fork-in-the-road decision, detailed in the questions below.

## 3. Hard environmental constraint: no Windows runtime is reachable from this session

Checked directly, not assumed:

```
rustc 1.94.1 / cargo 1.94.1     — present (native Linux target only)
x86_64-w64-mingw32-gcc          — NOT installed (no Windows cross-compiler)
wine                            — NOT installed
makensis (NSIS)                 — NOT installed
tauri CLI                       — not present as a project dependency anywhere
OS                               Ubuntu 24.04, Linux, x86_64, no Windows/WSL
```

Consequences:
- **Tauri** ships a Rust binary; cross-compiling it to `x86_64-pc-windows-msvc`/`-gnu`
  from Linux is unofficial, fragile (needs `cargo-xwin` or mingw-w64 plus manual
  resource-compiler shims), and even a successful cross-compile still can't be
  *launched* here — Tauri's Windows webview is Microsoft's WebView2, a Windows-only
  component with no Linux equivalent, so there is no way to smoke-test the resulting
  `.exe` in this sandbox at all.
- **Electron** ships its own bundled Chromium and *does* run on Linux (including
  headless, via `xvfb-run`), so the *application logic* — IPC handlers, IndexedDB/
  SQLite persistence, backup/restore, native-dialog fallback paths — can genuinely be
  exercised and verified here. `electron-builder` cross-building a Windows NSIS
  target from a Linux CI runner is a well-established, widely-used pattern (unlike
  Tauri's), so a real, correctly-formed `.exe`/portable `.zip` can likely be produced.
  What still **cannot** be done here, on either stack: physically install the `.exe`
  on a Windows machine, launch the installed shortcut, and confirm the OS-level
  install/uninstall/upgrade experience. That step requires an actual Windows
  environment — mine or yours.

This directly affects Phase 9's bar ("installer installs successfully, installed
executable launches, uninstaller works") and the final report's PASS conditions
("Do not report PASS if... the installed Windows app was not smoke-tested"). I want
to be upfront about this now rather than build for hours toward a bar I already know
I can't clear alone, and rather than silently lower the bar and call it PASS anyway
(the second Firebase-deployment check-in already showed why that's the wrong move).

## 4. iPad PWA: fully buildable and verifiable here

Unlike the Windows path, **everything Phase 2 needs is achievable and independently
testable inside this sandbox**: Vite PWA plugin + service worker + manifest all run
and build under Node; Playwright (already used for browser verification elsewhere
this session, Chromium pre-installed) can emulate an iPad viewport, register the
service worker, go offline, and reload — a real, non-simulated test of "does this
survive Airplane Mode," even though it isn't literally an iPad. I have no reservations
about this phase's testability.

## 5. Feature compatibility scan (offline / iPad Safari / desktop WebView)

| Feature | Offline-ready today? | Notes |
|---|---|---|
| Pattern generation, preview, save/open project | Yes | Pure IndexedDB + in-memory, zero network calls |
| Portfolio Manager, search, metadata | Yes | IndexedDB-backed |
| SVG/EPS/PNG/JPEG export, ZIP bundling | Yes | All client-side (`export/*`, `catalog/backup/backupCodec.ts`'s CompressionStream pattern) |
| `.vspsb` create/verify/restore | Yes | Confirmed same-session; this *is* the PC↔iPad transfer format |
| Submission Center / marketplace packages | Yes, for **preparation** | No code path anywhere uploads over the network today — there is no existing "online upload" to gracefully disable, which simplifies Phase 6: it's already offline-only, just needs labeling for future-proofing |
| Any AI-dependent feature | N/A | Audited: no LLM/cloud-AI calls exist in `/app` at all today, so there is nothing to mislabel as offline-capable |
| Large binary asset volume in IndexedDB | Needs storage-quota handling (Phase 3) | Not currently implemented — `navigator.storage.estimate()`/`persist()` are unused today |
| iPad Safari download/upload restrictions | Needs Files-app-based `<input type="file">` + anchor-download flow, not filesystem access API (unsupported in Safari) | Existing export code already uses anchor-`download` attributes (confirmed pattern in `export/` and backup UI), which *is* the Safari-compatible approach — good starting point |

## 6. Proposed architecture

**Shared core** (no change in principle): current `/app` React/TS/Vite/IndexedDB code,
unchanged for the web/PWA target.

**iPad target**: `vite-plugin-pwa` + a **new, separate Vite config**
(`vite.config.pwa.ts`) building to a new output directory (not `/studio`, to avoid
colliding with the GitHub Pages build) with `base: '/'` or a dedicated offline-app
path, workbox-based service worker (precache app shell, runtime-cache fonts/icons,
**never** cache IndexedDB data), web app manifest + full icon set, an in-app
Offline Status component, and an in-app install guide. Verified via Playwright
iPad-viewport + offline-mode tests, not claimed from source alone.

**Windows target**: recommend forward-porting the existing Electron work from
`codex/offline-windows-desktop` (bringing it up to date with Builds 022–026 and the
Backup System) rather than a ground-up Tauri rewrite — see decision below.

## Decisions needed before implementation

I have three genuine forks here that materially change scope, and I'd rather confirm
now than redo hours of work later.
