# Changelog

Build-numbered technical changelog for the rendering engine. Distinct
from `docs/USER_GUIDE.md`'s Thai, feature-facing changelog (versioned
`v1.x`, aimed at the app's end users) — this file tracks engine-internal
builds aimed at contributors and reviewers.

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
