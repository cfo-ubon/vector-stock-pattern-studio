# Build 014 Audit — Motif Relationship Intelligence Engine

Read before writing any code: `docs/build_reports/BUILD_013_REPORT.md`,
`docs/build_reports/BUILD_013_METRICS.json`, `docs/build_reports/BUILD_013_AUDIT.md`,
`src/engine/scoring.ts` (`computeOverlapQuality`, the `zeroMotifOverlap` rule),
`src/engine/clusterEngine.ts` (`generateCluster`, `archetypeOffset`, the dormant
Cluster Stem Engine), `src/layouts/sCurve.ts`, `src/style-dna/darkBotanical.json`,
`src/style-dna/editorialBotanical.json`.

## Section 1 — Root Cause

### What Build 013 measured

Build 013's `zeroMotifOverlap` finding was the single highest-lift bottom-decile
failure mode (9.13x lift, 44/502 bottom-decile patterns, `High` confidence).
Build 013's own recommendation text (`src/portfolio/recommendations.ts`) read
this as "Allow controlled motif overlap for depth" — taken directly from the
penalty rule's label without re-measuring the actual geometry. **This audit
found that recommendation was wrong about the direction of the fix**, which is
exactly what a real Phase A evidence audit is for.

### Where `zeroMotifOverlap` actually fires

Re-querying the full 5,000-pattern raw manifest (`BUILD_013_portfolio_raw.json`,
kept locally per Build 013's own gitignore policy) for every pattern carrying
`zeroMotifOverlap` in `failureModes`:

- **48 of 5,000 patterns affected** (not exactly the 44 Build 013 sampled in
  its bottom-decile discovery pass — that pass only covered the bottom decile;
  48 is the full-portfolio count).
- **100% use `layoutId: 'sCurve'`** — every single affected pattern, no
  exceptions.
- **100% use `layoutClass: 'organic'`**.
- **`styleDnaId`: darkBotanical (38), editorialBotanical (10)** — the only two
  presets that declare `sCurve` in their `layouts` array
  (`darkBotanical.json`/`editorialBotanical.json` — confirmed no other preset
  lists `sCurve`, so `sCurve` patterns can only ever come from these two).
- **`productTarget`: fabric (38), greetingCard (10)** — a direct consequence
  of which presets are affected, not an independent product-level cause.
- Of 323 total `sCurve`-layout patterns in the portfolio (162 darkBotanical +
  161 editorialBotanical), 48 crossed the `overlapQuality <= 25` threshold
  (23% of darkBotanical's sCurve patterns, 6% of editorialBotanical's) — this
  is RNG-draw-dependent, not deterministic on style/layout alone.

### The scoring mechanism being measured

`computeOverlapQuality` (`src/engine/scoring.ts`) computes `crowding =
footprint / meanNearestNeighborDistance`, where `footprint = motifSize *
meanScale`. The score is a **U-shaped** function of `crowding`:

- `crowding < 0.25` (idealLow): scored low — "too sparse, isolated stickers."
- `0.25 <= crowding <= 0.95`: scored 100 — the "ideal" band.
- `crowding > 0.95` (idealHigh): scored low — "too much pileup."

The `zeroMotifOverlap` penalty rule fires whenever the resulting score is
`<= 25`, from **either** side of this U-shape. Its label ("motifs never
overlap at all — reads as isolated stickers") only describes the low-crowding
side.

### What is actually happening, measured directly

Regenerating all 48 affected patterns from their real deterministic seeds
(`buildPortfolioParams` + `buildTileWithHeroRetry`, the same pipeline Build
013 used) and recomputing `crowding` from the real placed instances:

```
tooDense (crowding > 0.95):  48 / 48
tooSparse (crowding < 0.25):  0 / 48
mean crowding: 1.93   min: 1.78   max: 2.40
```

**Every single affected pattern is on the "too much pileup" side of the
U-shape, not the "too sparse" side the rule's label describes.** Build 013's
recommendation ("allow controlled overlap for depth") would have made this
measurably worse — crowding is already 1.9-2.4x the ideal ceiling; adding
more overlap pushes further past it, lowering the score further.

Visual inspection (rendered SVG, 2x2 tile repeat) of both affected and
unaffected `sCurve` patterns shows the real, human-visible defect is neither
"chaotic pileup" nor "isolated stickers" in the colloquial sense but a
**specific geometric artifact**: small, tight clusters of 3-5 motifs are
scattered across a large, mostly-empty tile — visually reading as scattered
sprigs rather than a continuous flowing vine (which is `sCurve`'s own design
intent — "S-Curve Botanical", a serpentine vine). This matches the *intent*
behind the rule's label ("isolated ... not a composed pattern") even though
the *mechanism* the metric is measuring is a crowding artifact within each
tiny cluster, not inter-cluster distance.

### The precise, mathematically-verified mechanism

`archetypeOffset`'s `'sCurve'` case (`src/engine/clusterEngine.ts`, ~line 185):

```ts
case 'sCurve': {
  const tt = (i + 1) / (total + 1);
  const dx = (tt - 0.5) * r * 2.3 + rngRange(rng, -r * 0.12, r * 0.12);
  const dy = Math.sin(tt * Math.PI * 2) * r * 0.65 + rngRange(rng, -r * 0.12, r * 0.12);
  return { dx, dy, role: roleFor(t) };
}
```

For any **odd** `total` (non-hero member count), one member's index produces
`tt === 0.5` exactly. At `tt = 0.5`: `dx = (0.5 - 0.5) * r * 2.3 = 0` and
`dy = sin(0.5 * 2π) * r * 0.65 = sin(π) * r * 0.65 = 0` (verified directly:
`dx=0.0, dy≈8e-17`, floating-point zero). **That member's raw offset is
mathematically coincident with the hero's own position (0,0)** — before the
small `±0.12r` jitter is added, which only nudges it a little, not enough to
create a real, deliberate-looking separation.

`sCurve.ts` rolls `memberCount: rngInt(rng, 3, 5)` — i.e. **2 of the 3
possible values (3 and 5) are odd**, so roughly two-thirds of every generated
cluster contains this degenerate near-hero member. Across a typical `sCurve`
tile (2-3 curves x ~5-7 anchors each = 15-20 clusters), this produces roughly
one near-zero-distance instance pair *per cluster*, systematically dragging
the tile's mean nearest-neighbor distance down — which is exactly what
inflates `crowding` (a small denominator) regardless of how sparse the
clusters actually are relative to *each other*. Confirmed directly: the
sorted nearest-neighbor distance list for one affected tile begins `[1, 1, 4,
4, 4, 4, 5, 5, 6, 6, 7, 7, ...]` — a cluster of near-zero pairs dragging the
mean well below what the tile's real, visible spacing would suggest.

**This is the root cause**: a formula artifact in the `'sCurve'` cluster
archetype (not a deliberate design choice — `evaluateCluster`'s own
`hasOverlap`/`cohesion` logic already treats overlap as something to
*curate*, 30% of members via a real "overlap band," never to produce by
mathematical accident) that places one member virtually on top of the hero
whenever the archetype rolls an odd member count. It looks like a rendering
glitch (two motifs stacked at the same point), not deliberate botanical
attachment, and it is what pulls `overlapQuality` into the false "too much
pileup" reading even on tiles that are, if anything, too sparse overall.

## Section 2 — Affected Subsystems

- **`src/engine/clusterEngine.ts`**: `archetypeOffset`'s `'sCurve'` case is
  the exact, sole site of the bug. No other archetype (`bouquet`, `cascade`,
  `radial`, `editorial`, `organicScatter`, `diagonal`, `asymmetric`, `airy`,
  `sprayBouquet`, `wildCluster`, `cornerCluster`, `branchCluster`) has a
  formula that reaches `(0, 0)` for any member index — verified by inspecting
  every case's dx/dy formula; none other has a `sin(tt * 2π)` term crossing
  zero at the same `tt` its own radial term also crosses zero.
- **`src/layouts/sCurve.ts`**: the only layout that requests the `'sCurve'`
  cluster archetype (`generateCluster('sCurve', ...)`), and the only layout
  where `memberCount` is deliberately rolled from a range containing 2 odd
  values out of 3 (`rngInt(rng, 3, 5)`).
- **Also relevant, currently dormant**: `src/engine/clusterEngine.ts`'s own
  Build 004 Section 6 "Cluster Stem Engine" (`buildClusterStem` and friends,
  `StemTopology`, `buildYSplit`/`buildBranching`/`buildDoubleBranch`) — real,
  already-implemented connective-stem geometry (Catmull-Rom smoothed paths
  from a cluster's hero to its members) that was explicitly never wired into
  `tile.ts`'s rendering pipeline. Not the root cause of `zeroMotifOverlap`
  (it affects visual appearance, not instance positions the metric reads),
  but directly relevant to the brief's "Stem Continuity"/"Botanical
  Attachment" examples — see Section 3 (Architecture) for how Build 014 uses
  it as a complementary, non-metric-affecting visual improvement.

## Section 3 — Affected Presets, Products, Layouts

- **Presets**: `darkBotanical`, `editorialBotanical` — the only two presets
  that declare `sCurve` in their layout pool. No other preset is affected or
  needs any change.
- **Products**: `fabric`, `greetingCard` — downstream of which presets are
  affected, not an independent cause; no product-targeting logic needs
  changing.
- **Layouts**: `sCurve` exclusively. Every other layout (grid, brick, radial,
  scatter, half-drop, bouquet, cascade, heroFlow, heroScatter, densePremium,
  airy, toss, stripe, gridMinimal — the full `LayoutId` set) is unaffected
  and must not change.

## Section 4 — What Build 014 Must NOT Touch

Per the brief and consistent with Build 012/013's own precedent:

- `engine/scoring.ts`'s `computeOverlapQuality`/`zeroMotifOverlap` rule
  definition, and every other `SOFT_PENALTY_RULES`/`PENALTY_RULES_V2` entry —
  the metric stays exactly as-is; Build 014 fixes the *generation* that feeds
  it, never the measurement.
- `src/portfolio/*` (Portfolio Intelligence, Build 013) — read-only consumer
  of the fixed generation, not modified.
- Every Style DNA preset file, every botanical species/family definition —
  no new species, no new presets.
- Every layout other than `sCurve`, and every cluster archetype other than
  `'sCurve'`.

## Section 5 — Reuse Plan (Phase B preview)

The fix lives entirely inside `archetypeOffset`'s existing `'sCurve'` case in
`src/engine/clusterEngine.ts` — the single function every layout's cluster
generation already funnels through (`generateCluster`). No new module, no
new engine, no duplicated placement logic. A minimum-radial-distance guard
prevents the degenerate `tt === 0.5` case from landing at/near `(0, 0)` while
preserving the archetype's own vine-shaped identity (members still trace the
sine curve; only the one degenerate point is pushed to a real, visible
offset). Optionally, Section 3's dormant Cluster Stem Engine is wired into
`sCurve.ts`'s own placements as a visual "Stem Continuity" complement (real,
already-built connective geometry, currently unused) — this does not change
instance positions and therefore cannot move `overlapQuality`, but directly
answers the brief's "Botanical Attachment"/"Stem Continuity" examples and the
commercial mission statement.
