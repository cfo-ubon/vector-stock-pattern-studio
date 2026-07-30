# Release Checklist — Offline PC & iPad Build (Build 027)

Use this before merging `claude/build-027-offline-pc-ipad` or shipping any
future offline-related change. Each item states how it was actually
verified in this build, not just what should be true in theory.

## Source and build

- [ ] `npx tsc -b` — zero errors
- [ ] `npx oxlint src` — zero new warnings (one pre-existing, unrelated
      warning in `submissionPackageBuilder.ts` is acceptable)
- [ ] `npm run build` — succeeds, and reports the PWA plugin's precache
      summary (`PWA vX.X.X ... precache N entries`)
- [ ] `/studio` rebuilt and committed alongside source changes (per
      `CLAUDE.md`'s standing rule — GitHub Pages has no build step)

## Tests

- [ ] `npx vitest run` — full suite passes (this build: 328 files, 3527+
      tests, confirmed passing including all new PWA/quota/cleanup tests)
- [ ] No new skipped tests introduced

## PWA artifact verification (not just "the code looks right")

- [ ] `studio/manifest.webmanifest` exists, `icons` array resolves, `scope`
      and `start_url` are relative (`.`/`./`) so they work under the GitHub
      Pages subpath
- [ ] `studio/sw.js` + `studio/workbox-*.js` generated
- [ ] `studio/icons/*.png` present (192/512 any + maskable, apple-touch-icon)
- [ ] `studio/offline.html` present
- [ ] **Real offline reload test**: launch a real (Chromium) browser
      context, load the built site, wait for the service worker to control
      the page, set the browser context offline, reload, confirm the app
      still renders with zero console errors. (Automated in this build via
      Playwright — not a source-code inference.)
- [ ] Confirm the Offline Status bar reports "ready for offline use"
      (not "still downloading") on a plain reload of an already-installed
      instance — this is the specific bug this build found and fixed (see
      `updatePrompt.ts`'s `hasActiveController` parameter).

## Windows desktop artifact verification

- [ ] Real installer (`.exe`) and portable (`.zip`) files exist at the
      paths named in the final report, with real SHA-256 hashes computed
      from the actual files (never fabricated)
- [ ] Underlying Electron app logic (IPC, persistence, backup/restore)
      exercised via a headless run on the build machine
- [ ] Explicitly flagged: the literal Windows install-wizard/launch/
      uninstall experience requires a real Windows machine to confirm —
      state this as a known verification gap rather than claiming PASS on
      it from a Linux-only build environment.

## Documentation

- [ ] `docs/USER_GUIDE.md` — version bump + Thai changelog entry
- [ ] All Build-027-specific docs present and cross-linked:
      `OFFLINE_APPLICATION.md`, `IPAD_PWA_INSTALLATION.md`,
      `WINDOWS_INSTALLATION.md`, `DATA_TRANSFER_PC_IPAD.md`,
      `OFFLINE_LIMITATIONS.md`, `STORAGE_AND_BACKUP_SAFETY.md`
- [ ] `CLAUDE.md` updated if the offline/desktop build process introduces
      a new required step for future `/app` changes

## Do not report PASS if

- The Windows installer was not actually generated
- The installed Windows app was not smoke-tested at all (source-only
  claims don't count)
- The PWA cannot reload offline in a real browser check
- IndexedDB data disappears after a restart/reload
- Backup Manager fails in either target
- The `.vspsb` transfer workflow fails
- Release artifact hashes were not calculated from real files
- Any test was skipped rather than fixed or explained
- Work remains uncommitted or unpushed
