# Composition Intelligence Foundation V2 — Build 001

Developer documentation for Build 001: a focused visual-quality upgrade to
the placement/composition pipeline (`src/engine/hierarchy.ts`,
`src/engine/clusterEngine.ts`, `src/engine/compositionIntelligence.ts`, the
new `src/engine/patternPhysics.ts`, and `src/engine/styleDna.ts`'s wiring
between them), plus a new Silhouette Check in the Design Critic. This
build adds **no new features, panels, or generators** — its entire goal is
making the composition every existing generator/layout already produces
read as more intentional and less like scattered stickers.

## Contents

1. [Why an upgrade, not a rewrite](#why-an-upgrade-not-a-rewrite)
2. [Folder structure / what changed where](#folder-structure--what-changed-where)
3. [Section-by-section mapping](#section-by-section-mapping)
4. [Pattern Physics: attraction rules](#pattern-physics-attraction-rules)
5. [Flow Engine: from rotation label to real placement bias](#flow-engine-from-rotation-label-to-real-placement-bias)
6. [Negative Space: reusing balance correction at finer resolution](#negative-space-reusing-balance-correction-at-finer-resolution)
7. [Layer Priority: hero always paints on top](#layer-priority-hero-always-paints-on-top)
8. [Silhouette Check](#silhouette-check)
9. [Regular Lattice layouts opt out — an empirically-found interaction](#regular-lattice-layouts-opt-out--an-empirically-found-interaction)
10. [Style DNA wiring](#style-dna-wiring)
11. [Developer guide](#developer-guide)
12. [Testing](#testing)
13. [Performance notes](#performance-notes)

## Why an upgrade, not a rewrite

An audit before writing any code (see the Explore-agent findings folded
into this summary) found that most of the 15-section brief this build
implements was **already real, load-bearing infrastructure**, built across
three earlier milestones:

| Brief concept | Already lived in |
|---|---|
| Visual Hierarchy (Hero/Secondary/Filler/Accent) | `engine/hierarchy.ts` — `HIERARCHY_PRESETS`, `applyHierarchy` |
| Smart Scale Engine | `HierarchyParams`'s per-role `*Scale` fields |
| Semantic clusters, natural overlap, focal point | `engine/clusterEngine.ts` (Project Phoenix V2) — 8 named archetypes, deliberate overlap band, `evaluateCluster` |
| Pattern Constraint System | `pattern-grammar/*.json` + `knowledge/composition` — hero ratio ranges, density ranges, negative-space ranges, per-style rules, already configurable JSON |
| SVG compatibility | `engine/svgOptimizer.ts`, `engine/candidateEngine.ts`'s hard-reject rules, `engine/svgStructuralAudit.test.ts` |
| A prior "Composition Intelligence Engine" | `engine/compositionIntelligence.ts` (Roadmap Phase 2) — quadrant balance correction + rhythm smoothing, already wired into `tile.ts` |

Nothing above was rebuilt. The genuine gaps — found by reading, not
guessing — were:

- Only 3 of 14 layouts (`scatter`, `bouquet`, `toss`) routed through the
  real Cluster Engine; the rest have their own hand-tuned but real
  (non-random) placement math.
- `flowProfile` (calm/directional/dynamic) resolved to a rotation-jitter
  amount only — it never touched *placement*.
- Negative-space handling was a linear density nudge into whatever layout
  ran, not a real map-based hole check.
- No attraction/physics rules existed between hierarchy roles at all.
- No "does the whole pattern read as one shape from a distance" check
  existed anywhere in the Design Critic.
- A real paint-order bug: a hierarchy-tagged hero motif could be drawn
  *before* (i.e. underneath) later secondary/filler motifs, undercutting
  its own prominence at overlap points.

Build 001 closes exactly these gaps, reusing every existing primitive.

## Folder structure / what changed where

```
src/engine/hierarchy.ts            + ROLE_IMPORTANCE, ROLE_LAYER_PRIORITY,
                                      sortByLayerPriority, REGULAR_LATTICE_LAYOUTS
src/engine/patternPhysics.ts       NEW — Section 8, applyAttraction
src/engine/compositionIntelligence.ts
                                    extended to V2: applyGridBalanceCorrection
                                    (generalizes the old 2x2-only quadrant logic),
                                    applyNegativeSpaceCorrection (4x4 reuse),
                                    applyFlowBias (Section 5, real placement bias),
                                    extended CompositionIntelligenceParams/DEFAULT
src/engine/designModel.ts          normalizeParams clamps the new fields
src/engine/styleDna.ts             resolveStyleDna wires flowProfile/clusterStyle
                                    into the new real fields; stale comment fixed
src/engine/tile.ts                 sortByLayerPriority applied before SVG assembly;
                                    Regular Lattice layouts get only V1 fields
src/critic/visualAnalysis.ts       + detectFragmentedSilhouette (Section 9, 11th detector)
src/critic/artDirection.ts         + fragmentedSilhouette rule (honest advisory-only)
```

## Section-by-section mapping

| Brief section | What changed | Notes |
|---|---|---|
| 1. Composition Engine | Unchanged mechanism, new inputs | `clusterEngine.ts` untouched; already covers 3 layouts. Extending cluster-engine coverage to more layouts is a Recommended Next Build item, not done here (see below) |
| 2. Visual Hierarchy | `ROLE_IMPORTANCE`, `ROLE_LAYER_PRIORITY` | Formalizes 2 of the brief's 5 named dimensions; Scale/Density/Detail were already real (see hierarchy.ts's own doc comment) |
| 3. Smart Scale Engine | Unchanged | Already real (`HierarchyParams`) |
| 4. Semantic Cluster Engine | Unchanged | Already real (`clusterEngine.ts`) |
| 5. Flow Engine | `applyFlowBias` (NEW) | `flowProfile` now biases placement, not just rotation |
| 6. Negative Space Engine | `applyNegativeSpaceCorrection` (NEW) | Reuses the balance-correction mechanism at finer resolution |
| 7. Pattern Constraint System | Unchanged | Already real and configurable (`pattern-grammar/*.json`) |
| 8. Pattern Physics | `patternPhysics.ts` (NEW) | Attraction rules between hierarchy roles |
| 9. Silhouette Check | `detectFragmentedSilhouette` (NEW) | 11th Design Critic visual-analysis detector |
| 10. SVG Compatibility | Unchanged, re-verified | Already solid; full test suite re-run |
| 11-15 | Tests, performance, docs, build report | This document + `docs/*.md` |

## Pattern Physics: attraction rules

`engine/patternPhysics.ts`'s `applyAttraction(placements, tileSize,
strength)` is the brief's Section 8 in the vocabulary this engine actually
has: no botanical sub-roles (flower/leaf/bud/berry) exist anywhere in the
codebase, only the 4 hierarchy roles (hero/secondary/filler/accent)
`engine/hierarchy.ts` and `engine/scoring.ts` already understand. The
brief's "flower attracts leaves"/"berries stay near branches" examples are
implemented at the level this engine genuinely models: every placement
drifts a bounded fraction toward its **nearest strictly-more-important**
neighbor (`ROLE_IMPORTANCE`), so a filler/accent is never left with no
visual anchor nearby. Bounded to a real local radius derived from the
pattern's own median nearest-neighbor spacing (never a fixed pixel
constant) so a filler is never yanked across the whole tile toward a
distant hero. Pure, deterministic, rng-free — composes safely with every
other Composition Intelligence pass.

## Flow Engine: from rotation label to real placement bias

`applyFlowBias(placements, tileSize, profile, strength)` in
`compositionIntelligence.ts`:

- `calm` — a deliberate no-op (an even, non-directional field is what
  "calm" means).
- `directional` — nudges every placement a bounded distance toward the
  tile's own main diagonal, reading as one confident sweep.
- `dynamic` — a two-axis sinusoidal drift, a genuinely flowing wave rather
  than a straight line.

Pure and deterministic (a function of each placement's own position, never
rng) — this preserves `compositionIntelligence.ts`'s existing "never
consumes additional random draws" invariant.

## Negative Space: reusing balance correction at finer resolution

The brief names "Negative Space Engine" and "Pattern Constraint" density
ranges as separate concepts from the pre-existing quadrant-balance
correction, but the honest underlying mechanism — redistribute weight
from an overloaded region into an underloaded one — is identical at any
grid resolution. `applyBalanceCorrection`'s old 2x2-only logic
(`quadrantOf`/`reflectIntoQuadrant`) was generalized into
`applyGridBalanceCorrection(placements, tileSize, gridN, strength)`:

- `applyBalanceCorrection` = `applyGridBalanceCorrection(..., 2, ...)` —
  unchanged behavior, byte-for-byte, from V1.
- `applyNegativeSpaceCorrection` = `applyGridBalanceCorrection(..., 4,
  ...)` — the same mechanism at finer resolution catches localized holes
  a coarse 2x2 split averages into "roughly even" and misses.

The old quadrant-mirror relocation trick (`reflectIntoQuadrant`, which
only worked for exactly 2 divisions per axis) was replaced with
`moveIntoCell`, which preserves a placement's fractional position within
its own cell while relocating it into any target cell at any grid
resolution — a genuine generalization, not a special case bolted on.

## Layer Priority: hero always paints on top

`sortByLayerPriority(placements)` in `hierarchy.ts` — a stable sort by
`ROLE_LAYER_PRIORITY` (hero=3 > secondary=2 > filler=1 > accent=0),
applied in `tile.ts` right before SVG assembly. A real bug fix: before
this pass, a hierarchy-tagged hero motif could be drawn earlier in the
placement array than a later secondary/filler motif, so at an overlap
point the *lower*-priority motif painted on top — directly undercutting
the Hierarchy Engine's own `heroScale` boost. Placements with no role
(every pre-existing saved pattern) all share priority 0, so the stable
sort is a strict no-op for them — confirmed byte-identical in
`tile.test.ts`.

## Silhouette Check

`critic/visualAnalysis.ts`'s `detectFragmentedSilhouette` — the Design
Critic's 11th visual-analysis detector (Section 2 named 10; this build
adds Section 9's Silhouette Check as the 11th). Flood-fills an occupancy
grid — via the existing `engine/svgGeometry.ts`'s `gridCoverage`, reused
rather than duplicated — sized to the pattern's own real motif footprint
(`tileSize / (motifSize * 1.6)`, clamped to [4, 40]) to find connected
components of *occupied* cells (the inverse of `engine/scoring.ts`'s
dead-space check, which finds the largest connected *empty* region). A
**fixed** cell count (as the dead-space check uses) was tried first and
found empirically to be unusable here: this pattern's toroidal wrap-around
means a fixed coarse grid's occupied cells are almost always connected
regardless of real sparsity. Scaling the grid to the real motif size fixed
this — verified against real generated tiles (`airy` at default settings
genuinely flags as fragmented; `scatter`/`bouquet`/`grid` at default
settings never do).

## Regular Lattice layouts opt out — an empirically-found interaction

Before finalizing, an empirical before/after comparison (script run
against real `buildTile()` output, not synthetic data — see
`docs/PERFORMANCE.md` and `docs/BUILD_REPORT.md`) found that Composition
Intelligence V2's new passes, applied at full default strength, measurably
*hurt* `grid`, then (once `grid`/`gridMinimal` were exempted and the same
check was run against every other layout) `halfDrop`, `brick`, and
`stripe` too — their `flowCoherence` score sits near the ceiling
(85-94/100) precisely because a fully regular lattice's nearest-neighbor
chain is, by construction, about as directionally consistent as a chain
can be, and the new passes measurably eroded that (-22 to -28 points for
brick/halfDrop, -3 to -6 for stripe) rather than improving it.
`engine/hierarchy.ts`'s `REGULAR_LATTICE_LAYOUTS` set
(`grid`/`gridMinimal`/`halfDrop`/`brick`/`stripe`) is the fix:
`engine/tile.ts` strips just the new V2 fields for these layouts before
running Composition Intelligence, keeping V1's balance correction/rhythm
smoothing exactly as before (verified: byte-identical output whether or
not the V2 fields are present, for all 5 layouts). Every other layout
(organic/cluster-oriented) genuinely benefits — see the Before/After
Comparison in `docs/BUILD_REPORT.md`.

## Style DNA wiring

`engine/styleDna.ts`'s module-level scope note used to say the Cluster
Engine "doesn't exist yet" — stale since Project Phoenix V2 shipped one.
This build corrects that and genuinely wires Style DNA's `clusterStyle`/
`clusterDensity`/`flowProfile` fields into the new real levers:

- `CLUSTER_ATTRACTION_STRENGTH[clusterStyle]` (scaled by `clusterDensity`)
  feeds `compositionIntelligence.attractionStrength` — a "bouquet"/"tight"
  identity now genuinely pulls members closer together via Pattern
  Physics, not just a balance-correction proxy.
- `FLOW_BIAS_STRENGTH[flowProfile]` feeds
  `compositionIntelligence.flowBiasStrength`, alongside the `flowProfile`
  value itself — every Style DNA preset now resolves a real placement-bias
  strength, not only a rotation-jitter amount.
- `negativeSpaceStrength` scales with the style's own `negativeSpace`
  field.

## Developer guide

### Adding a new Composition Intelligence pass

Add it to `engine/compositionIntelligence.ts` as a pure, rng-free function
taking `(placements, tileSize, strength)` (or `(..., profile, strength)`
if it needs a mode), add an optional field to
`CompositionIntelligenceParams`, wire it into `applyCompositionIntelligence`
guarded by `params.yourStrength ? ... : placements` (so undefined is a
strict no-op), and add it to `DEFAULT_COMPOSITION_INTELLIGENCE` only after
confirming empirically it doesn't fight `REGULAR_LATTICE_LAYOUTS` (or add
the affected layouts to that set, as this build did for `halfDrop`/
`brick`/`stripe`).

### Adding a new Regular Lattice layout

If a future layout is a deliberately strict, evenly-spaced tiling (not
organic/cluster-based), add its id to `hierarchy.ts`'s
`REGULAR_LATTICE_LAYOUTS` — verify with the same before/after methodology
this build used (run `buildTile` with/without the V2 fields, compare
`engine/scoring.ts`'s `computeMetrics`, don't guess).

## Testing

`npx vitest run src/engine/hierarchy.test.ts src/engine/patternPhysics.test.ts
src/engine/compositionIntelligence.test.ts src/engine/tile.test.ts
src/engine/designModel.test.ts src/engine/styleDna.test.ts
src/critic/visualAnalysis.test.ts src/critic/artDirection.test.ts` runs
every test this build added or changed. The full project suite
(`npx vitest run`) passes at 127 files / 1510 tests; `npx tsc -b` and
`npm run lint` are both clean.

## Performance notes

See `docs/PERFORMANCE.md` for full numbers. Summary: generation time for
organic/cluster layouts increases roughly 1.3x-2.5x (worst case: `radial`,
whose very high instance count makes Pattern Physics' O(n²) nearest-
higher-importance-neighbor search the dominant cost); `grid`/`gridMinimal`/
`halfDrop`/`brick`/`stripe` are unaffected (exempted). SVG node count and
file size both decrease slightly (~1-3%) across the board — attraction
pulling motifs together means slightly fewer wrap-clone copies are needed
near tile edges.
