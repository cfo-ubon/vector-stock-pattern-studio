# P2.5 Sprint 2 — UI Soak Report

Real Playwright/Chromium run against the actual running app
(`npm run validate:collections:ui-soak`, `scripts/uiSoak.ts`) — Section 7
of the Sprint 2 brief. Chromium launched headless from the pre-installed
binary (`/opt/pw-browsers/chromium`); the `playwright` package itself is
resolved from the environment's global install (not a project
dependency), matching this environment's own documented setup.

## Environment and dataset

- Real Chromium, driving the real built/dev-served app (Vite dev server,
  base path `/vector-stock-pattern-studio/studio/`) — not a mock DOM.
- Real browser IndexedDB (`vsp-db`, version 5), seeded directly via raw
  `indexedDB` calls executed inside the page context
  (`page.evaluate`), mirroring `storage/db.ts`'s exact schema
  (stores/keyPaths/indexes). This is a Playwright-side test-harness
  technique only — no seeding control exists in the production UI.
- Dataset: 1,500 assets, 15 collections, one collection forced to 1,200
  members (≥1,000 required by Section 7). 30 bounded preview/cover assets
  given real synthetic SVG `PortfolioFileRecord` Blobs in the seeded
  `portfolioFiles` store (bounded — not one per asset), so
  `usePreviewUrl`/`useCollectionCoverUrl` have something real to resolve.

## Results

| Metric | Result |
|---|---|
| Requested cycles | 100 |
| Completed cycles | **100** |
| Failed cycles | **0** |
| Page errors | **0** |
| Console errors | **0** |
| Blob URLs created / revoked | 172 / 172 |
| Outstanding Blob URLs at end | **0** |
| DOM node count (samples at cycles 0, 20, 40, 60, 80, 99) | 2,014 / 2,014 / 2,014 / 2,014 / 2,014 / 2,014 |
| DOM growth stable | **true** |

All acceptance criteria in Section 7 met: ≥100 UI interaction cycles
(exactly 100), zero unexpected page errors, zero unexpected console
errors, no permanent UI freeze, DOM size returned to (and stayed at) a
stable bounded range after the initial navigation settled.

## Scenarios exercised (round-robin, 20 cycles each)

| Scenario | Cycles | Avg duration | Max duration |
|---|---|---|---|
| search-collections | 20 | 90.5ms | 115ms |
| switch-active-archived-filter | 20 | 227.5ms | 336ms |
| open-collection-detail | 20 | 54.2ms | 67ms |
| paginate-members | 20 | 92.2ms | 162ms |
| switch-assets-collections-tabs | 20 | 194.5ms | 294ms |

No interaction exceeded a few hundred milliseconds; no visible freeze or
timeout was observed in any cycle.

## Two defects found and fixed during this section's first dry run

1. **Zero Blob URL activity** (`blobUrlStats: {created: 0, revoked: 0}`
   on the first attempt). Root cause: the seeded dataset had
   `previewReference: null` on every asset (the generator's default when
   no preview files are configured), so `usePreviewUrl`/
   `useCollectionCoverUrl` always resolved `broken: true` without ever
   calling `URL.createObjectURL` — the Blob URL lifecycle Section 7
   explicitly requires was never actually exercised. **Fix**: extended
   `buildUiDataset()` to assign a bounded set (`PREVIEW_SAMPLE_COUNT =
   30`) of assets (every cover asset, plus up to 30 members of the large
   collection) a synthetic `fileId` and matching `previewReference`, and
   extended the seeding `page.evaluate` block to write matching
   `portfolioFiles` records with real in-browser `Blob` objects (tiny 4×4
   placeholder SVGs). Re-run confirmed 172 created / 172 revoked / 0
   outstanding.
2. **False `domGrowthStable: false`** (first=177, last=2014 nodes on the
   first attempt). Root cause: the "first" DOM sample was captured
   *before* the first `open-collection-detail` scenario had ever run
   (pre-navigation, empty-view DOM size), while all later samples
   (cycles 20–99) were genuinely stable once the detail view had been
   opened once. **Fix**: added a warm-up pass (runs each scenario once,
   uncounted) before recording the "first" sample, so the baseline
   reflects the same steady state the later samples measure. Re-run
   confirmed `domGrowthStable: true` with all 6 samples at 2,014 nodes.

Both fixes are validation-script-only changes (`scripts/uiSoak.ts`) — no
production UI code was touched.

## Browsers certified

**Chromium only.** No other browser was actually run in this session, so
none is claimed. Per the brief: "Do not claim certification for browsers
that were not actually run."

## Test coverage

`scripts/uiSoak.ts` orchestrates real browser interactions and is
exercised end-to-end by the real Playwright run documented above rather
than by a mocked unit test (there is no meaningful way to unit-test "does
a real Chromium page freeze" without actually driving a real Chromium
page) — the completed 100-cycle real run above is this section's test
evidence, per Section 12's own emphasis on real measured runs for the
soak/UI-soak categories.
