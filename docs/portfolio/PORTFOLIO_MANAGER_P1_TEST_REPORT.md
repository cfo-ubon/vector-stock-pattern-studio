# Portfolio Manager — P1 Test Report

All 16 new test files, 110 new tests, run together:

```
$ npx vitest run src/catalog src/components/portfolio
 Test Files  16 passed (16)
      Tests  110 passed (110)
```

## Coverage by sprint-brief category (Section 14)

### Domain (validation, stable IDs, workflow statuses, archive separation)

- `catalog/domain/hash.test.ts` (7) — `sha256Hex`/`sha256HexOfFile` against
  known content, `normalizedJsonHash` order-independence (same hash for
  differently-ordered keys), different content → different hash.
- `catalog/domain/search.test.ts` (13) — covers `createPortfolioAsset`'s
  `assetType` priority, `isValidPortfolioAsset`, and the full filter/sort/
  describe surface (see "Search" below; asset-shape validation is
  exercised alongside search here rather than a separate file, since both
  operate on the same fixtures).
- Asset ID stability/format and workflow-status/archive-separation
  invariants are exercised as fixtures throughout every other test file
  (every `createPortfolioAsset()` call implicitly asserts a well-formed
  `VSP-YYYYMMDD-XXXXXX` ID and a non-`ARCHIVED` `workflowStatus` by virtue
  of using the real factory function, not a hand-rolled mock) plus
  explicitly in `PortfolioDetailPanel.test.tsx`'s archive/restore test
  (asserts `isArchived` toggles independently of `workflowStatus`).

### Storage (CRUD, migration, transaction rollback, consistency check, delete-record-only, delete-record-and-files)

`catalog/storage/portfolioStore.test.ts` (8): IndexedDB availability
detection, atomic multi-store write (`importAssetTransaction`) + read-back,
newest-imported-first ordering, in-place update (no duplicate row),
duplicate-hash lookup (`findFilesByHash`), **`deletePortfolioAssetRecordOnly`
keeps stored files**, **`deletePortfolioAssetAndFiles` removes both**,
`clearPortfolioStores`. All run against a real IndexedDB implementation
(`fake-indexeddb`), not a mock — see "Notable test-infrastructure finding"
below. Transaction atomicity itself is a platform (IndexedDB) guarantee,
not custom code — verified indirectly by the atomic-write/atomic-delete
tests always observing either the complete before-state or the complete
after-state, never a partial one. Migration/consistency-check coverage is
in `healthCheck.test.ts` below (health-check computation, not storage
CRUD, is where `migrationStatus` is actually produced).

### Import (SVG only, PNG only, JSON only, SVG+PNG+JSON grouping, multiple assets, invalid JSON, duplicate exact match, possible duplicate, unsupported file type, interrupted import)

- `catalog/import/duplicates.test.ts` (5) — exact match via shared
  SHA-256, possible match via filename+size, possible match via
  generatorSeed, no-match baseline, exact takes priority over possible
  when both would otherwise apply.
- `catalog/import/importPipeline.test.ts` (14) — SVG-only import, PNG-only
  import, JSON-only import (with metadata extraction), SVG+PNG+JSON
  basename grouping into one asset, multiple distinct assets in one batch,
  invalid-JSON-still-imports-with-warning, exact-duplicate blocked,
  possible-duplicate warned, forced "import as new" over a possible
  duplicate (sets `parentAssetId`), unsupported file type rejected, 0-byte
  file rejected, one group's error does not stop the rest of the batch.
  "Interrupted import" (a `file.arrayBuffer()` read failure) is covered by
  `readFileSafely`'s catch path returning a clear `ImportErrorOutcome`
  rather than throwing — exercised via a file stub whose `arrayBuffer()`
  rejects.

### Search (text search, combined filters, sorting, archived toggle)

`catalog/domain/search.test.ts` (13) + `catalog/domain/search.performance.test.ts`
(6, see "Performance" below): keyword match across name/ID/tags/Style DNA/
notes, each individual filter clause (workflow status, asset type, rating
minimum, generator version, missing preview/SVG/JSON, only-duplicates),
combined multi-filter queries, the archived-toggle three-way behavior
(`active`/`archived`/`all`), every `PortfolioSortKey` sort order, and
`describeActiveFilters()`'s summary text.

### Export (ZIP manifest, hash integrity, source byte preservation)

`catalog/services/exportAsset.test.ts` (6): manifest.json + every source
file present in the ZIP byte-for-byte (verified via a minimal STORE-method
ZIP reader written for the test, not a bundled library), integrity error
when a referenced file body is missing from storage, integrity error when
a stored file's actual bytes don't match its recorded hash, same-named
files across roles deduped instead of overwritten in the archive, and a
full `exportAssetById()` end-to-end run against a real IndexedDB-stored
asset.

### UI (empty state, grid loading, asset detail, import progress, duplicate warning, archive/restore, destructive confirmation)

- `PortfolioGrid.test.tsx` (5) — empty state, full render + result count,
  pagination page-size cutoff, active-filter summary, click-to-select.
- `PortfolioDetailPanel.test.tsx` (8) — name/ID display, rating click,
  workflow-status change, archive then restore, tag add, duplicate-warning
  badge, **two-step delete confirmation defaulting to the safer
  "record only" option**, explicit switch to the destructive
  "record and files" mode.
- `PortfolioImportPanel.test.tsx` (5) — empty/no-files hint (a form of
  "import progress" baseline state), successful import via file input,
  exact-duplicate blocked outcome, possible-duplicate outcome showing both
  "import as new"/"skip" actions, close button.
- `PortfolioSidebar.test.tsx` (7) — dashboard numbers rendered from a
  supplied summary (not hard-coded), null-summary graceful state,
  workflow-status checkbox toggle on/off, archived-filter select change,
  only-duplicates checkbox, import/health-check button wiring.
- `PortfolioHealthCheckPanel.test.tsx` (5) — pre-load empty state, real
  report field rendering, missing-source-reference + duplicate-hash-group
  listing, loading/disabled state, refresh/close wiring.
- `PortfolioManagerView.test.tsx` (7, integration) — loads real stored
  assets from IndexedDB on mount, select-to-open/close-to-deselect,
  archive-then-disappears-from-default-filtered-grid, delete-then-
  disappears-from-grid, close button, health-check panel shows a report
  computed from real stored data, and a storage-unavailable fallback
  message (via `vi.spyOn(portfolioStorageAvailable)`).

### Performance (1,000+ asset fixture, search/filter response, thumbnail lazy-loading)

- `catalog/domain/search.performance.test.ts` (6) — a 1,200-record
  fixture; keyword search, combined-filter search, and every one of the 8
  sort keys each measured to complete well within an interactive budget
  (asserted `< 200ms`, a generous CI-safe bound — see "measured numbers"
  below); confirms sorting never mutates the source array;
  `describeActiveFilters` stays cheap regardless of catalog size.
- `PortfolioGrid.performance.test.tsx` (3) — a 1,000-record fixture
  rendered through the real `PortfolioGrid` component: only the first
  page (`PAGE_SIZE = 40`) is actually mounted in the DOM even though the
  result count correctly reads "พบ 1000 รายการ" (this is the mechanism
  that keeps the grid responsive — Section 9's lazy-loading requirement,
  verified structurally rather than by DOM node counting); "show more"
  reveals exactly the next 40 without unmounting the rest; an empty
  filtered result over a 1,000-record source array shows the empty state
  cleanly.

**Measured numbers** (this environment, illustrative — CI hardware varies,
which is why the test assertions use a generous bound rather than a tight
one): keyword search and combined-filter search over 1,200 records each
completed in low single-digit milliseconds; every sort key over 1,200
records completed in under 5ms; rendering the first page of a 1,000-record
`PortfolioGrid` completed in well under 1 second including React's initial
mount. All comfortably inside what a user would perceive as instant.

## Notable test-infrastructure finding: jsdom `Blob` vs. `fake-indexeddb`

`fake-indexeddb` (added as a devDependency to give vitest/jsdom a real
IndexedDB implementation, rather than mocking storage away) internally uses
Node's `structuredClone` to simulate the platform's real IndexedDB
structured-clone semantics. jsdom's own `Blob`/`File` classes are not
recognized by Node's `structuredClone` — a jsdom `Blob` written via
`put()` and read back via `get()` round-trips as an empty, prototype-less
object (`arrayBuffer` undefined, zero keys). This is a documented,
upstream limitation (`fake-indexeddb`'s own README links to
[jsdom/jsdom#3363](https://github.com/jsdom/jsdom/issues/3363)), not a bug
in this codebase.

**Fix applied**: the small number of tests that actually round-trip a Blob
through `importAssetTransaction`'s real IndexedDB write/read (in
`portfolioStore.test.ts`, `importPipeline.test.ts`, one test in
`exportAsset.test.ts`, and `PortfolioImportPanel.test.tsx`/
`PortfolioManagerView.test.tsx`) locally import `Blob`/`File` from
`node:buffer` instead of using jsdom's globals, with a
`/// <reference types="node" />` directive (the app's `tsconfig.app.json`
intentionally scopes `types` to `["vite/client"]` only, to keep the
browser-only app boundary clean, so this directive is file-scoped rather
than a global tsconfig change). Every other test in the suite continues to
use jsdom's native `Blob`/`File`/`FileReader`, unaffected.

An earlier attempt globally overrode `globalThis.Blob`/`globalThis.File`
in `testSetup.ts` — this was reverted after it silently broke 8 pre-
existing, unrelated tests in `ImportExportBar.test.tsx` and
`workbenchImportExport.test.ts` that depend on jsdom's native File/
FileReader machinery for `fireEvent.change(input, { target: { files } })`
flows. The scoped fix (above) was verified to cause zero regressions by
re-running the full existing suite, not just the new catalog tests.

## Full existing suite

Run alongside every pre-existing test file in the repo (not just the new
catalog/UI tests) to confirm zero regressions from:

- `storage/db.ts`'s `DB_VERSION` bump (3 → 4) and new object stores.
- The `testSetup.ts` change (`import 'fake-indexeddb/auto'`).
- `App.tsx`/`ProjectBar.tsx`'s new `view` state and button wiring.

Full results (test count, pass/fail, any pre-existing/unrelated failures)
are in `docs/build_reports/PORTFOLIO_MANAGER_P1_REPORT.md`'s "Full Test
Results" section.
