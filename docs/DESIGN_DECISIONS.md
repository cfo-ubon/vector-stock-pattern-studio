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
