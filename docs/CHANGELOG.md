# Changelog

Build-numbered technical changelog for the rendering engine. Distinct
from `docs/USER_GUIDE.md`'s Thai, feature-facing changelog (versioned
`v1.x`, aimed at the app's end users) — this file tracks engine-internal
builds aimed at contributors and reviewers.

---

## Build 015 — Submission Center Foundation (Commercial Workflow)

**Goal**: a production-ready submission management subsystem — planning,
tracking, and validating a pattern's journey toward one or more
marketplaces — built entirely on top of the frozen Collection API and
P3's Backup & Restore system, without modifying either. The first module
in a new "Commercial Workflow" track. Explicitly does **not** perform any
automatic upload to any marketplace.

### Added

All new, under `app/src/catalog/submission/`:

- `submissionStatus.ts` — 8-status state machine (`DRAFT`, `READY`,
  `QUEUED`, `SUBMITTED`, `APPROVED`, `REJECTED`, `NEEDS_REVISION`,
  `ARCHIVED`) with a full transition table and
  `InvalidSubmissionStatusTransitionError` guard.
- `marketplaceProfile.ts` — Marketplace Profiles: 5 built-ins
  (Shutterstock, Adobe Stock, Freepik, Getty Images, Etsy) as plain data,
  plus `registerMarketplaceProfile` for adding future marketplaces at
  runtime with no code change.
- `submissionRecord.ts` — the `SubmissionRecord` domain model
  (submission id, pattern id, marketplace, status, timestamps, version,
  title/description/keyword snapshots, category, notes, append-only
  status history) and its factory.
- `submissionStore.ts` — isolated `localStorage`-backed persistence (no
  IndexedDB schema change, no `DB_VERSION` bump).
- `submissionDuplicateDetection.ts` — 3-rule duplicate detection
  (same-version, already-approved, already-submitted), scoped to
  (pattern, marketplace).
- `submissionValidation.ts` — never-throwing structured readiness report
  gating the `DRAFT -> READY` transition (SVG/preview/title/description/
  keywords/category/no-duplicate).
- `submissionService.ts` — orchestration layer (create, update draft,
  validate, transition, delete) mirroring `collectionService.ts`'s role.
- `submissionQueue.ts`, `submissionHistory.ts`,
  `submissionSearchFilter.ts`, `submissionStatistics.ts` — read-side
  Queue/History/Search+Filter/Statistics modules.
- `index.ts` — public barrel.

98 new tests across 12 files, including a 2,000-record large-dataset
case (`submissionLargeDataset.test.ts`) — see
`docs/submission/SUBMISSION_TEST_REPORT.md` for the full category-by-
category breakdown.

4 new docs: `docs/submission/SUBMISSION_ARCHITECTURE.md`,
`SUBMISSION_WORKFLOW.md`, `SUBMISSION_STATUS.md`, `SUBMISSION_TEST_REPORT.md`.

### Explicitly not done this build

No automatic upload to any marketplace — every "submitted"/"approved"/
"rejected" transition only records the app's own tracking state, per the
brief's explicit constraint. No UI. No modification to the frozen
Collection API or to Backup & Restore. No PR opened, nothing merged.

See `docs/submission/SUBMISSION_ARCHITECTURE.md` (design + decoupling
rationale), `SUBMISSION_STATUS.md` (state machine), `SUBMISSION_WORKFLOW.md`
(end-to-end flow, validation, duplicate detection), and
`SUBMISSION_TEST_REPORT.md` (full test coverage).

---

## Portfolio Manager P3 — Backup & Restore

**Goal**: a complete, self-contained Backup & Restore system for the
certified Collection module (collections + asset membership), built
entirely on top of the frozen Collection API
(`docs/portfolio/COLLECTION_API_FREEZE.md`) without modifying it. No
production defect was found or claimed, so the frozen API constraint was
never triggered. Service-layer only — no UI — mirroring P2 Stage 1's own
foundation-first precedent.

### Added

All new, under `app/src/catalog/backup/`:

- `backupFormat.ts` — the `BackupArchive`/`BackupPayload`/`BackupStats`/
  `BackupMetadata` types, schema version constants, and a structural
  shape guard (`isBackupArchiveShape`).
- `backupCodec.ts` — dependency-free gzip+base64 compression
  (`CompressionStream`/`DecompressionStream`, native Web APIs) and the
  canonical SHA-256 payload checksum, shared by both the build and
  validation sides.
- `backupBuilder.ts` — `buildCollectionBackup`, a read-only full backup
  of every Collection and asset membership via the frozen
  `loadCollections`/`loadPortfolioAssets`.
- `backupValidation.ts` — `validateBackupArchive`, a never-throwing
  pre-restore validation report covering shape, schema version,
  checksum, declared-vs-actual stats, duplicate/orphaned IDs, and an
  optional live-asset cross-check.
- `restoreService.ts` — `previewRestore` (dry-run) and `restoreBackup`
  (`overwrite`/`merge` modes), sharing one internal plan-computation
  function so preview and restore can never disagree. Restore is
  idempotent and self-heals from an interruption between its two
  (intentionally non-cross-atomic) bulk writes, since the plan is always
  recomputed fresh against current live state.
- `backupHistoryStore.ts` — a `localStorage`-backed backup/restore
  activity log (metadata only, never the archive contents), matching
  `workbench/workspaceSettings.ts`'s existing storage convention.
- `backupExportImport.ts` — download/file-picker glue built on the
  existing `downloadBlobFile` helper (`export/svgExporter.ts`).

63 new tests across 6 files (`backupCodec.test.ts`,
`backupBuilder.test.ts`, `backupValidation.test.ts`,
`restoreService.test.ts`, `backupHistoryStore.test.ts`,
`backupExportImport.test.ts`) — see `docs/backup/BACKUP_TEST_REPORT.md`
for the full category-by-category breakdown, including the large-dataset
(5,000-membership) and simulated-interrupted-restore scenarios.

5 new docs: `docs/backup/BACKUP_ARCHITECTURE.md`, `BACKUP_FORMAT.md`,
`RESTORE_WORKFLOW.md`, `BACKUP_TEST_REPORT.md`, `BACKUP_USER_GUIDE.md`.

### Explicitly not done this phase

No UI was built (no button, dialog, or drag-and-drop zone) — service
layer only, per the brief's scope. Commercial Workflow and Marketplace
were not started, per the brief's explicit closing instruction. No PR
was opened and nothing was merged.

See `docs/backup/BACKUP_ARCHITECTURE.md` (design + rationale),
`BACKUP_FORMAT.md` (archive spec), `RESTORE_WORKFLOW.md` (preview/restore
semantics, conflict resolution, interrupted-restore recovery), and
`BACKUP_TEST_REPORT.md` (full test coverage).

---

## Portfolio Manager P2.5 Sprint 4 — Production Certification and Module Freeze

**Goal**: certify the Collection module using the completed evidence
from Sprints 1-3, freeze its public interfaces and performance
baselines, and prepare release documentation — a certification/
documentation stage, not a feature stage. No functional code changed
(the only new production-adjacent file is a test asserting the existing
API surface, not a behavior change).

### Added

- `app/src/catalog/collectionApiFreeze.test.ts` — automated guard test:
  snapshots every runtime export of `domain/collection.ts`,
  `domain/collectionMembership.ts`, `storage/collectionStore.ts`, and
  `services/collectionService.ts` against a frozen list, so a future
  accidental breaking change to the public API fails a test instead of
  going unnoticed.
- `docs/portfolio/COLLECTION_API_FREEZE.md` — the frozen public API
  contract: every export's signature, what "frozen" permits (additive
  changes) versus forbids (silent breaking changes), and how type-only
  exports (interfaces) are guarded since they have no runtime
  representation to test directly.
- `docs/portfolio/COLLECTION_PRODUCTION_BASELINE.md` — consolidates
  Sprint 1's performance baseline, Sprint 2's stress/soak/memory
  results, and Sprint 3's recovery/durability results into one canonical
  reference, with every figure traceable back to where it was
  originally measured (nothing re-run for this sprint).
- `docs/portfolio/COLLECTION_PRODUCTION_CERTIFICATION.md` — the formal
  certification: a criteria checklist (functional correctness,
  performance, durability, recovery, atomicity, API stability, test
  coverage, security) each with a pass/fail and evidence citation, plus
  an explicit, honest "scope of certification" section listing what was
  genuinely NOT tested (multi-tab concurrency, non-Chromium browsers,
  scale beyond LARGE, storage-quota exhaustion, filesystem corruption).
- `docs/portfolio/COLLECTION_RELEASE_NOTES.md` — recommends (does not
  create) the release tag `portfolio-collections-v1.0.0`, with rationale
  and a semver policy for future changes to the frozen API.

### Explicitly not done this sprint

Backup & Restore was not started. CI wiring for the performance baseline
(P2.5-3) was not started. No PR was opened, nothing was merged, no
release tag was created — all deferred pending separate approval per
the Sprint 4 brief.

See `docs/portfolio/COLLECTION_PRODUCTION_CERTIFICATION.md` (certification
decision), `COLLECTION_API_FREEZE.md` (frozen contract),
`COLLECTION_PRODUCTION_BASELINE.md` (consolidated evidence), and
`COLLECTION_RELEASE_NOTES.md` (recommended tag).

---

## Portfolio Manager P2.5 Sprint 3 — Crash Recovery and Data Integrity Certification

**Goal**: certify recovery, durability, and idempotency after simulated
mid-write failures — a validation stage, not a feature stage. No new
user-facing Collection feature, no production Collection architecture
change beyond the one proven-necessary atomicity fix below.

### Added

- `app/src/catalog/validation/recoveryEngine.ts` — a domain-agnostic
  failure-injection engine: 9 distinct failure points (before-
  transaction, during-transaction, aborted-transaction, rejected-promise,
  thrown-exception, after-commit, after-persistence, before-ui-refresh,
  validation-interruption), each a genuinely different mechanism, not a
  relabeling of the same fault. `installFailureInjector` monkey-patches
  `fake-indexeddb`'s `IDBDatabase`/`IDBObjectStore` prototypes
  temporarily (the same "patch a global, patch it back" technique
  Sprint 2's `uiSoak.ts` used for `URL.createObjectURL`) — never touches
  production source. `runRecoveryScenario` orchestrates snapshot → inject
  → attempt → uninstall → snapshot → retry → snapshot for one operation.
- `app/src/catalog/validation/durabilityEngine.ts` —
  `runDurabilityCycles()` repeats a recovery scenario N times (used for
  the required 100-cycle runs) tracking durability and cleanliness per
  cycle; `verifyIdempotentRecovery()` repeats a recovery action and
  verifies the resulting state stops changing.
- `app/scripts/validateRecovery.ts` — CLI wiring all 9 required
  `collectionService.ts` operations (createCollection, renameCollection,
  archiveCollection, unarchiveCollection, deleteCollection, bulkAssign,
  bulkRemove, coverUpdate, metadataUpdate) into the matrix/durability/
  idempotency/consistency/LARGE-dataset modes.
- `app/scripts/browserRecovery.ts` — real-Chromium recovery testing: a
  100-cycle open/mutate/reload/reopen/validate mode, and a crash-
  simulation mode that spawns Chromium directly (bypassing Playwright's
  `launchServer`/`launchPersistentContext`, neither of which can provide
  both a real disk-backed profile and a killable process handle at once),
  connects via `chromium.connectOverCDP`, and sends a real `SIGKILL` to
  the actual OS process before reopening the same on-disk profile in a
  second, independent process.
- 7 `npm run validate:recovery:*` scripts.
- 21 new tests (`recoveryEngine.test.ts`: 15, `durabilityEngine.test.ts`:
  6).

### Fixed (production defect)

- **Bulk-write atomicity gap** across 5 functions —
  `putCollectionRecordsBulk`/`deleteCollectionCascade`
  (`collectionStore.ts`) and `putPortfolioAssetsBulk`/
  `importAssetTransaction`/`deletePortfolioAssetAndFiles`
  (`portfolioStore.ts`). Each issued `.put()`/`.delete()` calls in a loop
  before attaching `oncomplete`/`onerror`/`onabort` handlers — a mid-loop
  synchronous throw rejected the wrapping Promise while leaving
  already-queued writes to silently auto-commit (reproduced: exactly 1
  of 4 writes landing despite the caller observing failure). Fixed by
  attaching handlers before the loop and wrapping the loop in
  `try { ... } catch { t.abort(); }` — behaviorally identical on every
  success path, guarantees true all-or-nothing rollback on the throwing
  path. Found by the failure-injection matrix itself, during this
  sprint's own construction.

### Real runs

81-scenario failure matrix (9 operations × 9 points): 81/81 recovered,
81/81 clean. 900 repeated durability cycles (100 per operation): 900/900
durable and clean. 6-operation idempotency check: 30/30 repeats stable.
Consistency manifest (before/after-failure/after-recovery/after-repeated-
recovery): clean at every transition. LARGE dataset (100k assets/10k
collections/504,544 memberships): 4/4 scenarios recovered, zero new
corruption. Real-browser 100-cycle recovery: 0 failures, 0 page/console
errors. Real-browser 5-trial crash simulation (genuine `SIGKILL` of the
actual OS process, reopened in a second independent process against the
same disk profile): committed writes always survived, the deliberately
uncommitted in-flight write was never partially present, integrity
always clean.

See `docs/portfolio/P2_5_SPRINT3_REPORT.md` (full report),
`P2_5_RECOVERY_REPORT.md` / `P2_5_FAILURE_MATRIX.md` /
`P2_5_DURABILITY_REPORT.md` / `P2_5_CONSISTENCY_REPORT.md` /
`P2_5_BROWSER_RECOVERY.md` (evidence by section), and
`P2_5_SPRINT3_TEST_REPORT.md` (test coverage by category).

---

## Portfolio Manager P2.5 Sprint 2 — Stress and Soak Validation

**Goal**: prove sustained stability, performance consistency, memory
safety, Blob URL cleanup, and IndexedDB data integrity under repeated
large-scale use, using Sprint 1's validation infrastructure — a
validation stage, not a feature stage. No new user-facing Collection
feature, no production Collection architecture change.

### Added

- `app/src/catalog/validation/soakRunner.ts` — exact-count
  (`runStressPlan`) and duration-driven (`runSoak`) operation runners over
  a caller-supplied operation map, seeded deterministic sequencing
  (Fisher-Yates for exact-count, weighted round-robin for duration-driven),
  per-operation success/failure/timeout accounting, periodic memory/Blob-URL
  sampling, and clean cancellation support.
- `app/src/catalog/validation/latencyDrift.ts` — initial/middle/final
  10%-window latency statistics (reusing `benchmarkRunner.ts`'s
  `computeStats`, now exported), stable/warning/failure classification at
  15%/30% median drift, and an independent p95-investigation flag.
- `app/src/catalog/validation/memoryInstrumentation.ts` extended with
  `analyzeMemoryTrend()` — least-squares slope, early/late window means,
  growth/plateau classification.
- `app/src/catalog/validation/consistencyManifest.ts` —
  `captureConsistencySnapshot`/`diffConsistencySnapshots`: before/after
  asset/collection/membership/orphan/stale-cover/duplicate-collectionId
  counts and an expected-vs-unexplained mutation diff.
- `app/src/catalog/validation/sprint1Baseline.ts` /
  `baselineCompare.ts` — the committed, read-only Sprint 1 baseline
  fixture and a batch comparison tool reusing Sprint 1's unmodified
  `compareToBaseline` policy, extended with
  `SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME` (see "Fixed" below).
- `app/scripts/validateCollectionsStress.ts` — new CLI script (separate
  from Sprint 1's `validateCollections.ts`) with `stress`/`soak-smoke`/
  `soak-30m`/`soak-60m`/`baseline-compare` modes.
- `app/scripts/uiSoak.ts` — real-browser (Playwright/Chromium) UI soak:
  seeds a real browser IndexedDB via raw `indexedDB` calls, instruments
  `URL.createObjectURL`/`revokeObjectURL`, drives 100 real UI interaction
  cycles against a bounded (≥1,000-member) collection.
- 6 new `npm run validate:collections:*` scripts (`stress`, `soak:smoke`,
  `soak:30m`, `soak:60m`, `baseline-compare`, `ui-soak`).
- 46 new tests across 5 files (see `P2_5_SPRINT2_TEST_REPORT.md`).

### Real measurements

- **LARGE stress** (100k assets/10k collections, exact-count plan): 710
  operations, **0 failures, 0 timeouts**, 0 unexplained consistency
  mismatches, every latency-drift-eligible operation stable, 4 of 5
  baseline comparisons improved.
- **5-minute smoke soak** (MEDIUM dataset): 4,018 cycles, 0 failures.
  Latency drift classifies `failure` for every operation — investigated
  and attributed to short-duration/high-throughput heap warm-up, not a
  production defect (see `P2_5_LATENCY_DRIFT.md`).
- **30-minute standard soak** (LARGE dataset): 2,589 cycles, 0 failures,
  every operation's latency drift **stable**.
- **60-minute extended soak** (LARGE dataset): see
  `P2_5_SPRINT2_REPORT.md`/`P2_5_SOAK_REPORT.md` for the result.
- **UI soak** (real Chromium): 100/100 cycles, 0 page errors, 0 console
  errors, 0 outstanding Blob URLs, stable DOM size.

### Fixed

- **P2.5-6** (validation-tool defect, not production): the CLI's
  Sprint1-baseline comparison mapped Sprint 2's `searchCollections`
  operation onto Sprint 1's `search-collection-filter` baseline entry —
  which actually measured a different operation
  (`searchPortfolioAssets`, not `searchCollectionsByName`). This produced
  a false ~559% "regression." Fixed by extracting
  `SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME` (`baselineCompare.ts`),
  which deliberately has no entry for `searchCollections`; added 3
  regression tests. See `P2_5_BASELINE_COMPARISON.md`.

### Not changed

`domain/collection.ts`, `domain/collectionMembership.ts`,
`storage/collectionStore.ts`, `storage/portfolioStore.ts`,
`services/collectionService.ts`, `storage/db.ts` (`DB_VERSION` stays 5),
and every existing Collection UI component are all byte-for-byte
unchanged. See `docs/portfolio/P2_5_SPRINT2_REPORT.md`.

---

## Portfolio Manager P2.5 Sprint 1 — Collection Validation Infrastructure

**Goal**: build reusable, deterministic validation-engineering
infrastructure (dataset generator, benchmark runner, integrity scenarios,
memory instrumentation, baseline policy) for later scalability/integrity/
performance/reliability certification — not a new user-facing Collection
feature, and not the certification pass itself.

### Added

- `app/src/catalog/validation/` (new module, 12 files + tests):
  `datasetGenerator.ts`/`datasetPresets.ts`/`deterministicIds.ts`/`types.ts`
  — deterministic SMALL (1,000 assets/100 collections)/MEDIUM (10,000/
  1,000)/LARGE (100,000/10,000) dataset generation with a real dataset
  manifest; `validationDb.ts` — real IndexedDB persistence via the
  existing bulk storage APIs, gated by an explicit confirmation flag;
  `benchmarkRunner.ts`/`benchmarkReport.ts` — warm-up/measured
  iterations, real statistics (mean/median/p95/p99/stddev/ops-per-sec),
  console/JSON/Markdown output; `integrityScenarios.ts` — 8 named
  scenarios (valid, orphaned membership, duplicate collectionId, stale
  cover, empty collection, archived collection, high-membership asset,
  high-member collection) built on Stage 1's existing
  `validateCollectionIntegrity`/repair functions, never a competing
  integrity engine; `memoryInstrumentation.ts` — a memory-sampling
  adapter (Node/browser/unsupported) and a Blob-URL lifecycle tracker;
  `baselinePolicy.ts` — regression-threshold comparison (15%
  warning/30% failure) and a baseline schema.
- `app/scripts/validateCollections.ts` — CLI entry point wiring all of
  the above together (`default`/`small`/`medium`/`large`/`integrity`/
  `benchmark`/`memory-smoke` modes).
- `npm run validate:collections*` scripts (7 total) in `app/package.json`.
- A bounded memory smoke test
  (`components/portfolio/../../catalog/validation/memorySmoke.test.tsx`)
  mounting/unmounting the real `CollectionDetailPanel` 5 times and
  proving every created Blob object URL is revoked.
- 89 new tests across 9 files (see `P2_5_SPRINT1_TEST_REPORT.md`).
- New devDependency: `tsx` (runs the CLI's TypeScript directly — never
  bundled into the shipped app).

### Not changed

`domain/collection.ts`, `domain/collectionMembership.ts`,
`storage/collectionStore.ts`, `storage/portfolioStore.ts`,
`services/collectionService.ts`, `storage/db.ts` (`DB_VERSION` stays 5),
and every existing Collection UI component are all byte-for-byte
unchanged. See `docs/build_reports/P2_5_SPRINT1_REPORT.md` and
`docs/portfolio/P2_5_VALIDATION_ARCHITECTURE.md`.

---

## Portfolio Manager P2 Stage 2 — Collection UI and UX

**Goal**: build the UI layer on top of P2 Stage 1's Collection domain/
storage/service foundation — browsing, creating, renaming, archiving,
deleting collections, assigning/removing assets (single and bulk), an
asset-library collection filter, and an integrity scan/repair panel.

### Added

- `components/portfolio/CollectionsView.tsx` — Collections tab container
  (All/Active/Archived/Integrity sub-navigation, owns the selected
  collection).
- `components/portfolio/CollectionList.tsx` / `CollectionCard.tsx` —
  searchable/sortable collection grid.
- `components/portfolio/CreateCollectionDialog.tsx` — create-collection
  modal.
- `components/portfolio/CollectionDetailPanel.tsx` — rename/description
  (inline edit), cover set/clear, archive/unarchive, two-step delete
  confirmation, paginated member grid with bulk remove-from-collection.
- `components/portfolio/CollectionAssignmentDialog.tsx` — single
  component reused for single-asset and bulk assign/remove, rendering
  the `BulkMembershipResult` summary.
- `components/portfolio/CollectionIntegrityPanel.tsx` — scan (read-only)
  + explicit repair (orphaned `collectionIds`, stale `coverAssetId`).
- `components/portfolio/BulkActionBar.tsx` — appears above the asset
  grid once assets are multi-selected.
- `components/portfolio/useCollectionCoverUrl.ts` — Blob-URL hook for
  collection covers (asset-id -> preview-file resolution), mirrors
  `usePreviewUrl.ts`'s lifecycle.

### Changed (additive only — no existing signature altered)

- `catalog/domain/search.ts`: `PortfolioFilterQuery` gained
  `collectionId`/`collectionMembership` (optional), plus matching
  `.filter()` clauses and `describeActiveFilters` entries.
- `components/portfolio/PortfolioManagerView.tsx`: new Assets/Collections
  tab, owns collections state and every collection-mutation handler (all
  calling `catalog/services/collectionService.ts`, never IndexedDB
  directly); added a "quiet" refresh path (`refreshAssetsQuietly`/
  `refreshCollectionsQuietly`) so collection mutations no longer flash
  the full-page loading state and unmount open dialogs.
- `components/portfolio/PortfolioSidebar.tsx`: new "คอลเลกชัน" filter
  group (assets in a specific collection / any collection / no
  collection).
- `components/portfolio/PortfolioGrid.tsx` / `PortfolioThumbnail.tsx`:
  optional multi-select checkbox props, wired to `BulkActionBar`.
- `components/portfolio/PortfolioDetailPanel.tsx`: new "คอลเลกชัน" section
  (view/assign/remove membership for the open asset).

No domain/storage/service code from Stage 1 changed. `storage/db.ts`'s
`DB_VERSION` stays at 5.

### Tests

62 new tests across 11 new files + 1 extended (`search.test.ts`). Full
existing suite re-run alongside to confirm zero regressions (one
pre-existing, unrelated flake — see
`docs/build_reports/P2_STAGE2_REPORT.md`). See
`docs/portfolio/P2_STAGE2_TEST_REPORT.md`.

### Documentation

`docs/portfolio/P2_STAGE2_UI_ARCHITECTURE.md`, `P2_STAGE2_TEST_REPORT.md`,
`P2_STAGE2_ACCESSIBILITY.md`, `P2_STAGE2_PERFORMANCE.md`,
`P2_STAGE2_BROWSER_VERIFICATION.md` (all new),
`docs/build_reports/P2_STAGE2_REPORT.md` (new), `TECHNICAL_DEBT_REGISTER.md`
(updated), `docs/ROADMAP.md` (appended), plus `docs/USER_GUIDE.md` Thai
changelog (v1.66).

---

## Build 001 — Composition Intelligence Foundation V2

**Goal**: dramatically improve generated-pattern visual quality (target:
6-8/10 -> 8-9/10) without adding new features, panels, or generators.

### Added

- `src/engine/patternPhysics.ts` (new module) — `applyAttraction`, a
  deterministic role-based attraction pass (Section 8, Pattern Physics).
- `engine/hierarchy.ts`: `ROLE_IMPORTANCE`, `ROLE_LAYER_PRIORITY`,
  `sortByLayerPriority`, `REGULAR_LATTICE_LAYOUTS`.
- `engine/compositionIntelligence.ts`: `applyGridBalanceCorrection`
  (generalizes the old quadrant-only balance correction),
  `applyNegativeSpaceCorrection`, `applyFlowBias`, 4 new optional
  `CompositionIntelligenceParams` fields.
- `critic/visualAnalysis.ts`: `detectFragmentedSilhouette` — the 11th
  Design Critic visual-analysis detector (Section 9, Silhouette Check).
- `critic/artDirection.ts`: `fragmentedSilhouette` recommendation rule.

### Changed

- `engine/tile.ts`: applies `sortByLayerPriority` before SVG assembly
  (hero now always paints on top); strips the new V2 Composition
  Intelligence fields for `REGULAR_LATTICE_LAYOUTS`.
- `engine/styleDna.ts`: `resolveStyleDna` now wires `clusterStyle`/
  `clusterDensity`/`flowProfile` into real `attractionStrength`/
  `flowBiasStrength`/`negativeSpaceStrength` values; corrected a stale
  module comment describing the Cluster Engine as not yet existing.
- `engine/designModel.ts`: `normalizeParams` clamps the 4 new
  `compositionIntelligence` fields.
- `DEFAULT_COMPOSITION_INTELLIGENCE` now includes non-zero defaults for
  `attractionStrength`, `negativeSpaceStrength`, `flowProfile`
  (`'directional'`), and `flowBiasStrength` — every new "Generate" now
  produces measurably different (see `docs/PERFORMANCE.md`), intentionally
  improved output for every non-Regular-Lattice layout. Patterns saved
  before this build (with their own literal `compositionIntelligence`
  object recorded, lacking these fields) are completely unaffected —
  confirmed via `tile.test.ts`'s backward-compatibility tests.

### Fixed

- A real, previously-latent paint-order bug: a hierarchy-tagged hero motif
  could be drawn (and therefore visually buried) underneath a
  later-generated secondary/filler motif at an overlap point, undercutting
  the Hierarchy Engine's own `heroScale` boost.
- `engine/compositionIntelligence.ts`'s private `shortestOffset` helper
  duplicated `engine/svgGeometry.ts`'s already-exported `periodicOffset` —
  removed the duplicate, now imports and reuses the canonical one.

### Tests

~48 new tests across `engine/hierarchy.test.ts`,
`engine/patternPhysics.test.ts` (new file),
`engine/compositionIntelligence.test.ts`, `engine/designModel.test.ts`,
`engine/styleDna.test.ts`, `engine/tile.test.ts`,
`critic/visualAnalysis.test.ts`, `critic/artDirection.test.ts`. Full
project suite: 127 files / 1510 tests passing.

### Documentation

`app/COMPOSITION_ENGINE_V2.md` (new developer doc),
`docs/BUILD_REPORT.md`, `docs/DESIGN_DECISIONS.md`,
`docs/KNOWN_ISSUES.md`, `docs/PERFORMANCE.md`, `docs/ROADMAP.md` (all
new), plus `app/README.md` summary section and
`docs/USER_GUIDE.md` Thai changelog (v1.48).

---

## Build 001.1 -- Composition Quality Refinement

**Goal**: a quality refinement build against Build 001's own measured
weaknesses (not a new-feature build) -- Commercial Quality ~8.2/10 -> 9.0+.

### Added

- `engine/patternReadability.ts` (new module) -- `computePatternReadability`
  (Section 6): thumbnail-200px/400px legibility and 800%-zoom scores.
- `critic/commercialValidation.ts` (new module) -- `evaluateCommercialValidation`
  (Section 7): `commercialScore`, `commercialReadiness`, `premiumFeeling`,
  `luxuryFeeling`, `editorialFeeling`, `wallpaperScore`, `fabricScore`,
  `giftWrapScore`.
- `engine/scoring.ts`: `computeHeroVisibilityScore` (Section 5).
- `critic/visualAnalysis.ts`: 3 new detectors -- `lowHeroVisibility`,
  `weakHierarchy`, `tooManyFillers` (Sections 5/9).
- `critic/artDirection.ts`: 3 new rules -- `weakHierarchy` -> Increase
  Hero Scale, `tooManyFillers` -> Reduce Fillers (real `fillerRatio`
  patch), `lowHeroVisibility` -> Increase Hero Contrast (advisory).
- `engine/heroComplexity.ts`: `buildDecorativeDots`, `buildAccentArc` (2
  new hero-only detail-overlay primitives, Section 1); `densityDamping`
  (instance-count-aware throttle, see Fixed below).
- `engine/clusterEngine.ts`-backed per-hero clusters in `layouts/heroFlow.ts`,
  `layouts/heroScatter.ts`, `layouts/densePremium.ts` (Section 2).
- `docs/COMMERCIAL_TARGET.md` (new -- Section 10 business KPI doc).

### Changed

- `engine/compositionIntelligence.ts`: `applyNegativeSpaceCorrection`'s
  grid resolution changed from 4x4 to 8x8, matching
  `engine/scoring.ts`'s `largestEmptyRegion`/`deadSpace` detector grid --
  the real root-cause fix for Build 001's Known Issue #1 (see Design
  Decisions).
- `critic/artDirection.ts`: `weakFlow`'s recommendation id/label renamed
  `improveFlow`/"Improve Flow" -> `increaseFlowBias`/"Increase Flow Bias"
  (Section 9's own naming).
- `critic/designReport.ts`: `DesignReport` gained 2 new fields --
  `readability` (Section 6) and `commercialValidation` (Section 7).
  `RECOMMENDATION_DIMENSION` extended for the 3 new recommendation ids.
- `engine/tile.ts`: passes `instanceCount` into `applyHeroDetailOverlay`
  so the new density-damping throttle has real data to act on.

### Fixed

- Build 001's Known Issue #1 (Negative Space Correction / Pattern Physics
  interaction): root-caused to a grid-resolution mismatch, not a pass-
  ordering problem -- 2 reordering variants were tried and empirically
  rejected (see Design Decisions) before the actual fix was found.
- A real regression introduced mid-build by Section 1's own new overlay
  primitives: their added SVG-node cost pushed one already-marginal real
  scenario (a 1024-instance grid spec at 7906/8000 of the hard node
  budget) over the hard-reject threshold. Fixed with `densityDamping`
  rather than shrinking the new primitives into visual insignificance.

### Tests

~30 new tests across `engine/patternReadability.test.ts` (new file),
`critic/commercialValidation.test.ts` (new file), `critic/artDirection.test.ts`,
`critic/visualAnalysis.test.ts`, `critic/designReport.test.ts`. Full
project suite: 129 files / 1524 tests passing.

### Documentation

`docs/BUILD_REPORT.md`, `docs/DESIGN_DECISIONS.md`, `docs/KNOWN_ISSUES.md`,
`docs/PERFORMANCE.md`, `docs/ROADMAP.md` (all appended),
`docs/COMMERCIAL_TARGET.md` (new), plus `docs/USER_GUIDE.md` Thai
changelog (v1.49).

---

## Portfolio Manager P1 — Core Database and Asset Library

**Goal**: a new offline asset catalog — import, store, browse, search,
inspect, and safely remove stock-vector source files (SVG/PNG/JSON/EPS/AI/
JPG) without modifying or degrading the originals. A separate product
track from the composition-quality builds above (0xx-014); does not touch
the Generator, the evaluation/scoring engine, or any existing storage
format.

### Added

- `src/catalog/domain/` — `types.ts` (`PortfolioAsset`, `PortfolioFileRecord`,
  `WorkflowStatus` orthogonal to archiving), `id.ts` (`VSP-YYYYMMDD-XXXXXX`
  asset IDs), `hash.ts` (SHA-256 via `crypto.subtle`), `asset.ts`
  (factory/normalize/validate), `search.ts` (filter/sort/describe).
- `src/catalog/storage/portfolioStore.ts` — IndexedDB-only persistence
  (no localStorage fallback, deliberately — see architecture doc), atomic
  multi-store import/delete transactions.
- `src/catalog/import/` — `fileValidation.ts`, `basenameGrouping.ts`,
  `previewSelection.ts`, `jsonCompat.ts` (tolerant multi-shape JSON
  metadata extraction), `duplicates.ts` (multi-signal duplicate
  detection), `importPipeline.ts` (orchestrator).
- `src/catalog/services/` — `dashboard.ts`, `healthCheck.ts` (read-only
  data-integrity report), `exportAsset.ts` (per-asset ZIP export with
  hash-integrity verification, reuses `export/zip.ts`).
- `src/components/portfolio/` — `PortfolioManagerView.tsx` + `PortfolioSidebar.tsx`
  / `PortfolioGrid.tsx` / `PortfolioThumbnail.tsx` / `PortfolioDetailPanel.tsx`
  / `PortfolioImportPanel.tsx` / `PortfolioHealthCheckPanel.tsx` /
  `usePreviewUrl.ts`, wired into `App.tsx`/`ProjectBar.tsx` as a new
  `🗂 Portfolio Manager` top-level view.
- `storage/db.ts`: `DB_VERSION` 3 → 4, adds `portfolioAssets` and
  `portfolioFiles` object stores to the existing shared `onupgradeneeded`
  handler.
- `fake-indexeddb` devDependency — gives the vitest/jsdom test environment
  a real IndexedDB implementation for `catalog/storage/*.test.ts`.

### Tests

110 new tests across 16 files (`catalog/domain`, `catalog/import`,
`catalog/storage`, `catalog/services`, `components/portfolio`), including
a 1,000+/1,200-record performance suite for search/filter/sort and grid
pagination. Full existing suite re-run alongside to confirm zero
regressions. See `docs/portfolio/PORTFOLIO_MANAGER_P1_TEST_REPORT.md`.

### Documentation

`docs/portfolio/PORTFOLIO_MANAGER_ARCHITECTURE.md`,
`PORTFOLIO_MANAGER_DATA_MODEL.md`, `PORTFOLIO_MANAGER_STORAGE.md`,
`PORTFOLIO_MANAGER_IMPORT_SPEC.md`, `PORTFOLIO_MANAGER_P1_TEST_REPORT.md`
(all new), `docs/build_reports/PORTFOLIO_MANAGER_P1_REPORT.md` (new),
`docs/ROADMAP.md` (appended), plus `docs/USER_GUIDE.md` Thai feature
section + changelog (v1.64).

---

## Portfolio Manager P2 Stage 1 — Collection Domain and Data Foundation

**Goal**: build the `Collection` entity, its persistence, and the
business-logic (service) layer for many-to-many asset<->collection
membership — domain/storage/services layers only, **no UI** (explicitly
out of scope for this stage; the natural Stage 2).

### Added

- `src/catalog/domain/collection.ts` — `Collection` type, `createCollection`,
  `normalizeCollection`, name validation/normalization, `isValidCollection`.
- `src/catalog/domain/collectionMembership.ts` — pure
  add/remove/dedupe/repair helpers for `PortfolioAsset.collectionIds`.
- `src/catalog/storage/collectionStore.ts` — IndexedDB repository for the
  new `collections` object store: CRUD, search-by-name, count, the
  atomic `deleteCollectionCascade` (collection delete + membership
  cleanup in one transaction), bulk write.
- `src/catalog/services/collectionService.ts` — CRUD (create/rename/
  update description/archive/unarchive/delete-safely/set-cover-asset),
  single and bulk membership assign/remove (structured
  `BulkMembershipResult`), queries (`getAssetsForCollection`/
  `getCollectionsForAsset`), and integrity validation + repair
  (`validateCollectionIntegrity`, `repairOrphanedCollectionIds`,
  `repairCoverAssetIntegrity`).
- `domain/id.ts`: `generateCollectionId`/`isValidCollectionId`
  (`COL-YYYYMMDD-XXXXXX`, same shape as `generateAssetId`).

### Changed (additive only — no existing signature altered)

- `storage/db.ts`: `DB_VERSION` 4 → 5, adds the `collections` object
  store (indexed by `normalizedName`, `isArchived`) to the existing
  shared `onupgradeneeded` handler.
- `catalog/storage/portfolioStore.ts`: one new additive function,
  `putPortfolioAssetsBulk` — atomic multi-record write, used by
  `collectionService`'s bulk operations for both atomicity and
  performance.

### Tests

102 new tests across 6 files (domain, repository, migration, service,
performance). Full existing suite re-run alongside to confirm zero
regressions. See `docs/portfolio/P2_STAGE1_TEST_REPORT.md`.

### Documentation

`docs/architecture/ADR-001` through `ADR-005` (001-004 retrospective for
P1 decisions, 005 new for this stage's collection-relationship design),
`docs/portfolio/COLLECTION_ARCHITECTURE.md`, `COLLECTION_DATA_MODEL.md`,
`P2_STAGE1_TEST_REPORT.md`, `P2_STAGE1_PERFORMANCE.md`,
`TECHNICAL_DEBT_REGISTER.md` (all new), `docs/build_reports/P2_STAGE1_REPORT.md`
(new), `docs/ROADMAP.md` (appended), plus `docs/USER_GUIDE.md` Thai
changelog (v1.65 — explicitly notes no new UI this version).
