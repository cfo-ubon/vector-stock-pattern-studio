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

## Recommended Next Build (see `docs/build_reports/BUILD_007_REPORT.md` §10 for the current list)

Build 007's own report has the up-to-date, evidence-based recommendation
list (extend Flower Anatomy data to spray-role species, wire the Petal
Variation Library into the remaining ring-based flowers, root-cause the
small `repeatedScale` uptick, a genuinely coordinated Gesture Engine
across cluster placement). The section below is kept for history but
reflects Build 001.1's own state, not the current one.

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
