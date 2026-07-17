# Portfolio Manager P1 Report — Core Database and Asset Library

**Mission** (per brief): create the first usable version of an offline
Portfolio Manager — import, store, browse, search, inspect, and safely
remove stock-vector source files without modifying or degrading the
originals. Implementation sprint, not a planning sprint.

## Executive summary

Shipped a complete offline asset-catalog feature under `src/catalog/`
(domain/storage/import/services) and `src/components/portfolio/` (UI),
wired into the app as a new top-level "🗂 Portfolio Manager" view. Storage
is IndexedDB-only (no localStorage fallback, per the brief's explicit
constraint — binary Blob bodies can't survive `JSON.stringify` and
localStorage's quota is far too small for a real asset library), reusing
the app's existing shared `storage/db.ts` connection (one `DB_VERSION` bump,
two new object stores) rather than opening a second database. Every
original source file is stored byte-for-byte; hashing, duplicate detection,
and export-time integrity checks all operate on the exact bytes read from
the user's file input and never re-encode them. 110 new tests across 16
files, including a 1,000+/1,200-record performance suite. Full existing
suite (2,356 tests) re-run: 2,355 passed, 1 pre-existing unrelated timeout
flake (confirmed, see "Full Test Results"). `tsc -b --noEmit` clean, `oxlint`
clean, production build succeeds, `/studio` rebuilt.

## Branch, commit, files changed

- **Branch**: `claude/vector-pattern-stock-app-aqimbk`
- **Commit**: recorded after this report is committed — see the final
  commit on this branch titled "Portfolio Manager P1: Core Database and
  Asset Library".
- **Files changed** (new unless marked MODIFIED):
  - `app/src/catalog/domain/{types,id,hash,asset,search}.ts` +
    `{hash,search,search.performance}.test.ts`
  - `app/src/catalog/storage/portfolioStore.ts` + `.test.ts`
  - `app/src/catalog/import/{fileValidation,basenameGrouping,previewSelection,jsonCompat,duplicates,importPipeline}.ts`
    + `{duplicates,importPipeline}.test.ts`
  - `app/src/catalog/services/{dashboard,healthCheck,exportAsset}.ts` +
    `{dashboard,healthCheck,exportAsset}.test.ts`
  - `app/src/components/portfolio/{PortfolioManagerView,PortfolioSidebar,PortfolioGrid,PortfolioThumbnail,PortfolioDetailPanel,PortfolioImportPanel,PortfolioHealthCheckPanel,usePreviewUrl,portfolio.css}.tsx/.ts`
    + `{PortfolioManagerView,PortfolioSidebar,PortfolioGrid,PortfolioGrid.performance,PortfolioDetailPanel,PortfolioImportPanel,PortfolioHealthCheckPanel}.test.tsx`
  - `app/src/storage/db.ts` (MODIFIED — `DB_VERSION` 3→4, new stores)
  - `app/src/App.tsx` (MODIFIED — new `'portfolio'` view state)
  - `app/src/components/ProjectBar.tsx` (MODIFIED — new button)
  - `app/src/testSetup.ts` (MODIFIED — `fake-indexeddb/auto` import)
  - `app/package.json` / `app/package-lock.json` (MODIFIED — `fake-indexeddb` devDependency)
  - `app/README.md` (MODIFIED — new Portfolio Manager section)
  - `docs/portfolio/PORTFOLIO_MANAGER_{ARCHITECTURE,DATA_MODEL,STORAGE,IMPORT_SPEC,P1_TEST_REPORT}.md` (new)
  - `docs/build_reports/PORTFOLIO_MANAGER_P1_REPORT.md` (this file, new)
  - `docs/USER_GUIDE.md` (MODIFIED — Thai feature section + v1.64 changelog)
  - `docs/ROADMAP.md` (MODIFIED — shipped entry + P2 recommendation)
  - `docs/CHANGELOG.md` (MODIFIED — technical changelog entry)
  - `studio/` (rebuilt production bundle — required by `CLAUDE.md` for every
    `/app` change; GitHub Pages serves this directory as static files)

## Architecture implemented, and why

Full detail in `docs/portfolio/PORTFOLIO_MANAGER_ARCHITECTURE.md`. Summary:

- **`src/catalog/` instead of `src/portfolio/`** — the sprint brief's
  suggested path collides with Build 013/014's existing, unrelated
  Portfolio *Intelligence* Engine (read-only statistical analysis over
  generated-pattern batches, no persistence, no file import). Rather than
  overwrite or rename existing work, all new domain/storage/import/service
  code lives at a non-colliding path; UI components live under
  `src/components/portfolio/` (no collision at that path).
- **Layered**: `domain/` (pure, no I/O) → `storage/` (the only layer that
  touches `indexedDB`) → `import/` → `services/` → UI. `storage/portfolioStore.ts`
  is the sole IndexedDB touchpoint, so a future SQLite/desktop-wrapper
  backend could replace it without any caller changing (the brief's
  explicit forward-compatibility requirement).
- **No worker**: every "expensive" operation (SHA-256 hashing via
  `crypto.subtle.digest`) is already non-blocking on browsers' native
  Promise-based API; no other module in this repo uses a Web Worker either,
  so none was introduced here.

## Storage technology, and why

**IndexedDB only — no localStorage fallback for the catalog**, unlike every
other `storage/*Store.ts` in this app. Two reasons, both hard constraints
rather than preferences:

1. Binary `Blob` file bodies cannot survive `JSON.stringify` (what
   localStorage requires); representing them any other way (e.g. base64)
   would mean re-encoding the bytes, which the brief explicitly forbids
   ("Do not resize or recompress original files").
2. localStorage's ~5-10MB per-origin quota cannot hold a real asset
   library; IndexedDB's disk-space-bound quota can.

Reuses the app's existing single shared `storage/db.ts` connection
(`DB_VERSION` 3 → 4, two new object stores added inside the existing
`onupgradeneeded` handler) rather than opening a second, competing
`indexedDB.open()` connection.

## Tests added

110 new tests across 16 files. Full category breakdown (domain, storage,
import, search, export, UI, performance) in
`docs/portfolio/PORTFOLIO_MANAGER_P1_TEST_REPORT.md`. Highlights:

- 1,200-record fixture for search/filter/sort performance (all operations
  measured in low single-digit milliseconds; assertions use a generous
  `<200ms` CI-safe bound).
- 1,000-record fixture for grid rendering: confirms only the first
  paginated page (40 cards) is ever mounted, keeping the DOM bounded
  regardless of catalog size.
- Real IndexedDB-backed storage tests (via `fake-indexeddb`), not mocks —
  atomic multi-store import/delete transactions, duplicate-hash lookup,
  in-place update, both deletion modes.
- End-to-end ZIP export with hash-integrity verification against a real
  stored asset.

## Full test results

```
$ npx vitest run                       # entire existing suite + new catalog/UI tests
 Test Files  1 failed | 191 passed (192)
      Tests  1 failed | 2355 passed (2356)
   Duration  498.77s
```

The one failure — `src/collection/collectionGenerator.test.ts` >
`generateCollection: Layout Variation (Section 5)` >
`layout diversity holds across a sample of built-in Style DNA presets too`
— is a **15-second test-timeout flake, confirmed unrelated to this sprint**:

- `git diff --stat -- src/collection/` shows **zero changes** to that file
  or any file it imports; Portfolio Manager never touches
  `src/collection/`.
- Re-run in isolation (no other test files running concurrently):

  ```
  $ npx vitest run src/collection/collectionGenerator.test.ts \
      -t "layout diversity holds across a sample of built-in Style DNA presets too"
   Test Files  1 passed (1)
        Tests  1 passed | 47 skipped (48)
     Duration  13.19s   (well under the 15s timeout)
  ```

  It passes cleanly once CPU contention from the other 191 concurrently-
  running test files' worker processes is removed — a timing-sensitive
  test, not a logic failure, and not something this sprint introduced or
  can fix without touching unrelated collection-generation code (out of
  scope per the brief's "do not make unrelated refactors").

Isolated catalog/UI suite:

```
$ npx vitest run src/catalog src/components/portfolio
 Test Files  16 passed (16)
      Tests  110 passed (110)
```

## Build/lint results

```
$ npx tsc -b --noEmit
(clean, no output)

$ npm run lint     # oxlint
(clean, no output)

$ npm run build    # tsc -b && vite build
✓ 366 modules transformed, built in 901ms
../studio/ rebuilt (content-hashed assets, index.html updated)
```

## Browser verification

Manual acceptance pass against the rebuilt dev server, covering the
sprint's 16-step checklist: open Portfolio Manager from the new "🗂
Portfolio Manager" button; import a matching SVG+PNG+JSON basename group
and verify it groups into one asset; verify the dashboard/grid/detail
panel show real (not sample) data; re-import the same files and observe
the exact-duplicate block; import a same-named-different-content file and
observe the possible-duplicate warning with "import as new"/"skip"
choices; search by filename; filter by workflow status; open asset
details and edit tags/rating/notes/workflow status; archive then restore;
export a ZIP and confirm it downloads; refresh the browser and confirm the
catalog persists (real IndexedDB, not session state); run the Health
Check panel and confirm its numbers match the imported data; confirm no
console errors throughout. See the companion browser-check notes for the
full step-by-step transcript.

## Performance results for 1,000+ assets

- **Search/filter** (1,200-record fixture, `catalog/domain/search.performance.test.ts`):
  keyword search and combined multi-filter search each completed in
  low single-digit milliseconds in this environment; every one of the 8
  sort keys completed in under 5ms. All comfortably within an interactive
  budget.
- **Grid rendering** (1,000-record fixture, `PortfolioGrid.performance.test.tsx`):
  only the first paginated page (40 cards) is mounted in the DOM at any
  time — the result count correctly reflects the full 1,000-record
  catalog, but rendering cost stays bounded to one page's worth of
  `PortfolioThumbnail` components regardless of catalog size. First-page
  render (including React's initial mount) completed in well under 1
  second.
- **Thumbnail lazy loading**: `usePreviewUrl` only fetches a file's Blob
  from IndexedDB when its owning `PortfolioThumbnail`/`PortfolioDetailPanel`
  actually mounts (i.e. only for visible, paginated-in cards) — never for
  the full catalog at once.

## Known P1 limitations

- **No folder (whole-directory) import** — relies on native multi-file
  selection and drag-and-drop instead of a browser-specific directory-
  picker API; covers the same "import several related files at once" need.
- **No full-library backup/restore ZIP** — only per-asset export is
  implemented in P1 (explicitly deferred by the brief: "Full-library
  backup is a later sprint"). The storage design does not block adding
  one — every stored file is already a plain Blob, so a whole-store export
  is a straightforward extension of `services/exportAsset.ts`.
- **No cross-device/cross-browser sync** — IndexedDB is local to one
  browser profile; explicitly out of scope per the brief. Per-asset ZIP
  export is the P1 way to move a single asset between browsers/devices.
- **Duplicate detection across sessions is signal-limited** — SHA-256 and
  filename+size/generator-seed matching work across all sessions;
  normalized-JSON-hash matching (catching re-serialized-but-identical JSON)
  only works *within* a single import batch, since the catalog does not
  store a normalized-JSON hash field for already-catalogued assets. This
  is a deliberate, documented scope limit (see
  `docs/portfolio/PORTFOLIO_MANAGER_IMPORT_SPEC.md`), not an oversight.
- **No automatic SVG viewBox / PNG dimension extraction** — the
  `dimensions` field exists on the domain model but the P1 import
  pipeline does not parse source files to populate it automatically; it
  remains `null` unless recoverable from imported JSON metadata.
- **No collection-linking UI** — `collectionIds` is reserved on the domain
  model but P1 has no UI to link a catalog asset to a Project Studio
  collection.
- **No auto-repair from the Health Check panel** — by design, per the
  brief ("Do not silently repair destructive issues"); it is read-only-
  report today.

## Next highest-priority P2 recommendation

**Collection-linking + full-library backup/restore.** Both build directly
on P1's existing data model and storage design without requiring a
storage-layer rewrite:

- `PortfolioAsset.collectionIds` is already reserved on the domain model —
  a P2 UI action to link/unlink a catalog asset to one or more Project
  Studio collections is additive, not a schema change.
- A whole-library backup ZIP is a straightforward generalization of
  `services/exportAsset.ts`'s per-asset export: iterate every
  `PortfolioAsset` + `PortfolioFileRecord` instead of one asset's subset,
  write one `manifest.json` covering the whole catalog. No new storage
  primitive is needed — `loadPortfolioAssets()`/`loadAllPortfolioFiles()`
  already exist.
- Together these address the two most-requested "next" capabilities implied
  by the sprint brief's own explicit "later sprint" callouts (Section 12's
  full-library backup, and the general theme of a catalog needing to
  connect to the rest of the app's collection/marketplace workflow) while
  strictly respecting the brief's "strictly out of scope" list (no
  marketplace upload automation, no cloud sync, no AI APIs).
