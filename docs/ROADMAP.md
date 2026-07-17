# Roadmap

Build-numbered, forward-looking. Each entry is either shipped
(`docs/CHANGELOG.md` has the details) or proposed. This file records
*what's next and why*, not what already happened.

---

## Shipped

- **Build 001 — Composition Intelligence Foundation V2**: Pattern
  Physics, real Flow-driven placement, finer-grained Negative Space
  correction, Layer Priority paint-order fix, Silhouette Check. See
  `docs/BUILD_REPORT.md`.
- **Build 001.1 — Composition Quality Refinement**: Known Issue #1 root-
  caused and fixed (grid-resolution mismatch), Hero Complexity Engine's 2
  new primitives + density-aware throttle, Semantic Cluster V2 for
  heroFlow/heroScatter/densePremium, Hero Visibility Score, Pattern
  Readability (thumbnail/zoom), Commercial Validation (8 named scores),
  100-pattern Visual Portfolio Review, 3 new Design Critic recommendation
  rules. See `docs/BUILD_REPORT.md`.
- **Build 002 — Composition Quality V3**: Palette/Color Intelligence
  redesign, Thumbnail Hero Legibility, Scale Diversity fix, Semantic
  Cluster coverage to 9/14 layouts, Design Critic calibration, Product
  Targeting, Commercial Score integrity split, a 2nd Flow architecture,
  SVG safety margin. See `docs/build_reports/BUILD_002_REPORT.md`.
- **Build 003 — Composition Intelligence V4**: Composition Zone Engine,
  Rotation Angle Families, Rhythm Density Bands, Hero-Hero Repulsion,
  hero-size-aware negative space, Style Grammar zone preferences, Hero
  Detector regenerate-on-failure, Pattern Beauty Score, Portfolio Variety
  tracking. See `docs/build_reports/BUILD_003_REPORT.md`.
- **Build 004 — Botanical DNA Engine**: real Botanical Family taxonomy (12
  families), Botanical Cluster Generator archetypes, Leaf Intelligence,
  cluster-level Stem Engine, Natural Rotation Engine, Premium Hero
  Builder, Style DNA botanical grammar, Botanical Beauty Metrics V2,
  Portfolio Diversity Engine V2. See `docs/build_reports/BUILD_004_REPORT.md`.
- **Build 005 — Design Knowledge Engine**: Design Knowledge/Rule Engine
  (per-style design language → generation rules), Premium SVG
  Illustration Engine (Petal/Calyx Generators, petal asymmetry), Botanical
  Species Engine (18 species incl. Rose/Protea/Tropical Leaf),
  Illustration Family Engine, Designer Brain (weighted preferred-list
  picks), Premium Detail System, Commercial Knowledge architecture
  (product-target metadata per style). See
  `docs/build_reports/BUILD_005_REPORT.md`.
- **Build 006 — Commercial Art Director Engine**: Commercial Style
  Analysis Engine (10 real benchmark bands), Luxury Bouquet Composer
  (companion-foliage sprig + visual-weight balancing), Natural Botanical
  Relationships (real per-species companion pairing + Baby's Breath, 19th
  species), Commercial Color Story Engine (8 named professional color
  stories), Negative Space Designer (per-product-target spacing),
  Luxury Repetition Engine (hero-bouquet mirroring), Premium SVG Detail
  (Flower Center Generator), Commercial Pattern Critic (8 named
  commercial-feeling dimensions), 300-pattern Large Portfolio Evaluation.
  See `docs/build_reports/BUILD_006_REPORT.md`.
- **Build 007 — Master Botanical Illustration Engine**: Flower Anatomy
  Engine (real per-species sepal/filament/bloom-stage data, two-tier
  petal hierarchy replacing the generic single-ring bloom), Leaf Anatomy
  Engine (real per-species ovate/serrated + pinnate-vein leaves in the
  premium hero, closing the gap where hero foliage was less detailed than
  ordinary filler leaves), Premium Bouquet Designer refinements (real
  filler-flower-vs-berry choice from the companion's own botanical role),
  Botanical Gesture Engine (seeded foliage-base lean), Petal Variation
  Library (6 named petal silhouettes), Luxury Detailing (berry highlight
  caps), Commercial Composition Review (`buildTileWithCommercialRetry`,
  botanical-category regenerate-on-failure using the real Pattern Beauty
  Score composite), Illustration Quality Score V2 (bouquet/gesture/leaf/
  flower realism + premium feel, all measured from real SVG structure).
  See `docs/build_reports/BUILD_007_REPORT.md`.
- **Build 008A — Knowledge Infrastructure (Project Orchid)**: a real,
  reusable Knowledge Registry (load/validate/cache/version/diagnostics)
  future builds can add a domain to, proved by migrating Style DNA's 15
  built-in presets off a hardcoded object literal onto real, editable,
  schema-validated JSON files — zero generation-output change (verified
  by a dedicated compatibility test suite). See
  `docs/build_reports/BUILD_008A_REPORT.md`.
- **Build 008B — Commercial Botanical Species Engine**: the Botanical
  Species table (19 species) migrated through the same Knowledge Registry
  pattern, redesigned (not just moved) into a real commercial record —
  botanical family/bloom/petal/leaf structure, premium/elegance/
  commercial-popularity scores, a strength-weighted companion matrix,
  usage-profile tags. Every one of those fields is real, wired generation
  logic: a genuine Filler-Leaf/Filler-Flower/Berry choice from the
  companion's typed role, a premium-score-driven visual-weight cap, a
  5-archetype internal hero-silhouette roll (was always circular before),
  a usage-profile/product-target species fallback. Measured against the
  Build 007 baseline: every score within normal variance or a real
  improvement (Leaf Realism +2.6, Premium Feel +1.0), zero regressions,
  zero node-budget failures across 430 measured patterns. See
  `docs/build_reports/BUILD_008B_REPORT.md`.
- **Build 009 — Commercial Art Director Engine**: Visual Hierarchy Engine
  V2 (`promoteSecondaryHero` + `computeVisualHierarchyScore`), Eye Flow
  Engine (6 named placement-level bias paths, additive third mechanism
  alongside `FlowProfile`/`CompositionZone`), Negative Space Designer V2
  (per-product spacing/rhythm/cluster-looseness strategy), Hero Framing
  Engine (`applyHeroFraming` push-away + bouquet angular framing),
  Natural Asymmetry Engine (`applyControlledAsymmetry`), Silhouette
  Optimization (`computeHeroArchetypeDiversity`, threads Build 008B's
  hero-archetype roll through `TileData`), Luxury Composition Rules
  (7-dimension `engine/luxuryComposition.ts`), Product-aware Composition
  (`resolveCompositionZoneForProduct`). Every mechanism opt-in/additive,
  verified byte-identical-by-default via no-op tests. Measured against
  the Build 008B baseline: zero regressions across the 30/100/300-pattern
  portfolio (aggregate scores moved <0.5 points — expected, since the
  frozen harness never sets `productTarget` and several mechanisms are
  deliberately subtle by design; a supplementary spot-check confirmed
  every mechanism is really wired end to end). See
  `docs/build_reports/BUILD_009_REPORT.md`.

- **Build 010 — Signature Composition & Commercial Story Engine**:
  Signature Bouquet Composer (`applyGatherPoint` convergence toward the
  hero's own stem base), Visual Story Flow Engine (role-weighted Eye Flow
  pull), Multi-layer Depth Engine (EPS-safe solid-color recede cue),
  Botanical Relationship Engine V2 (real per-companion spatial habit —
  trailing/nesting/climbing), Premium Rhythm Engine (hierarchy-level
  size cadence), Professional Illustrator Rules (rule of odds, tangent-
  avoidance margin), Product-aware Composition Engine (depth/rhythm/rules
  product fallbacks), Signature Style Engine (per-preset fingerprint
  derived from existing `hierarchyPreset`/`premiumHero` fields),
  Commercial Validation Suite (`computeSignatureFingerprintDistinctness`).
  Every mechanism opt-in/additive, verified byte-identical-by-default via
  no-op tests. Measured against the Build 009 baseline across a new
  500-pattern XL Portfolio (plus the existing 30/100-pattern suites):
  zero regressions, zero node-budget failures across 630 measured
  patterns; one honestly-reported trade-off (the "rule of odds" targets
  the non-hero member count, so the hero-inclusive cluster size is always
  even, not odd — see the report for the low-cost fix). See
  `docs/build_reports/BUILD_010_REPORT.md`.

- **Build 011 — Artistic Intelligence Engine**: Artistic Balance Engine
  (`computePerceivedWeight` — perceived visual mass × detail density ×
  color dominance, replacing plain scale×role weight in balance/negative-
  space correction), Luxury Negative Space Engine
  (`resolveArtisticBalanceForProduct`/`resolveLayoutArchetypeForProduct`
  per product), Color Harmony Intelligence (`computeDominantAccentIndex`
  drives the Color Story's dominant pick, universal across every Style DNA
  preset), Editorial Layout Intelligence (`resolveLayoutArchetypeForProduct`,
  shipped as a standalone tested utility — see the report for the honest
  scoping trade-off), Silhouette Intelligence (`heroArchetype` reaches the
  previously-dead-code Premium Hero override + a 9th portfolio diversity
  dimension), Premium Detail Distribution (`detailDistribution` gives
  filler a small nonzero detail level instead of a flat 0), Commercial
  Trend Engine (3 new `TREND_PRESETS` + `StyleDna.trendPresetId`
  cross-references), Portfolio Consistency Engine
  (`computePortfolioConsistency` + `detectSequentialStyleDrift`, new), and
  Commercial Appeal Score V2 (`computeCommercialAppealScoreV2`, a new
  module combining all 6 brief-named dimensions from existing sub-scores).
  Every mechanism opt-in/additive, verified byte-identical-by-default via
  no-op tests. Measured against the Build 010 baseline: the 30-scenario
  suite is byte-identical, the 100/500-pattern portfolios move under 0.5
  points on every metric (documented cause: `colorHarmonyBias` becoming
  universally active in Style DNA resolution shifts the RNG-consumption
  shape by one draw), zero node-budget failures. A new 1000-pattern
  Consistency Portfolio measured every preset at 72-87/100 Portfolio
  Consistency (mean 79) with zero presets showing detected sequential
  style drift. See `docs/build_reports/BUILD_011_REPORT.md`.

- **Build 011.5 — Commercial Reality Check**: evidence-driven commercial
  audit (no generation-engine changes) — 1,500-pattern portfolio (100 seeds
  x 15 presets), full art-director-style dimension mapping, competitor
  comparison, and a single, precisely-scoped Build 012 recommendation.
  Headline finding: 3 presets (Minimal Botanical, Boutique Packaging,
  Premium Textile) scored 31-44 mean Absolute Commercial Quality (92-100%
  failure rate) despite rendering legitimately well — root-caused to a
  layout-scoring integrity bug (regular-lattice layouts' own deliberate
  even spacing/axis alignment triggering soft penalty rules designed for
  organic layouts). See `docs/build_reports/BUILD_011_5_REPORT.md`.

- **Build 012 — Evaluation Intelligence Engine V3**: fixed Build 011.5's
  own diagnosed bug. New layout-aware (`engine/layoutEvaluation.ts`),
  style-aware (`engine/styleEvaluation.ts`), and product-aware
  (3 new `ProductUseId`s — Greeting Card/Poster/Canvas) evaluation context;
  Penalty System V2 (`engine/penaltyRulesV2.ts`) gates 8 of the original 18
  soft-penalty rules to organic-layout-only applicability, each with a
  documented `reason`/`confidence` derived from measured bias data (not
  tuned by feel); Commercial Judge V2 (`critic/commercialJudgeV2.ts`) and
  a full explainability trace (`engine/scoringV2.ts`). Wired into the live
  "Generate Best" candidate ranking and the Trend Studio quality gate (the
  latter was a real live bug — lattice-layout patterns could be wrongly
  blocked from export/SEO/collection generation). Measured against the
  same 4 frozen tiers Build 011/011.5 established: all 3 target presets
  recover to 77-80 mean (0% failure, from 31-44/92-100%), the 2 mixed-
  layout presets recover to 83-85 (0% failure, from 65-70/34-46%), and
  every one of the other 10 already-healthy presets scores byte-identically
  (delta = 0) before and after — direct proof of a bias fix, not score
  inflation. See `docs/build_reports/BUILD_012_REPORT.md`.

- **Build 013 — Portfolio Intelligence & Self-Improvement Engine**: a
  read-only analysis layer (`src/portfolio/`) built on top of Build 012's
  now-trustworthy evaluator — no new generation, no scoring changes, no
  score inflation. Generated a genuinely uncurated 5,000-pattern portfolio
  (334/333 per preset, deterministic `p13-<styleId>-<n>` seeds, checkpoint/
  resume every 500 patterns), then computed: multi-signal ranking and
  percentiles (`ranking.ts`), evidence-based success/failure trait discovery
  with real lift and confidence (`successFailure.ts`), bucketed near-
  duplicate detection (`fingerprint.ts`/`duplicates.ts` — 0 exact/
  deterministic duplicates, 1 near-duplicate across all 5,000), segment
  clustering by declared preset/layout-class/measured-score band
  (`clustering.ts`), and a single evidence-driven Build 014 recommendation
  (`recommendations.ts`). Confirmed Build 012's fix held at scale: the 3
  previously-broken presets (Minimal Botanical 77.1, Premium Textile 80.4,
  Boutique Packaging 78.8 mean Absolute Commercial Quality) now sit inside
  the healthy 75-88 range alongside all 12 other presets — no preset
  requires special-casing. See `docs/build_reports/BUILD_013_REPORT.md`.

- **Build 014 — Motif Relationship Intelligence Engine**: fixed Build 013's
  own `zeroMotifOverlap` finding at the root, in the two subsystems Phase A's
  audit proved were affected (`clusterEngine.ts`'s `'sCurve'` archetype,
  `layouts/sCurve.ts`) — no new species, no new presets, no scoring changes.
  Phase A first corrected a factual error in Build 013's own recommendation
  text ("allow controlled overlap"): direct measurement of all 48 affected
  patterns showed 48/48 were already too dense, the opposite direction.
  Root cause: a formula artifact (`tt === 0.5` degenerate coincident-hero
  offset for odd cluster member counts) plus a structurally over-tight
  `clusterRadius` scale factor, both confined to the `sCurve` cluster
  archetype used only by `darkBotanical`/`editorialBotanical`'s `sCurve`
  layout. Measured result across the identical 5,000-pattern Build 013
  portfolio: `zeroMotifOverlap` failures 48 → 0 (100%), `sCurve`-layout mean
  Absolute Commercial Quality 73.4 → 82.8 (p10 58 → 74), top-decile
  unchanged-or-improved at every regression tier (no regression). See
  `docs/build_reports/BUILD_014_REPORT.md`.

- **Portfolio Manager P1 — Core Database and Asset Library**: new offline
  asset catalog (`src/catalog/`, UI in `src/components/portfolio/`) — import,
  store, browse, search, inspect, and safely remove stock-vector source
  files (SVG/PNG/JSON/EPS/AI/JPG) without modifying or degrading the
  originals. IndexedDB-only storage (no localStorage fallback for the
  catalog — binary Blob bodies can't survive `JSON.stringify`, and the
  quota is too small for a real library), versioned `PortfolioAsset`
  domain model with workflow status orthogonal to archiving, multi-signal
  duplicate detection (SHA-256 + normalized-JSON hash + filename/size +
  generator seed), tolerant multi-shape JSON metadata extraction, a
  paginated search/filter/sort grid validated at 1,000+ records, a
  read-only Health Check report, and per-asset ZIP export with hash-
  integrity verification. This is a separate product track from the
  composition-quality builds above (0xx-014) — it does not touch the
  Generator, the evaluation/scoring engine, or any existing storage
  format. See `docs/build_reports/PORTFOLIO_MANAGER_P1_REPORT.md` and
  `docs/portfolio/`.

- **Portfolio Manager P2 Stage 1 — Collection Domain and Data Foundation**:
  the `Collection` entity (`domain/collection.ts`), its IndexedDB
  repository (`storage/collectionStore.ts`, `DB_VERSION` 4 → 5, new
  `collections` object store), and the business-logic service layer
  (`services/collectionService.ts`) — full CRUD, many-to-many asset
  membership via P1's already-reserved `PortfolioAsset.collectionIds`,
  bulk assign/remove with structured results, archive semantics
  orthogonal to deletion, cascading delete cleanup, and read-only
  integrity validation + repair (orphaned membership, stale cover-asset
  references). **No UI** — this stage is data/service-layer only, by
  design; see `docs/build_reports/P2_STAGE1_REPORT.md`,
  `docs/portfolio/COLLECTION_ARCHITECTURE.md`, and
  `docs/architecture/ADR-005-collection-relationship.md`.

- **Portfolio Manager P2 Stage 2 — Collection UI and UX**: the browsing/
  management UI on top of Stage 1's now-complete
  `services/collectionService.ts` API — a "คอลเลกชัน" (Collections) tab
  inside `PortfolioManagerView.tsx` (All/Active/Archived/Integrity
  sub-navigation), create/rename/archive/delete, cover set/clear with
  safe fallback, single- and bulk-asset assignment (multi-select on the
  asset grid, one reused `CollectionAssignmentDialog` for both), a
  collection filter integrated into the existing asset-library search/
  filter system, and an integrity scan + explicit-repair panel mirroring
  P1's `PortfolioHealthCheckPanel` shape. No domain/storage/service code
  changed; no `DB_VERSION` bump. See
  `docs/build_reports/P2_STAGE2_REPORT.md` and
  `docs/portfolio/P2_STAGE2_UI_ARCHITECTURE.md`.

- **Portfolio Manager P2.5 Sprint 1 — Collection Validation Infrastructure**:
  a deterministic Collection dataset generator (SMALL/MEDIUM/LARGE
  presets — 1,000/10,000/100,000 assets), a reusable benchmark runner
  (warm-up/measured iterations, real statistics, console/JSON/Markdown
  reports), 8 reusable integrity scenarios built on Stage 1's existing
  scan/repair functions, a memory-instrumentation foundation (sampler +
  Blob-URL lifecycle tracker) proven via a bounded smoke test, a
  performance-baseline comparison policy, and
  `npm run validate:collections*` CLI scripts — no production code
  changed, no `DB_VERSION` bump, no user-facing Collection feature. See
  `docs/build_reports/P2_5_SPRINT1_REPORT.md` and
  `docs/portfolio/P2_5_VALIDATION_ARCHITECTURE.md`.

## Recommended Next Build (Portfolio Manager track)

Sprint 1 shipped the validation *infrastructure* only — no stress/soak
run, no crash-recovery certification was performed with it yet. The
natural next candidate is **P2.5 Sprint 2: apply this infrastructure to
an actual stress/soak/crash-recovery pass** (long-running repeated
cycles tracking a real memory-growth trend, not just the bounded smoke
proof Sprint 1 shipped; a genuinely large sustained-load run; recovery
behavior after a simulated mid-write interruption). **Full-library
backup/restore** (P1's Blob-per-file design already supports zipping the
entire `portfolioFiles` store the same way `services/exportAsset.ts`
zips one asset today) remains excluded from every sprint so far and is
still a candidate independent of the validation track.

## Recommended Next Build (composition-quality track)

Build 014 was a narrowly-scoped fix for the single recommendation Build
013's Portfolio Intelligence Engine produced — it does not itself generate a
new ranked recommendation (that engine, `src/portfolio/recommendations.ts`,
is unchanged and read-only). The natural next step is re-running Build 013's
analysis pipeline against a fresh 5,000-pattern portfolio generated with
Build 014's fix applied, to surface the next-highest-lift failure mode now
that `zeroMotifOverlap` is resolved (Build 013's own Section 7 findings —
`heroInsufficientDetail` at 7.44x lift, `largeEmptyHole` at 5.94x,
`weakHierarchy` at 4.37x — are the leading candidates, but should be
re-measured on fresh data rather than assumed to still hold in the same
order). The sections below are kept for history but reflect earlier builds'
own state, not the current one.

## Recommended Next Build (superseded — see below for Build 013's own list)

Build 013's own report had the evidence-based Build 014 recommendation,
derived from the highest-lift failure-mode finding across the full
5,000-pattern portfolio (`zeroMotifOverlap`, 9.1x lift in the bottom decile,
High confidence) — now resolved by Build 014.

## Recommended Next Build (superseded — see below for Build 012's own list)

Build 012 fixed the evaluation-layer bias Build 011.5 diagnosed. With the
scoring layer now trustworthy across every preset, the natural next step is
extending the same layout/product context this build introduced to the two
explicitly-scoped-out consumption points (`critic/visualAnalysis.ts`'s own
duplicate `gridAppearance` visual-issue flag, `metadata/submissionCenter.ts`'s
checklist display) using the exact same `layoutEvaluationClass` pattern, plus
Build 011.5's own remaining recommendations for artistic quality (hero-scale-
dominance gap, botanical-category coverage). The section below is kept for
history but reflects Build 011's own state, not the current one.

## Recommended Next Build (superseded — see below for Build 011's own list)

Build 011's own report has the up-to-date, evidence-based recommendation
list (wire `resolveLayoutArchetypeForProduct` into a real call site once
`layoutId` gains an optional state, surface Commercial Appeal Score V2 /
the Consistency Portfolio's per-preset table in a UI panel, re-run the
Consistency Portfolio as the standard before/after tier for future Style-
DNA-touching builds). The section below is kept for history but reflects
Build 001.1's own state, not the current one.

## Recommended Next Build (superseded — see below for Build 001.1's own list)

Ranked by how directly each follows from what Build 001 measured, not by
guesswork:

### 1. Fix the Negative Space / Pattern Physics interaction (`docs/KNOWN_ISSUES.md` #1)

Reorder `engine/compositionIntelligence.ts`'s pipeline (Attraction before
Negative Space Correction, or align both to the same grid resolution) and
re-run the exact before/after methodology Build 001 established to
confirm the `deadSpace`/`largestEmptyRegion` regression is actually
resolved, not just relocated. Small, well-scoped, has a clear success
test already written (`docs/PERFORMANCE.md`'s before/after numbers).

### 2. Spatial-hash nearest-neighbor search for Pattern Physics (`docs/KNOWN_ISSUES.md` #2)

`applyAttraction`'s O(n²) scan is the single largest performance cost this
build introduced (`radial`: 416ms -> 1039ms). A grid-bucketed nearest-
neighbor search (the same bucketing idea `engine/scoring.ts`'s occupancy
grid already uses, applied to accelerate the search instead of just
measuring density) would bring high-instance-count layouts down to
roughly O(n). Worth doing before extending Pattern Physics further, since
any new attraction-consuming feature inherits the same cost.

### 3. Extend Cluster Engine coverage to more layouts (`docs/KNOWN_ISSUES.md` #3)

Only `scatter`/`bouquet`/`toss` currently route through
`engine/clusterEngine.ts`. `heroFlow`/`heroScatter`/`densePremium` are
plausible next candidates (already hierarchy-aware, not in
`REGULAR_LATTICE_LAYOUTS`) — evaluate each individually with the same
before/after empirical methodology, since Build 001's own experience
(assuming `grid`/`gridMinimal` alone were "the strict layouts", then
discovering `halfDrop`/`brick`/`stripe` needed the same treatment) shows
guessing which layouts benefit is unreliable; measuring is not.

### 4. A real Design Specification lever for cluster connectivity

`critic/artDirection.ts`'s `fragmentedSilhouette` recommendation is
honestly advisory-only today because no `DesignSpecification` field
controls Pattern Physics' `attractionStrength` (it's only reachable via
raw `GenerateParams.compositionIntelligence` or Style DNA's
`clusterStyle`/`clusterDensity`, not the higher-level spec schema
`critic/`/`trend/` code patches). Adding one would let the Design Critic's
Improvement Loop actually fix a fragmented silhouette instead of only
naming it.

### 5. Formalize hierarchy's remaining named dimensions with real payoff

Build 001 added `ROLE_IMPORTANCE` (feeds Pattern Physics) and
`ROLE_LAYER_PRIORITY` (feeds paint order) — 2 of the brief's 5 named
hierarchy dimensions, chosen because they feed something real. "Detail"
and "Density" already exist informally (hero detail overlay presence,
`HierarchyParams` ratios). A future build could formalize an explicit
per-role "Detail Level" numeric field if a real consumer needs it (e.g. a
future SVG-complexity budget allocator) — not worth adding as an inert
field with nothing reading it.

---

## Recommended Next Build (post-Build-001.1)

Ranked by how directly each follows from what Build 001.1 measured:

### 1. A style-aware adjustment to `commercialScore` (`docs/KNOWN_ISSUES.md` #3, Build 001.1)

The 100-pattern Visual Portfolio Review found `commercialScore`
structurally favors hero-centric Style DNA presets — every top-20 pattern
used a `heroFocus`-hierarchy, hero-centric layout. A minimal/airy preset's
real commercial merit isn't about hero dominance, so the composite needs
a style-aware term (e.g. detecting a deliberately-minimal Style DNA
preset and re-weighting Hero Visibility Score down / Negative Space up
for that case specifically) rather than one fixed weighting for every
style.

### 2. Extend Semantic Cluster V2 to more layouts (`docs/KNOWN_ISSUES.md` Build 001 #3, still open)

`heroFlow`/`heroScatter`/`densePremium` now use per-hero clusters (Build
001.1); `scatter`/`bouquet`/`toss` already did (Build 001 and earlier).
The remaining layouts (`radial`, `airy`, the `REGULAR_LATTICE` group, etc.)
were deliberately left out of Build 001.1 too — evaluate each
individually with the same empirical methodology both builds have used,
since guessing which layouts benefit has been repeatedly wrong (Build
001's `REGULAR_LATTICE_LAYOUTS` finding, Design Decisions #6).

### 3. A genuinely different Flow mechanism (`docs/KNOWN_ISSUES.md` #2, Build 001.1)

Build 001.1 confirmed the existing post-hoc global-field
`applyFlowBias` mechanism is near its achievable ceiling — 7 tuning
variants all traded `flowCoherence` against `fragmentedSilhouette`/
`largestEmptyRegion`. A materially higher `flowCoherence` needs a
different mechanism entirely (e.g. per-layout flow paths informed by each
layout's own generation, not a single field applied after the fact).

### 4. Spatial-hash nearest-neighbor search for Pattern Physics (`docs/KNOWN_ISSUES.md` Build 001 #2, still open)

Not addressed in Build 001.1 — still the single largest performance cost
in the composition pipeline for very high-instance-count layouts.

## Explicitly out of scope (per the brief, and still true)

Marketplace, SEO, AI Integration, Collection Builder, Prompt System, and
Batch Production changes are unrelated to composition quality and belong
to whichever future build actually needs them — nothing in this roadmap
should be read as smuggling those in.
