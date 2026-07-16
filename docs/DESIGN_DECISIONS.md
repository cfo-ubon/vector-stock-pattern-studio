# Design Decisions

Records the non-obvious calls made during **Build 001 — Composition
Intelligence Foundation V2**, why they were made, and what real evidence
backed each one. This file is additive across builds; new builds append,
they don't rewrite history.

---

## Build 001 — Composition Intelligence Foundation V2

### 1. Audit before writing code — most of the 15-section brief already existed

The brief read as a from-scratch composition engine spec. An Explore-agent
audit (evidence-based, file:line citations, not assumptions) found real,
load-bearing infrastructure already covering most of it: `engine/hierarchy.ts`
(Visual Hierarchy + Smart Scale), `engine/clusterEngine.ts` (Semantic
Cluster Engine, Project Phoenix V2), `pattern-grammar/*.json` (Pattern
Constraint System), and `engine/compositionIntelligence.ts` itself — a
prior "Composition Intelligence Engine" from an earlier roadmap phase.
**Decision**: scope Build 001 to the genuine gaps the audit found (Pattern
Physics, real Flow-driven placement, a finer Negative Space pass, the
Silhouette Check, a real paint-order bug), and extend/refactor the
existing modules rather than write parallel ones. This directly follows
the brief's own instruction ("avoid duplicated logic").

### 2. Pattern Physics uses hierarchy roles, not invented botanical sub-roles

The brief's Section 8 examples ("flower attracts leaves", "berries stay
near branches") name botanical part-relationships that don't exist
anywhere in this codebase — `engine/clusterEngine.ts`'s own module
comment explicitly documents that it deliberately does *not* model shape
semantics, only the 4 generic hierarchy roles every other engine module
(`hierarchy.ts`, `scoring.ts`) already shares. **Decision**: implement
attraction at the level the engine actually models — every placement
attracts toward its nearest *strictly more important* role
(`ROLE_IMPORTANCE`: hero > secondary > filler > accent) — rather than
inventing a second, parallel semantic vocabulary (flower/leaf/bud/berry)
that no generator, scorer, or asset system would ever populate.

### 3. Negative Space reuses balance correction at a finer grid, rather than a new algorithm

The brief names "Negative Space Engine" as if distinct from the existing
quadrant-balance correction, but the underlying mechanism — move weight
from an overloaded region to an underloaded one — is identical at any
grid resolution; only the grid size differs. **Decision**: generalize the
old 2x2-only `applyBalanceCorrection` into `applyGridBalanceCorrection(...,
gridN, ...)`, and define `applyNegativeSpaceCorrection` as the same
function called with `gridN=4`. This is a real generalization (the old
`reflectIntoQuadrant`'s mirror-only trick only worked for exactly 2
divisions per axis; the new `moveIntoCell` works for any grid resolution
and any pair of cells) — not a cosmetic rename. Verified: `gridN=2` via
the general function produces byte-identical output to the original
`applyBalanceCorrection`.

### 4. Silhouette Check needed a motif-size-scaled grid, not a fixed one

First attempt: reuse `engine/scoring.ts`'s fixed 8x8 occupancy grid (the
same one its dead-space check uses) and flood-fill *occupied* cells
instead of empty ones. Empirically, this **never once** flagged a
fragmented pattern across 10 real test scenarios spanning very sparse to
very dense generation — the pattern's toroidal wrap-around (every edge
connects to the opposite edge) means a coarse, fixed grid's occupied
cells are almost always connected regardless of real sparsity. **Decision**:
scale the grid to the pattern's own real motif size
(`tileSize / (motifSize * 1.6)`, clamped to [4, 40]) so a single motif's
footprint occupies roughly one cell — verified this produces real,
meaningful signal: `airy` at default settings reliably flags as
fragmented (many small, mostly-isolated cell islands), `scatter`/
`bouquet`/`grid` never do (cluster-engine-backed or dense layouts read as
one cohesive blob).

### 5. Layer Priority: hero must paint last — a real, previously-latent bug

Auditing `engine/tile.ts`'s SVG-assembly order revealed that
`applyHierarchy` tags roles onto placements but never reorders them —
paint order stayed whatever the layout's own placement array order was.
For any non-cluster-engine layout with hierarchy enabled, a hero motif
generated early in the array could be drawn *underneath* a later
secondary/filler motif at an overlap point, silently undercutting the
Hierarchy Engine's own `heroScale` boost. **Decision**: add
`sortByLayerPriority` (a stable sort by a new `ROLE_LAYER_PRIORITY`
ranking) applied unconditionally in `tile.ts` right before SVG assembly —
unconditional because it's a correctness fix, not an opt-in feature, and
because it's a proven no-op (stable sort of an all-equal-priority array)
for every placement with no role, so no pre-existing saved pattern's
output changes unless it already had hierarchy enabled.

### 6. Regular Lattice layouts opt out of the new V2 passes — found empirically, not assumed

`grid`/`gridMinimal` were the obvious first candidates (matching
`critic/artDirection.ts`'s pre-existing `isStrictGridLayout` concept), and
an initial version of this build exempted only those two. Running the
mandated empirical before/after comparison against every other layout
(not just the two assumed) found the identical problem measurably hurting
`halfDrop` and `brick` severely (flowCoherence -22 to -28 points) and
`stripe` moderately (-3 to -6 points) — all three are, like grid, a
deliberately regular tiling/banding structure whose near-ceiling baseline
`flowCoherence` (85-94/100) the new flow-bias/negative-space/attraction
passes measurably eroded rather than improved. **Decision**: extend
`REGULAR_LATTICE_LAYOUTS` to all five layouts, based on the real
measurement, not an assumption that "grid-like" only means literally named
`grid`. This is the single most important empirical finding of this
build — it directly disproves an initial, reasonable-sounding but wrong
assumption about the scope of the fix needed.

### 7. Style DNA's `flowProfile`/`clusterStyle` get honestly wired, and a stale comment gets fixed

`engine/styleDna.ts` carried a comment (written when Project Phoenix V2's
Cluster Engine didn't exist yet) stating `clusterStyle`/`clusterDensity`
were "approximated" through a balance-correction proxy because no real
cluster engine existed. That engine has existed since Phoenix V2 shipped,
but the comment — and the wiring — were never updated. **Decision**: fix
both: `resolveStyleDna` now derives real `attractionStrength` from
`clusterStyle`/`clusterDensity` and real `flowBiasStrength` from
`flowProfile`, and the module comment is corrected to describe the actual
current state rather than a years-stale limitation. Leaving a misleading
comment in place — even one that used to be accurate — would mislead the
next contributor into re-deriving something that already works.

### 8. Overall quality-score movement is honestly reported as a near-wash, not oversold

The averaged `overallScore` across the 30-scenario before/after comparison
moved by only -0.3 (78.9 -> 78.6), even though `spacingUniformity` (+6.9),
`gridAppearanceScore` (+3.6), and `fragmentedSilhouette` incidence (8/30 ->
6/30) all moved meaningfully in the intended direction. The offsetting
factor is `largestEmptyRegion` (-3.5, and `deadSpace` flagged 1/30 -> 2/30)
— a real, small, honestly-measured side effect of running Negative Space
Correction and Pattern Physics in sequence (Attraction can re-concentrate
placements that Negative Space Correction just spread apart, at a
resolution neither pass shares). **Decision**: report this exactly as
measured rather than cherry-picking only the metrics that improved — see
`docs/KNOWN_ISSUES.md` for the specific tradeoff and
`docs/ROADMAP.md`/`BUILD_REPORT.md`'s Recommended Next Build for the fix
(reordering or resolution-aligning the two passes).

---

## Build 001.1 -- Composition Quality Refinement

### 1. Known Issue #1's real root cause was a grid-resolution mismatch, not pass ordering

Two reordering variants (Attraction before Negative Space Correction, in
either position) were the first, "obvious" hypothesis -- both were
implemented and empirically tested against the exact 30-scenario suite
Build 001 established. Both left `deadSpace` completely unchanged (2/30,
no improvement) and made `fragmentedSilhouette` measurably worse (6/30 ->
8/30) -- a genuine new regression. A follow-up, more surgical
"protect Negative-Space-Correction's own moved placements from
Attraction" mechanism was then implemented (a new `protectedIndices`
parameter on `applyAttraction`) -- it also showed **zero measurable
effect**, despite a diagnostic confirming the protected set was non-empty
(385 placements moved across 30 scenarios). Tracing why led to the actual
root cause: `engine/scoring.ts`'s `largestEmptyRegion` (and the
`deadSpace` detector built on it) measures on an 8x8 grid
(`gridCoverage(instances, tileSize, 8)`), while
`applyNegativeSpaceCorrection` operated on a 4x4 grid -- 4x coarser than
what the detector actually penalizes. **Decision**: change
`applyNegativeSpaceCorrection`'s `gridN` from 4 to 8, matching the
detector exactly, and remove the now-provably-inert `protectedIndices`
mechanism rather than keep unexercised complexity. Verified: this alone
recovered `largestEmptyRegion` (94.0 -> 94.5) and `overallScore` (78.6 ->
79.6) with no `fragmentedSilhouette` regression -- the pipeline order
itself was never the problem.

### 2. Section 3 (Flow) was left unchanged after 7 measured, rejected strengthening attempts

The brief asked for Flow Optimization without sacrificing Negative Space/
Hierarchy/Cluster Cohesion. Tried and measured: raising `applyFlowBias`'s
pull-strength coefficient; running the pass a second time after rhythm
smoothing; replacing the diagonal-convergence field with a pure shear;
and 3 blended diagonal/shear weightings. Every variant that moved
`flowCoherence` up by more than ~0.2 did so by trading `fragmentedSilhouette`
(6/30 -> 7-9/30) or `largestEmptyRegion`/overall score in the opposite
direction. **Decision**: leave `applyFlowBias`'s mechanism exactly as
Build 001 shipped it -- it already sits near the achievable balance point
for a single post-hoc global field, and the Section 4 fix recovered
`flowCoherence` as a side effect anyway (69.3 -> 69.4-69.6) without any of
these tradeoffs. Documented as a real, measured "don't chase it further"
finding rather than silently doing nothing.

### 3. Semantic Cluster V2: each of the 3 layouts keeps its own placement identity

`heroFlow`/`heroScatter`/`densePremium` (Build 001's own Roadmap-named
candidates) each build hero placement differently on purpose (a sine-wave
flow path / sparse Poisson-disc / three independent density tiers) --
replacing all three with one generic `buildClusterPlacements` call would
have flattened that intentional variety. **Decision**: keep each layout's
own hero-placement math, and wire `engine/clusterEngine.ts`'s
`generateCluster` in only for the *supporting* members around each hero
-- `editorial` archetype rotated to the local flow-path tangent for
`heroFlow`, `organicScatter` for `heroScatter`'s "burst" identity, a tight
`bouquet` for `densePremium`'s filler tier specifically (the tier whose
own independent-density identity mattered least to preserve). Verified via
the same empirical 6-scenario suite: `hierarchy` improved in all three
(heroFlow steady at 100, heroScatter 90 -> 100, densePremium 80.7 -> 88.5)
while `clusterCohesion`/`heroSeparation` stayed exactly 100 in every case.

### 4. Hero Complexity Engine's 2 new primitives needed a density-aware throttle, discovered empirically

Adding `buildDecorativeDots`/`buildAccentArc` (both hero-only) at their
first-pass trigger probabilities caused a real full-test-suite regression:
`critic/improvementLoop.test.ts`'s "stops as soon as the commercial bar
is met" test started failing because a specific real spec (a 1024-instance
grid layout, `heroRatio` 0.12 -> 129 heroes) went from 7906/8000 of the
hard SVG node budget (`knowledge/rules`'s `getHardNodeBudget()`, 8000) to
9541/8000 -- a hard reject that hadn't existed before. Repeatedly shrinking
the 2 new primitives' own trigger probability alone was not enough (even
near-zero probability only approaches the pre-existing 7906 baseline,
which itself had only 94 nodes of headroom -- an inherent fragility of that
one scenario, not of the new primitives). **Decision**: add a real,
tile-wide `instanceCount`-aware damping factor (`densityDamping` in
`engine/heroComplexity.ts`, wired from `engine/tile.ts`'s already-known
`paintOrderedPlacements.length`) that only engages above 400 instances --
below that threshold every existing test/behavior is completely
unaffected (verified: `instanceCount` is optional and defaults to no
damping). This is a real structural fix (aggregate node cost scales with
instance count, not per-instance detail alone) rather than permanently
gutting the new primitives to survive one pathological scenario.

### 5. Hero Visibility Score and Commercial Score reuse existing metrics, never recompute

Both new composites (`computeHeroVisibilityScore` in `engine/scoring.ts`;
`commercialScore` in `critic/commercialValidation.ts`) are weighted blends
of fields that already exist and are already real
(`heroDetailRatio`/`heroSeparation`/`hierarchy`/`paletteContrast` for the
former; Overall Score/`commercialReadiness`/Hero Visibility Score for the
latter). **Decision**: keep both as pure derived functions, not new
stored `CompositionMetrics` fields -- adding a field would have rippled
into `QUALITY_PRESET_WEIGHTS`, every exhaustive-metric-key iteration, and
every existing snapshot test, for a value that's fully computable from
data already on the object.

### 6. Premium/Luxury/Editorial Feeling: grounded in real Style DNA data, "Premium" honestly has no dedicated category

`critic/styleCoach.ts`'s 7 brief-named categories include `luxury` and
`editorial` but not `premium`. **Decision**: `luxuryFeeling`/
`editorialFeeling` reuse `findStylesForCategory` (Section 5's own real
Style DNA matching) turned into a numeric closeness score; `premiumFeeling`
is instead built from real construction-quality metrics
(`svgHealth`/`cornerContinuity`/`heroDetailRatio`/`colorBalance`) since no
Style DNA preset or category legitimately represents "premium" as its own
aesthetic distinct from luxury/editorial -- inventing an 8th
`StyleCoachCategory` just for this one composite would have gone beyond
Section 5's own brief-defined, already-shipped scope.

### 7. Wallpaper/Fabric/Gift Wrap Score: reused Collection Engine's Product Targets outright, zero duplication

`collection/productTargets.ts`'s `evaluateProductTargets` (Commercial
Collection Engine Phase 4) already scores exactly these 3 product uses
(among 10) from real category/tileSize/density/keyword signals.
**Decision**: `critic/commercialValidation.ts` calls it directly and reads
out the 3 named scores rather than re-deriving a parallel rule set --
verified via a test asserting the values match `evaluateProductTargets`'s
own output exactly, byte-for-byte.
