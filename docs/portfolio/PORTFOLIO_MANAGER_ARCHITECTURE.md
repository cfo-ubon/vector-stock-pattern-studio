# Portfolio Manager — Architecture (P1)

Sprint: **Portfolio Manager P1 — Core Database and Asset Library**. This
document explains the architectural decisions behind the new offline asset
catalog: where it lives, how it's layered, and why it's built the way it is.

## What this is (and isn't)

Portfolio Manager is an **offline catalog of externally-produced
stock-vector source files** — the user imports SVG/PNG/JSON/EPS/AI file
sets that were produced *outside* the Generator (or exported from it earlier
and now live on disk), and the catalog stores, browses, searches, and
safely deletes them without ever touching their original bytes.

It is explicitly **not**:

- The Generator (`components/DesignWorkbench.tsx`, `engine/*`) — untouched.
- The **Portfolio *Intelligence* Engine** (`src/portfolio/`, Build 013/014)
  — a read-only statistical analysis layer over freshly-generated pattern
  *batches*, with no persistence and no file import. Same word, unrelated
  feature — see "Naming collision" below.
- The **Asset Ecosystem Engine** (`src/assets/`) — extracted/decomposed
  *editable SVG-AST motifs* lifted out of a generated Collection, stored in
  the `assets` IndexedDB store. Portfolio Manager stores opaque file Blobs,
  never parses or edits SVG geometry.
- The existing "คลังลายที่บันทึก" saved-patterns library
  (`storage/savedPatternsStore.ts`) — that's Generator-output patterns with
  submission tracking, unrelated data model, unrelated store.

## Naming collision: why `src/catalog/`, not `src/portfolio/`

`src/portfolio/` already exists (Build 013/014's Portfolio Intelligence
Engine). Per the sprint brief's instruction to never overwrite or degrade
existing work, all new domain/storage/import/service code lives under
**`src/catalog/`** instead. UI components live under
`src/components/portfolio/` (no collision at that path), and the
user-facing product name "Portfolio Manager" is used throughout the UI and
docs — the collision is only a source-path concern, resolved by picking a
different directory for the new module.

## Layer map

```
src/catalog/
  domain/       Asset model, IDs, hashing, search/filter/sort — pure, no I/O
    types.ts       PortfolioAsset, PortfolioFileRecord, WorkflowStatus, SourceFileRole
    id.ts           generateAssetId (VSP-YYYYMMDD-XXXXXX), generateFileId
    hash.ts         sha256Hex, sha256HexOfFile, normalizedJsonHash
    asset.ts        createPortfolioAsset, normalizePortfolioAsset, isValidPortfolioAsset
    search.ts       PortfolioFilterQuery, searchPortfolioAssets, sortPortfolioAssets
  storage/      IndexedDB persistence — the only layer that touches indexedDB
    portfolioStore.ts
  import/       File → PortfolioAsset pipeline
    fileValidation.ts    extension → role/mime, unsupported-type blocklist
    basenameGrouping.ts  groups files sharing a basename into one asset
    previewSelection.ts  picks the best preview source file
    jsonCompat.ts        tolerant multi-shape JSON metadata extraction
    duplicates.ts         multi-signal duplicate detection
    importPipeline.ts     orchestrates the above into one asset record + atomic write
  services/     Read-side aggregations over the catalog
    dashboard.ts    DashboardSummary (P1 minimum stats)
    healthCheck.ts  HealthCheckReport (data-integrity checks, read-only)
    exportAsset.ts  per-asset ZIP export with hash-integrity verification

src/components/portfolio/   UI (Thai copy, reuses App.css design tokens)
  PortfolioManagerView.tsx      top-level container (owns load/filter/selection state)
  PortfolioSidebar.tsx          left panel: dashboard stats + filters + actions
  PortfolioGrid.tsx             main area: search/sort/paginated thumbnail grid
  PortfolioThumbnail.tsx        one grid card
  PortfolioDetailPanel.tsx      right panel: full metadata, editing, delete flow
  PortfolioImportPanel.tsx      import modal (drag-and-drop + file input)
  PortfolioHealthCheckPanel.tsx health check modal (read-only report)
  usePreviewUrl.ts               lazy Blob → object URL hook
```

Each layer only depends on the layer(s) above it in this list — `domain/`
has zero imports from `storage/`, `import/`, `services/`, or UI;
`storage/` only depends on `domain/` and the shared `storage/db.ts`;
`import/` depends on `domain/` and `storage/`; `services/` depends on all
three; UI depends on everything. This makes every non-UI layer testable
without a DOM or IndexedDB polyfill except where a test explicitly needs to
exercise a real storage round-trip.

## Why this shape, not the "suggested" `src/portfolio/{domain,...}` layout

The sprint brief suggested (and explicitly said to adapt)
`src/portfolio/{domain,storage,import,services,ui,workers,tests}`. Two
deviations from that suggestion, both forced by the existing repo:

1. **`src/catalog/` instead of `src/portfolio/`** — the naming collision
   above.
2. **No `workers/` directory, no dedicated `tests/` directory** — every
   other engine module in this app (`engine/`, `collection/`, `assets/`,
   `workbench/`) co-locates `*.test.ts` next to the module it tests rather
   than a parallel test tree, and none of them use a Web Worker (all
   "expensive" operations — SVG generation, quality scoring on
   thousands-of-patterns portfolios — already run synchronously on the
   main thread elsewhere in this codebase without a worker). Portfolio
   Manager's own heaviest operation, SHA-256 hashing, uses the browser's
   native `crypto.subtle.digest`, which is already non-blocking (it
   returns a Promise and the browser does not run it on the JS main
   thread), so no worker was needed to keep the import UI responsive —
   see `PORTFOLIO_MANAGER_IMPORT_SPEC.md` and the performance test results
   in `PORTFOLIO_MANAGER_P1_TEST_REPORT.md`.

## Storage technology: IndexedDB only, no localStorage fallback

Every other `storage/*Store.ts` in this app (saved patterns, projects,
Style DNA, workbench history) falls back to `localStorage` when IndexedDB
is unavailable. Portfolio Manager deliberately does **not** — this is an
explicit instruction from the sprint brief ("Do not use LocalStorage for
asset files or the primary catalog"), and it's also the only technically
sound choice here:

- **Binary Blob bodies cannot survive `JSON.stringify`.** Every other
  store persists plain JSON-serializable data; Portfolio Manager persists
  the literal bytes of imported SVG/PNG/EPS/AI/JSON files as `Blob`
  objects, which IndexedDB stores natively (via the structured clone
  algorithm) and `localStorage` cannot represent at all without a lossy
  base64 re-encoding step — a operation the brief also explicitly forbids
  ("Do not resize or recompress original files").
- **Quota.** `localStorage` is capped around 5–10MB per origin in most
  browsers; a real asset library (dozens to hundreds of SVG/PNG/EPS
  source-file sets) will exceed that almost immediately. IndexedDB's quota
  is disk-space-bound (typically gigabytes), which is what a "core
  database and asset library" sprint requires.

`portfolioStorageAvailable()` (`catalog/storage/portfolioStore.ts`) lets
`PortfolioManagerView` show a clear, honest "this browser doesn't support
IndexedDB" message instead of silently degrading to a broken or
data-lossy fallback — see the "Browser limitations" section of
`docs/USER_GUIDE.md`'s Portfolio Manager entry.

## Reused vs new

**Reused, unmodified in behavior:**

- `storage/db.ts`'s shared single-connection `openDb()` — Portfolio
  Manager only adds two `createObjectStore` calls inside the existing
  `onupgradeneeded` handler and bumps `DB_VERSION` 3 → 4. It does not open
  a second `indexedDB.open()` connection, which would risk a version-
  negotiation race against the existing one.
- `export/zip.ts`'s `buildZip()` — the same dependency-free, no-
  recompression (STORE method) ZIP writer the Stock Submission Center's
  package export already uses.
- The Thai-copy-with-English-technical-terms localization convention from
  `ProjectDashboard.tsx`/`DesignWorkbench.tsx`.
- The `App.css` global CSS custom properties (`--bg`, `--panel`, `--text`,
  `--accent`, …) — no new design system, no light/dark toggle (the main
  app outside the Design Workbench doesn't have one either).
- The `usePagination`/"show more" pattern from `ProjectExplorer.tsx` for
  the thumbnail grid (this app has no virtualized-list dependency
  anywhere).
- Browser-native `crypto.subtle.digest('SHA-256', …)` for hashing — no new
  dependency.

**New:**

- `fake-indexeddb` (devDependency) — gives the vitest/jsdom test
  environment a real IndexedDB implementation so `catalog/storage/*.test.ts`
  can test actual CRUD/transaction behavior instead of mocking it away.
  See `PORTFOLIO_MANAGER_P1_TEST_REPORT.md` for the one non-obvious
  compatibility issue this surfaced (jsdom `Blob` vs. Node's
  `structuredClone`) and how it was resolved.
- Everything under `src/catalog/` and `src/components/portfolio/`.

## Extension points for a future desktop/SQLite backend

The brief asks that "the storage layer must be abstracted so a future
desktop wrapper or SQLite implementation could be added without rewriting
the domain layer." `catalog/storage/portfolioStore.ts` is the only module
that imports `indexedDB`/`storage/db.ts` directly — every other layer
(`domain/`, `import/`, `services/`, UI) calls its exported functions
(`loadPortfolioAssets`, `importAssetTransaction`, `getPortfolioFile`, …) and
never touches `IDBDatabase`/`IDBTransaction` types itself. A SQLite-backed
(e.g. Tauri/Electron) implementation of the same function signatures —
returning `PortfolioAsset[]`/`PortfolioFileRecord` shapes unchanged — could
replace `portfolioStore.ts` without any caller needing to change, provided
Blob bodies map to a `BLOB`/file-path column and the same atomic-write
guarantee (`importAssetTransaction`, `deletePortfolioAssetAndFiles`) is
preserved via a SQL transaction.
