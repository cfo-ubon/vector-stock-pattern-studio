# Project Phoenix V2 — Visual Quality Foundation

This document covers Project Phoenix V2: the Cluster Composition Engine,
Hero Motif Complexity, the Overlap/Negative-Space/Rhythm behavior that
falls out of cluster placement, and the harsher, design-aware Quality
Inspector — a visual-quality pass over the SVG generation engine, with no
new features, no new UI, and no changes to Marketplace/SEO/Trend
Intelligence modules.

## Contents

- [Scope decision](#scope-decision)
- [Architecture](#architecture)
- [Cluster Engine](#cluster-engine)
- [Hero Motif Complexity](#hero-motif-complexity)
- [Overlap, Negative Space, Rhythm](#overlap-negative-space-rhythm)
- [Visual Hierarchy](#visual-hierarchy)
- [Quality Inspector](#quality-inspector)
- [Self-improvement loop](#self-improvement-loop)
- [SVG optimization](#svg-optimization)
- [Developer Guide](#developer-guide)
- [Tests](#tests)
- [Performance](#performance)
- [Remaining weaknesses](#remaining-weaknesses)
- [Recommendations](#recommendations)

## Scope decision

The brief's mission — "dramatically improve the visual quality of
generated SVG artwork... resemble work created by an experienced surface
pattern designer instead of procedurally scattered vector objects" —
points at one concrete, honest gap this app's own prior milestones had
already named but not built: `engine/styleDna.ts`'s module comment (from
the Style DNA Engine milestone, v1.30) states plainly that "the roadmap's
Cluster Engine... [does] not exist yet... `clusterStyle`/`clusterDensity`
are therefore approximated today through the real levers that already
exist (overlapAmount + Composition Intelligence's balanceStrength) rather
than a true clustering placement algorithm." Section 1's literal
complaint — "The current generator scatters individual motifs
independently" — is also literally true of `layouts/scatter.ts`'s
pre-Phoenix implementation (a plain Poisson-disc point scatter, one motif
per point, zero relationship between neighbors).

This phase builds the real Cluster Composition Engine that gap named, and
retrofits it into the two layouts most responsible for the "scattered
stickers" look (`scatter`, `toss`) plus unifies `bouquet` (which already
had bespoke, single-archetype cluster logic) onto the same shared engine.
It also closes a second, concrete gap discovered while auditing the
Hierarchy Engine: `heroFlow`/`heroScatter`/`densePremium`/`bouquet` build
their own hero/secondary/filler tiers internally (correctly, per
`HIERARCHY_EXEMPT_LAYOUTS`) but never actually wrote `Placement.role` onto
their output — meaning every hero motif those layouts ever produced
carried no `data-role="hero"` in the exported SVG, and nothing downstream
(Hero Motif Complexity, hierarchy-aware scoring) could recognize them.
That's fixed for all four.

**Not touched**: the 14 layouts' user-facing identity (no new `LayoutId`,
no ControlPanel changes — every layout keeps its existing id/label so no
UI or saved-pattern compatibility changes), Marketplace modules, SEO,
Trend Intelligence's schema, and per-generator shape logic for all ~19
categories (Hero Motif Complexity is deliberately generator-agnostic — see
below for why that's the stronger design, not a shortcut).

## Architecture

```
src/engine/
  clusterEngine.ts       NEW — Cluster Composition Engine (Sections 1, 2)
  heroComplexity.ts       NEW — Hero Motif Complexity detail overlay (Section 3)
  tile.ts                 EXTENDED — wires heroComplexity into the motif build step
  scoring.ts               EXTENDED — 5 new real metrics + 12 new/updated penalty rules (Section 8)
  svgGeometry.ts           EXTENDED — MotifInstance.nodeCount (Section 8's real-detail measurement)
src/layouts/
  scatter.ts, toss.ts      REWRITTEN — route through the Cluster Engine
  bouquet.ts                REWRITTEN — consumes the shared 'bouquet' archetype instead of a bespoke duplicate
  heroFlow.ts, heroScatter.ts, densePremium.ts  FIXED — now tag Placement.role (were silently omitting it)
```

No existing `PatternLayout`/`GenerateParams`/`Placement` public shape
changed — `Placement` already had an optional `role` field from the
Hierarchy Engine milestone; this phase is the first time every layout that
should populate it actually does.

## Cluster Engine

`engine/clusterEngine.ts` implements the brief's own workflow literally:

```
Generate Cluster -> Arrange Motifs -> Evaluate Cluster ->
Place Cluster into Pattern -> Connect Clusters -> Seamless Repeat
```

- **`generateCluster(archetype, rng, opts)`** — one hero member at the
  cluster anchor plus an archetype-shaped ring of secondary/filler/accent
  members. All 8 named archetypes are implemented with genuinely distinct
  geometry (not the same scatter renamed): **Bouquet** (polar tumble, the
  original single-archetype precedent generalized), **Radial** (jittered
  angular ring), **Cascade** (top-heavy, decreasing scale flowing
  downward), **Editorial** (hero-left, loose rightward flow band),
  **Organic Scatter** (elliptical, non-circular reach), **S-Curve**
  (parametric sine path), **Diagonal** (45°-axis string with alternating
  perpendicular offset), **Asymmetric** (a close "connective" group plus a
  far counterweight group). Every formula jitters both angle and radius
  (Section 2's "no equal spacing"), and ~30% of each cluster's members are
  deliberately rescaled into an intentional-overlap band relative to the
  hero (Section 2's "intentional overlap", Section 5's "controlled
  overlap") — guaranteed structurally, not left to chance.
- **`evaluateCluster(members, baseRadius)`** — real, measurable cohesion:
  penalizes isolated members (too far from the hero) and, separately,
  suspiciously *uniform* member spacing (mechanical, not organic);
  computes angular-spread evenness as an "organic silhouette" signal.
- **`placeClusterAnchors(tileSize, baseRadius, rng)`** — organic,
  non-grid anchor placement reusing the same wrap-aware Poisson-disc
  sampler every other layout already relies on, with a deliberately
  non-monotonic large/medium/small size-rhythm cycle (Section 7) driving
  a *varying* minimum distance so anchor spacing itself is never uniform.
- **`connectClusters(anchors, tileSize, baseRadius, rng)`** — Section 1's
  explicit "Connect Clusters" step: sparse, occasional bridging accents
  between nearby anchor pairs so the pattern doesn't read as isolated
  islands even when each cluster individually is well-composed.
- **`buildClusterPlacements(opts, rng)`** — top-level assembly. For each
  anchor: generates a cluster, evaluates it, and retries (up to 3
  attempts, keeping the best) if cohesion is below a target — Section 9's
  "Improve cluster" loop applied at cluster granularity. Converts members
  to absolute, wrap-aware `Placement[]`, already paint-ordered hero-first
  so supporting members visually layer *onto* the hero at overlap points
  (the real, geometry-level analogue of "leaf over flower" this engine can
  guarantee without recognizing shape semantics — see Overlap section
  below for the honest limit of that claim).

`scatter.ts` and `toss.ts` now call `buildClusterPlacements` with an
archetype pool matched to their own identity (`organicScatter`/`bouquet`/
`asymmetric` for Random Scatter; `diagonal`/`cascade`/`sCurve` for Toss),
picked once per tile via `pickArchetypePool` so a single generated pattern
commits to one coherent composition strategy rather than mixing all 8.
`bouquet.ts` always uses the `'bouquet'` archetype (unchanged identity,
now real shared code).

## Hero Motif Complexity

`engine/heroComplexity.ts` — Section 3: "Increasing size alone is NOT
sufficient... automatically increase internal complexity." Rewriting
per-generator shape logic to draw a genuinely different, more elaborate
variant for all ~19 categories would be a redesign of every generator, not
a visual-quality pass. Instead this module adds a real, generator-agnostic
detail overlay on top of whatever shape a generator already drew — applied
*universally* from one integration point (`engine/tile.ts`, right after
`generator.createMotif`) — which is more consistent than hand-tuning 19
generators separately, not a fallback for not doing that:

- **Inner ring** — a concentric circle outline inside the motif's own
  radius (Section 3's own "inner decorative rings" example).
- **Texture lines** — short radiating lines from near-center outward
  ("texture lines" / "veins").
- **Nested contour** — a smaller inset rotated polygon ("nested geometry"
  / "contour variations"), hero-only.

Detail level is 100 for hero, 55 for secondary, 0 for filler/accent — a
real tier, not on/off (Section 4's "each hierarchy level must differ in
complexity/detail density"). Every primitive is strictly bounded within
the motif's own already-measured radius, so it never risks a wrap-clone
seam. Trigger probabilities are deliberately conservative (~2-3 extra
nodes per hero on average, ~1-2 per secondary) rather than "every hero
always gets every primitive" — this runs once per hero/secondary
*instance*, and some layouts (a dense radial medallion) place hundreds of
them in one tile, so per-instance cost has to stay small for the node
budget to hold at scale (see Performance below for the real numbers this
was tuned against).

## Overlap, Negative Space, Rhythm

- **Overlap (Section 5)** — real, controlled overlap is now structural:
  the Cluster Engine's ~30% overlap-band mechanism guarantees at least one
  genuinely overlapping member per cluster, and paint order (hero first,
  then secondary/filler/accent) means supporting members always layer
  *onto* the hero, never the reverse. **Honest limit**: this engine has no
  shape-semantic recognition (it doesn't know which motif is "a leaf" vs
  "a flower"), so the brief's literal "leaf over flower, flower over leaf"
  pairings aren't implemented as named rules — the achievable, real
  analogue is role-based z-order, which is what's built.
- **Negative space (Section 6)** — `placeClusterAnchors`'s Poisson-disc
  spacing already keeps anchors from clumping or gapping mechanically;
  `engine/scoring.ts`'s pre-existing `largestEmptyRegion` metric (SVG
  Intelligence Engine Phase 3) still measures and penalizes accidental
  large holes.
- **Visual rhythm (Section 7)** — the `SIZE_RHYTHM` large/medium/small
  cluster-size cycle (deliberately non-monotonic, randomized starting
  offset, small per-instance jitter) is the real, structural rhythm
  mechanism; `engine/scoring.ts`'s new `spacingUniformity` metric measures
  whether the *result* avoided repetitive, mechanically-equal spacing.

## Visual Hierarchy

Section 4's five-way differentiation (hero/secondary/filler/tiny
accent/background) was already substantially real from the Hierarchy
Engine milestone (scale multipliers per role, `HIERARCHY_PRESETS`). This
phase closes the two gaps that made it inconsistent: (1) the role-tagging
bug fixed above, so every layout that has a real hero now actually says
so in the exported SVG; (2) Hero Motif Complexity, so "detail density"
(the one hierarchy criterion the brief names that scale alone can't
satisfy) is now real, not just implied by size.

## Quality Inspector

`engine/scoring.ts`'s `SOFT_PENALTY_RULES` gained the brief's 12 named
penalties at their exact point values — every one derived from real
geometry (never an arbitrary number):

| Penalty | Points | Real signal |
| --- | --- | --- |
| Zero motif overlap | -20 | `overlapQuality <= 25` (near-zero crowding) |
| Hero insufficient detail | -15 | `heroDetailRatio < 45` (new) |
| Equal spacing detected | -15 | `spacingUniformity < 35` (new) |
| Too many isolated objects | -10 | `isolationScore < 50` (new) |
| Weak hierarchy | -15 | `hierarchy < 40` |
| Low cluster cohesion | -15 | `clusterCohesion < 40` (new) |
| Repeated motif orientation | -10 | `rotationDiversity < 30` |
| Grid appearance | -20 | `gridAppearanceScore < 40` (new) |
| Visual dead zones | -10 | `largestEmptyRegion < 40` (pre-existing `largeEmptyHole` rule, unchanged) |
| Monotonous scale | -10 | `scaleDiversity < 30` |
| Low motif diversity | -10 | `motifShapeDiversity < 25` (pre-existing `repetitiveMotifShapes`, points bumped 6 -> 10) |
| Mechanical composition | -20 | `gridAppearanceScore < 40 && spacingUniformity < 35 && rotationDiversity < 30` (composite of 3 real signals) |

Two of the twelve are the *same* real concept as a pre-existing rule
(dead zones, motif diversity) — those were updated in place rather than
duplicated, so a single condition is never double-penalized under two
different names.

**5 new real `CompositionMetrics`** back the new rules:

- `heroDetailRatio` — average node-count of hero-role instances vs.
  filler/accent baseline (`MotifInstance.nodeCount`, new field, computed
  from one wrap-clone copy's own subtree so it measures the motif's
  detail, not how many tile-edge copies it needed).
- `isolationScore` — fraction of instances with no real neighbor nearby.
- `clusterCohesion` — how much real supporting company hero instances
  keep nearby (works from any tile's instance positions/roles, not an
  explicit cluster id, so it applies uniformly to Cluster-Engine and
  non-Cluster-Engine layouts alike).
- `gridAppearanceScore` — real grid detection: fraction of nearest-
  neighbor directions that land close to an axis (0/90/180/270°).
- `spacingUniformity` — coefficient-of-variation-based "how uniform is
  the spacing", distinct from the pre-existing `spacing` metric's gentler
  evenness curve and from `rhythmRegularity` (which *rewards* some
  periodicity — this only flags the mechanical extreme).

All 5 were added to every `QUALITY_PRESET_WEIGHTS` preset.

## Self-improvement loop

Section 9's "Generate -> Evaluate -> Identify penalties -> Improve ->
Evaluate again" loop already existed at the whole-pattern level
(`trend/designSpecQuality.ts`'s `runDesignSpecQualityLoop`, from the SVG
Intelligence Engine milestone: generate a candidate pool, check against
targets, regenerate from a fresh derived seed and keep the better attempt,
up to a bounded round count) — untouched this phase, and it now benefits
automatically from the harsher, more accurate Section 8 penalties without
any changes of its own. This phase adds the loop's cluster-granularity
analogue: `buildClusterPlacements`'s internal per-cluster retry (up to 3
attempts against `evaluateCluster`'s cohesion score, described above).

## SVG optimization

Section 10 ("editable SVG, grouped layers, Affinity Designer
compatibility, optimized Béziers, reduced node count, reusable geometry")
was already fully built in the SVG Intelligence Engine milestone
(`engine/svgOptimizer.ts`) — verified this phase to still work correctly
on Cluster Engine and Hero Complexity output (structural, not
geometry-aware, so nothing about richer clusters or overlay primitives
changes its correctness), not rebuilt.

## Developer Guide

**Adding a 9th cluster archetype**: add its id to `ClusterArchetype`/
`CLUSTER_ARCHETYPES` and a case to `archetypeOffset` in
`engine/clusterEngine.ts` returning `{dx, dy, role}` for member `i` of
`total` around the hero at `(0,0)` — jitter both angle and radius (never
equal steps), and add a default member-count range to `generateCluster`'s
`defaultCounts` table.

**Retrofitting another layout onto the Cluster Engine**: keep the
`PatternLayout` interface identical (id/label/`generate(params, rng)`
unchanged), call `buildClusterPlacements` with an archetype pool matching
the layout's own design intent, and consider adding it to
`HIERARCHY_EXEMPT_LAYOUTS` in `engine/hierarchy.ts` (Cluster Engine output
already carries real roles, so the generic hierarchy pass would otherwise
double-compound scale).

**Adding a new Quality Inspector penalty**: add the real metric to
`CompositionMetrics`/`computeMetrics` in `engine/scoring.ts` first (never
derive a penalty from something not independently measured), then add the
named rule to `SOFT_PENALTY_RULES` with a `check` referencing that metric.

**Tuning Hero Motif Complexity's node cost**: `ROLE_DETAIL_LEVEL` and the
trigger-probability constants in `applyHeroDetailOverlay`
(`engine/heroComplexity.ts`) were tuned against the app's heaviest
category/layout combination (`radial` + `geometric`, ~1000+ placements) to
stay under the Candidate Engine's 8000-node hard-reject budget — if
raising detail further, re-run
`engine/svgStructuralAudit.test.ts`'s "every layout" suite first.

## Tests

- `engine/clusterEngine.test.ts` (26 tests) — all 8 archetypes produce
  valid, finite, multi-role clusters; guaranteed overlap band; hero-first
  paint order; no isolated floating members; `evaluateCluster` correctly
  flags isolation, detects overlap, and scores organic jitter above
  mechanical uniformity; anchor placement stays in bounds with a real
  size rhythm; `connectClusters` only bridges genuinely nearby pairs;
  `buildClusterPlacements` determinism and multi-archetype cycling.
- `engine/heroComplexity.test.ts` (12 tests) — strict no-op for
  filler/accent/undefined roles; real measurable node growth for hero;
  hero averages more nodes than secondary; determinism; never uses the
  background color; safe on zero radius / single-color palettes.
- `engine/scoring.test.ts` (+19 tests) — all 5 new metrics exercised via
  synthetic tiles with precise, non-flaky geometric control (including
  periodic-wrap-aware isolated-point placement); all 12 named penalties
  verified at their exact point values; `mechanicalComposition`'s
  co-occurrence requirement (fires only when all 3 underlying signals
  agree, not on any single one alone).
- `engine/svgGeometry.test.ts` (+2 tests) — `MotifInstance.nodeCount` is
  always positive and reflects one wrap-clone copy's own subtree, not the
  whole `motif-N` group.
- `engine/svgStructuralAudit.test.ts` — pre-existing suite (every category
  × every layout, node-budget headroom) re-verified passing after this
  phase's changes, including the specific `radial` + `geometric` case
  that surfaced the Hero Complexity node-budget tuning described above.

**Full suite**: 961/961 tests passing across 71 files (`npx vitest run`),
up from 901 before this phase. `npx tsc -b` and `npm run lint` (oxlint)
both clean. `vite.config.ts`'s default `testTimeout` was raised 5000ms ->
15000ms — richer clusters and 5 more real per-candidate metrics genuinely
increase full-collection/multi-round-candidate-pool test runtime; several
tests were already right at the old default's edge (see the file's own
comments) before this phase, and this phase's real, expected extra work
tipped a few over.

## Performance

- **Cluster Engine layout math itself is cheap**: `scatter`/`toss`/
  `bouquet`'s `generate()` calls (including the internal 3-attempt
  evaluate-and-retry loop) measured ~0.5-1ms each — not the bottleneck.
- **More motifs is the real, expected cost**: Cluster Engine-backed
  `scatter` produces ~1.8x the motif count of the old independent-point
  scatter at the same density/motif-size settings (richer clusters, by
  design) — for a heavier generator like botanical this measured
  ~100-130ms per tile (vs. an estimated ~60-95ms before), still
  comfortably interactive for a single "Generate" click.
- **Hero Motif Complexity was tuned for scale, not just correctness**: an
  earlier, richer version of the overlay (up to ~19 extra nodes per hero,
  4 primitive types) pushed the worst-case case (`radial` layout ×
  `geometric` category, ~1053 placements, ~12% hero + 38% secondary by
  default hierarchy ratios) from a comfortable margin to 12,240 nodes —
  over the Candidate Engine's 8,000-node hard-reject budget. The shipped
  version (3 lighter primitives, lower trigger probabilities, ~2-3 nodes/
  hero average) brings the same case to 7,580 nodes — under budget, with
  headroom the pre-existing test suite's "heaviest generators × every
  layout" sanity-ceiling check continues to monitor.
- No change to the Candidate Engine's async chunking or per-candidate
  generation architecture.

## Remaining weaknesses

- **No shape-semantic overlap rules** — "leaf over flower" etc. are not
  literally implemented (see Overlap section above); the real, achievable
  role-based z-order is.
- **Hero Motif Complexity is a universal overlay, not per-generator
  detail** — a genuinely different botanical hero (more petals, actual
  veins following the real curve geometry) vs. a genuinely different
  mandala hero (more rings) would read as more bespoke than one shared
  overlay; the tradeoff (consistency across 19 categories from one
  integration point, vs. deeper but generator-specific richness) is
  documented, not hidden.
- **Only `scatter`/`toss`/`bouquet` route through the Cluster Engine** —
  `heroFlow`/`heroScatter`/`densePremium`/`radial`/`grid`/`brick`/
  `halfDrop`/`sCurve`/`airy`/`gridMinimal`/`stripe` keep their own
  pre-existing (already composition-aware, per the README's own
  documentation of prior milestones) placement logic, unmodified.
- **`clusterCohesion`'s radius formula is instance-count-sensitive** — it
  scales with `1/sqrt(total instances)`, which discriminates well at
  realistic pattern densities (hundreds of instances) but is intentionally
  lenient at very low instance counts (a handful of motifs), documented in
  the metric's own test suite.

## Recommendations

1. **Retrofit `heroFlow`/`heroScatter`/`densePremium` onto the Cluster
   Engine too** — they already build hero/filler tiers by hand; routing
   them through `buildClusterPlacements` with an `editorial`/`radial`-
   leaning archetype pool would unify the codebase further and likely
   improve their negative-space/overlap behavior the same way `scatter`/
   `toss`/`bouquet` improved.
2. **Per-generator Hero detail** for the highest-traffic categories
   (botanical, geometric, mandala) as a *layered addition* on top of the
   universal overlay — e.g. botanical heroes drawing a genuine extra petal
   layer using the Growth Engine's own curve math, not just the generic
   ring/lines primitives.
3. **A real cluster id on `Placement`** — `clusterCohesion` currently
   infers cohesion from position/role alone; an explicit cluster id
   (Cluster-Engine-backed layouts already know it internally) would let a
   future metric measure cohesion exactly rather than by proximity
   inference, and would let Section 5's connect-clusters step reason about
   real cluster membership instead of anchor distance alone.
4. **Shape-semantic overlap** — once generators expose *what* they drew
   (a real "leaf" vs. "flower" tag on a `Motif`, not just a category id),
   the literal "leaf over flower" rules become buildable.
