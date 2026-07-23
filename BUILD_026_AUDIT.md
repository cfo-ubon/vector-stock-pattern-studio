# BUILD 026 — Production Portfolio & Commercial Feedback Engine: Audit

Method: direct inspection of the actual source (not re-derived from the
brief's own description of what "should" exist). Every finding below cites
the real file(s) it comes from. Baseline: commit `3c8bbb5` on
`claude/build-025-luxury-floral-composition-stability` (Build 025, PASS).

## 1. What already exists (do not duplicate)

This codebase already contains a substantial, previously-shipped commercial
workflow layer under `app/src/catalog/`, built across several prior builds
that this brief's phase list largely re-describes without naming them:

| Prior build | Directory | What it already does |
|---|---|---|
| Portfolio Manager (P1/P2) | `catalog/domain/`, `catalog/storage/`, `catalog/import/` | `PortfolioAsset` domain model, IndexedDB storage (`portfolioAssets`/`portfolioFiles`/`collections` stores), SHA-256 + normalized-JSON hashing, a 3-tier duplicate detector (`none`/`exact`/`possible`), an import pipeline with basename grouping and preview selection |
| Build 015 (Stock Submission Center) | `catalog/submission/` | `SubmissionStatus` state machine (8 states, transition table), `SubmissionRecord` domain model with append-only status history, **5 built-in marketplace profiles including Getty Images** (`marketplaceProfile.ts`), submission-specific duplicate detection, validation, queue, history, search/filter, statistics — all with dedicated test files |
| Build 016 (SEO Engine) | `catalog/seo/` | Marketplace-aware keyword/title/description generation and validation, per-marketplace keyword-count profiles |
| Build 017 (Portfolio Dashboard) | `catalog/dashboard/` | Analytics (collection/submission/SEO/readiness), `portfolioHealthCalculator.ts`, a **workflow-hygiene** `recommendationEngine.ts` (SEO completeness, missing metadata, duplicates, empty collections — NOT commercial-performance-based) |
| P3 (Backup & Restore) | `catalog/backup/` | Full backup/restore of assets + files + collections, schema-versioned, preview/overwrite/merge/cancel restore modes |
| Build 021 (Production Mode) | `batch/productionBundleService.ts`, `batch/batchExportService.ts` | Batch SVG+EPS+CSV bundling reusing `export/svgExporter.ts`/`epsExporter.ts`/`metadata/csv.ts`, a `BatchExportManifest` concept |

This build's job is to **extend** this layer, not re-architect it. Every
new module below is additive; nothing in `catalog/domain`, `catalog/storage`,
`catalog/submission`, `catalog/seo`, `catalog/dashboard`, `catalog/backup`,
or `batch/` gets rewritten — only extended with new optional fields, new
stores, and new sibling modules.

## 2. Current portfolio data model (exact shape)

`PortfolioAsset` (`catalog/domain/types.ts`, schema v1): `assetId` (random,
NOT content-derived — `VSP-YYYYMMDD-XXXXXX` from `domain/id.ts`),
`generatorVersion`, `styleDna`, `presetId`, `compositionType`,
`generatorSeed`, `productTargets`, `workflowStatus` (7-state, asset-level,
not marketplace-specific), `sourceFileReferences` (with per-file SHA-256),
`sourceHashes`, `parentAssetId`/`variationGroupId`. **No Beauty Score,
Commercial Score, fragmentation status, thumbnail score, or
READY/REVIEW/REJECT classification field exists anywhere on this type** —
those only exist transiently in `scripts/qualityReport.ts`'s `EvalResult`
during a generation script run and are never persisted into the catalog.

`SubmissionRecord` (`catalog/submission/submissionRecord.ts`, schema v1):
`submissionId`, `patternId` (opaque, decoupled from `PortfolioAsset`),
`marketplaceId`, `status`, `version`, `titleSnapshot`/`descriptionSnapshot`/
`keywordSnapshot`/`category`, `notes`, `statusHistory`. **No contributor
account label, submitted filename/file-types, editorial/commercial flag, AI
declaration, submission batch, review/approved/rejection dates, rejection
reason, resubmission fields, marketplace asset ID/URL, or separate
reviewer-vs-user notes** — these are genuine gaps this build must add.

## 3. Existing reusable components

- Hashing: `catalog/domain/hash.ts` — `sha256Hex`/`sha256HexOfFile`
  (browser-native `crypto.subtle`, no dependency) and `normalizedJsonHash`
  (order-independent JSON hash). Reused as-is for the new
  `productionAssetId` fingerprint and for CSV/package integrity hashes.
- Duplicate detection: `catalog/import/duplicates.ts`'s `detectDuplicate`
  (asset-import time) and `catalog/submission/submissionDuplicateDetection.ts`
  (submission-time) are both real and tested, but neither classifies into
  the brief's 5-way taxonomy (`EXACT_DUPLICATE`/`CONFIG_DUPLICATE`/
  `SEED_DUPLICATE`/`POSSIBLE_VISUAL_DUPLICATE`/`NOT_DUPLICATE`) — this
  build adds a classification layer that calls into both existing
  detectors rather than replacing them.
- ZIP building: `export/zip.ts` (hand-rolled, no dependency) — reused for
  the Submission Package Builder.
- CSV building: `metadata/csv.ts` (`buildShutterstockCsv`/
  `buildAdobeStockCsv`) — reused where the existing column sets already
  match; new marketplace/reason-code columns are added in new builders,
  not by changing these.
- Marketplace profiles: `catalog/submission/marketplaceProfile.ts` already
  has Shutterstock/Adobe Stock/Freepik/Getty Images/Etsy as data, with a
  `registerMarketplaceProfile` runtime-extension path — satisfies "allow
  additional marketplaces later" already; this build only adds the
  additional per-marketplace fields the brief asks for (file naming,
  AI-declaration expectations, commercial/editorial flags) as optional
  fields, default-populated for the 5 existing profiles.

## 4. Missing production workflow features (real gaps — this build's actual scope)

1. **Content-derived `productionAssetId`.** Today's `assetId` is random at
   import time; nothing survives a file being copied, renamed, or
   regenerated with the same seed. Needed: a canonical fingerprint over
   (generatorVersion, styleDna, presetId, compositionType, productTargets,
   generatorSeed, canonical SVG content hash) that two independently
   imported copies of the same generated design compute identically to.
2. **Persisted quality classification.** No store remembers Beauty/
   Commercial score or READY/REVIEW/REJECT for an asset after the
   generation script that computed it exits — the classifier itself is
   copy-pasted per-build-script (`build025Portfolio100.ts`,
   `build025HumanReview.ts`, `build024Portfolio100.ts`, ...), never a
   shared module.
3. **Submission storage does not scale.** `catalog/submission/submissionStore.ts`
   is a single `localStorage` key, JSON-stringifying the *entire* record
   array on every write. localStorage has a ~5-10MB practical ceiling and
   this is O(n) per write — this will not hold "thousands of patterns" ×
   5 marketplaces × growing status history, and directly contradicts this
   brief's "support future portfolio size above 10,000 assets." **This is
   the audit's one confirmed genuine storage risk**, and fixing it
   (migrate to IndexedDB, preserving existing localStorage data via a
   one-time migration) is in scope.
4. **No sales/revenue/download tracking at all.** Confirmed by grep — zero
   hits for revenue/downloads/sales anywhere in `catalog/`.
5. **No rejection taxonomy.** `SubmissionRecord` has no `rejectionReason`
   field; nothing normalizes free-text marketplace rejection text into the
   brief's 17 categories.
6. **No CSV/Excel bulk-result import.** `catalog/import/` only imports the
   app's own JSON/asset-file shapes, not marketplace-result spreadsheets.
7. **No Commercial Feedback Engine.** Build 017's `recommendationEngine.ts`
   is workflow hygiene (SEO gaps, duplicates, empty collections) — a
   fundamentally different, already-solved problem from "does this Style
   DNA/composition/marketplace actually sell," which requires real
   submission+sales outcomes as input and does not exist anywhere.
8. **No Production Queue** (IDEA→...→PERFORMANCE_TRACKING) — `WorkflowStatus`
   (asset-level) and `SubmissionStatus` (per-marketplace) both stop at
   `APPROVED`/`REJECTED`; nothing tracks pre-generation planning or
   post-approval performance monitoring as a queue.
9. **No Submission Package Builder** in the brief's sense (manifest +
   SHA-256SUMS + per-marketplace checklist + duplicate-warning report,
   regenerable, with package history) — `productionBundleService.ts` is
   close (reuses the same underlying exporters) but produces one
   general-purpose bundle, not a marketplace-targeted package with a
   verifiable manifest.
10. **No importer for the historical report folders.** `catalog/import/`
    expects the catalog's own JSON export shape; `reports/build_023*/`,
    `reports/build_024*/`, `reports/build_025/portfolio_100/`,
    `portfolio_phase_1/`, and `portfolio_phase_1b_review/` are raw
    ad-hoc script output (per-folder PNG/SVG/JSON/CSV, no unified schema)
    and need a dedicated, tolerant importer.
11. **Backup does not cover any of the above.** `catalog/backup/backupFormat.ts`
    has zero references to submissions/marketplaces — a backup taken today
    silently excludes the entire Submission Center, let alone anything new
    this build adds.
12. **No UI for the Submission Center at all.** Grep of
    `app/src/components/` finds Portfolio Manager UI
    (`components/portfolio/*`) but no component ever imports from
    `catalog/submission/` — Build 015-017's work is fully real, tested,
    pure-logic, and **completely unreachable from the running app**. Every
    new UI surface this build adds needs to also be the *first* UI for the
    existing Submission Center, not just for this build's new modules.

## 5. Database/storage risks

- **Confirmed**: `submissionStore.ts`'s localStorage strategy (Section 4.3)
  — must migrate to IndexedDB with a preserving migration, not a fresh
  start (rule: "Local database migrations must preserve existing data").
- **IndexedDB version coupling**: `storage/db.ts`'s `DB_VERSION=5` is a
  single shared version number across every existing store (`saved`,
  `projects`, `assets`, `portfolioAssets`, `portfolioFiles`,
  `collections`). Adding new stores means bumping to `DB_VERSION=6` in the
  same file — every `onupgradeneeded` branch is already written to be
  idempotent and additive, so this is safe, but it is the **one shared
  choke point**: a mistake here risks every existing store, including
  Build 025's own generation-adjacent saved-pattern data. New stores are
  added as new idempotent branches only; no existing branch is touched.
- **No SQLite/sql.js dependency exists** (`app/package.json` confirmed —
  only `react`/`react-dom` runtime deps). Decision (see
  `docs/DATABASE_SCHEMA.md`): extend the existing, mature, versioned
  IndexedDB layer rather than introduce sql.js WASM. Rationale: (a) this
  is a pure client-side Vite SPA with no Node/Electron backend in this
  branch (a *separate* `codex/offline-windows-desktop` branch already uses
  real SQLite via Electron — not applicable here), (b) sql.js's browser
  persistence story (OPFS, spotty across browsers, or re-serializing the
  whole DB to an IndexedDB blob on every write) is worse at the requested
  10,000+-asset scale than native IndexedDB's per-record transactions and
  indexes, (c) the existing IndexedDB layer already has 5 versions of
  proven, tested, idempotent migration history to build on. The brief says
  "Preferred: SQLite" — this is evaluated and declined for a documented
  technical reason, not skipped.

## 6. Migration requirements

- New IndexedDB stores (added as new idempotent branches in
  `storage/db.ts`, `DB_VERSION` 5→6): `submissions` (replaces the
  localStorage store; migration reads the existing `vsp-submission-center-records`
  localStorage key once, imports every record, and only then treats
  localStorage as advisory/legacy — never deletes the localStorage key
  itself, so a crash mid-migration loses nothing), `salesEvents`,
  `rejectionRecords`, `qualitySnapshots`, `productionQueueItems`,
  `productionBatches`, `importHistory`, `databaseBackups` (backup
  *history* metadata; the backup *payload* itself remains a downloadable
  file, unchanged from P3's existing convention).
- `PortfolioAsset` gets new **optional, additive** fields
  (`productionAssetId`, `qualitySnapshotId`) — schema version stays
  detectable via presence, following the same defensive-normalization
  convention `normalizePortfolioAsset`-equivalent code already uses
  elsewhere in this codebase (every new field has a safe fallback for
  records written before this build).
- `SubmissionRecord` gets new optional fields (Section 4's list) with a
  bumped `SUBMISSION_SCHEMA_VERSION` (1→2) and a normalization function
  that fills every new field with a safe default for records created
  before this build — mirroring `normalizeSubmissionRecord`'s existing
  pattern exactly.

## 7. Large-file handling risks

- `PortfolioFileRecord.blob` (Blob bodies) already live in their own
  IndexedDB store, separate from metadata — this build does not change
  that; new stores (sales, rejections, queue, quality snapshots) are all
  small structured records, never Blobs, so this risk is not reintroduced.
- The historical-portfolio importer (`portfolio_phase_1/` has 10 style
  folders each with per-pattern `.eps/.json/.png/.svg` plus a per-folder
  `.zip` — the `.zip`s themselves must NOT also be imported as if they
  were individual assets; the importer only reads the loose per-pattern
  files and treats the zips as already-packaged output to skip, to avoid
  double-counting/bloating the database with redundant zipped copies of
  files already imported individually).
- ZIP-import path-traversal: any user-facing "import a ZIP" path (Phase
  20's "portfolio_phase_1b_review/zips/" is loose files not user-uploaded
  archives, but the CSV/Excel bulk-import and any future package-import
  UI does accept user files) must reject entry names containing `..` or
  absolute paths before extraction — implemented once as a shared guard,
  reused everywhere a ZIP or archive is read back in.

## 8. Duplicate-submission risks

`submissionDuplicateDetection.ts` already checks same-pattern-same-
marketplace conflicts at submission-creation time. Real gaps: it does not
yet consult the new `productionAssetId`-based classification (a renamed/
copied file's submission history is invisible to it today, since it keys
off the opaque `patternId` the caller supplies, and there is no map from a
new import's `productionAssetId` back to a differently-named prior import
of the same generated pattern). This build adds a
`productionAssetId`-aware pre-submission check that layers on top of (not
instead of) the existing check.

## 9. Marketplace-specific differences

Confirmed already correctly modeled as *data*, not hardcoded logic
(`marketplaceProfile.ts`'s `registerMarketplaceProfile`): keyword count
bounds already differ per marketplace (Etsy: 5-13 vs. Shutterstock: 7-50).
Genuine gaps to add as optional profile fields: file-naming convention,
required file types per marketplace, commercial/editorial designation
support, AI-declaration requirement, and Etsy-specific listing fields
(distinct from the other 4, which are all stock-photo-style) — added as
new optional fields on `MarketplaceProfile`, defaulted per the 5 existing
built-ins, never a required field that would break an existing caller.

## 10. Exact files expected to change

**New files** (illustrative list, finalized during implementation):
`catalog/domain/productionAssetId.ts`, `catalog/domain/duplicateClassification.ts`,
`catalog/quality/qualityClassification.ts` (shared, extracted from the
per-script copy-paste), `catalog/quality/qualitySnapshotStore.ts`,
`catalog/submission/salesRevenue.ts` + `salesRevenueStore.ts`,
`catalog/submission/rejectionIntelligence.ts`,
`catalog/import/marketplaceResultImport.ts` (CSV/Excel),
`catalog/import/historicalPortfolioImport.ts`,
`catalog/submission/submissionPackageBuilder.ts`,
`catalog/commercial/commercialFeedbackEngine.ts`,
`catalog/commercial/productionRecommendations.ts`,
`catalog/queue/productionQueue.ts` + `productionBatch.ts`,
plus one new UI component per new nav view under `components/production/`.

**Modified (additive only)**: `storage/db.ts` (`DB_VERSION` 5→6, new
stores), `catalog/domain/types.ts` (new optional `PortfolioAsset` fields),
`catalog/submission/submissionRecord.ts` (new optional fields, schema
v1→v2), `catalog/submission/submissionStore.ts` (IndexedDB backend +
one-time localStorage migration), `catalog/submission/marketplaceProfile.ts`
(new optional fields on existing 5 profiles), `catalog/backup/backupFormat.ts`
+ `backupBuilder.ts` + `restoreService.ts` (new stores included), `App.tsx`
(new nav views), `docs/USER_GUIDE.md`, `docs/ROADMAP.md`.

**Never modified**: anything under `app/src/engine/`, `app/src/layouts/`,
`app/src/generators/`, `app/src/critic/`, `scripts/qualityReport.ts`'s
scoring logic, or any Build 025 threshold/diagnostic — per the brief's
non-negotiable rules 1-5.

## 11. Expected regression risks

- `DB_VERSION` bump touches the one shared IndexedDB open path — mitigated
  by keeping every new branch idempotent/additive (matching the existing
  convention exactly) and by a dedicated migration test that opens a
  simulated v5 database (via `fake-indexeddb`, already a devDependency)
  and asserts every pre-existing store's data survives the v5→v6 upgrade.
- `SubmissionRecord` schema bump risks breaking any code that constructs a
  literal `SubmissionRecord` object without going through
  `createSubmissionRecord`/`normalizeSubmissionRecord` — mitigated by
  grepping every call site before changing the type and by keeping every
  new field optional with a normalization default.
- Generator/critic code is not touched at all, so no fragmentation/
  determinism/export regression is possible from this build's own changes;
  the 3× full-regression requirement mainly guards against an accidental
  import cycle or shared-utility edit rippling somewhere unexpected.

## 12. Measurable acceptance criteria (from the brief's own PASS bar)

1. `productionAssetId` is stable across copy/rename/restart/preview-
   regeneration (test: compute on a fixture, mutate filename/path only,
   recompute, assert equality).
2. Duplicate classification returns one of the 5 named categories for
   every constructed test fixture pair, matching hand-verified expected
   values.
3. IndexedDB migration test: pre-populate a v5 database, upgrade, assert
   zero data loss on every pre-existing store plus correct creation of
   every new store.
4. Existing localStorage submission records are present in IndexedDB after
   the one-time migration runs, byte-for-byte on every field.
5. CSV/Excel import: valid file imports cleanly with a preview; a
   malformed file produces a clear per-row error report without partial-
   committing; a re-import of the same file is detected as duplicate rows.
6. Rejection reasons normalize to one of the 17 named categories or
   `other`, never silently dropped.
7. Commercial Feedback Engine explicitly refuses to report a confidence
   level above `insufficient-data` below a documented minimum sample size,
   and every recommendation carries a human-readable explanation string.
8. Package builder output includes a manifest whose SHA-256 list matches
   the actual bytes of every included file, verified by an automated test
   that re-hashes the built package and compares.
9. Backup/restore round-trip test: back up a database containing at least
   one record in every new store, restore into an empty database, assert
   full equality.
10. Full regression (`npx vitest run`) passes 3 consecutive times with the
    same test/file counts as Build 025's baseline plus the new test files,
    zero flakes.
11. `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the offline
    standalone build all succeed with zero errors.
12. Generating `luxuryFloral` (or any Build 025 preset) through the running
    app produces byte-identical SVG output to Build 025's own before/after
    evidence for the same seed — proving Rule 1 ("preserve Build 025
    generation behavior") is not just claimed but measured.
