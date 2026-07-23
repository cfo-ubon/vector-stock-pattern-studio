# Depth-Layering Engine (Build 024, Phase 6)

## What existed before this build

`engine/depthEngine.ts`'s `applyDepthColorShift` blends filler/accent motifs'
own fill colors toward the background color when a style opts into
`depthStrength` — a color TREATMENT, not a layering system. Paint order was a
flat 4-value table (`engine/hierarchy.ts`'s `ROLE_LAYER_PRIORITY`:
hero=3/secondary=2/filler=1/accent=0). There was no concept of named depth
planes and no depth diagnostics anywhere in the codebase, despite Build 010's
historical section being named "Multi-layer Depth Engine."

## What this build adds

`engine/depthLayers.ts` assigns every placement one of 7 named planes,
back-to-front:

1. `background` — placements with no hierarchy role (lattice layouts exempt
   from the Hierarchy Engine — nothing to layer).
2. `farBackFoliage` — small filler/accent instances, or filler far from its
   own cluster anchor (ambient background texture).
3. `rearBranches` — accent instances belonging to a cluster but sitting away
   from the anchor (peripheral connector-adjacent detail).
4. `secondaryFlowers` — the hierarchy's `secondary` role.
5. `heroFlowers` — the hierarchy's `hero` role.
6. `foregroundLeaves` — large filler instances close to their cluster anchor
   (foliage reading as support right around the hero).
7. `accentDetails` — small accent instances (fine detail, painted last).

The assignment uses only fields `Placement` already carries (`role`, `scale`,
`clusterId`, `clusterAnchorX/Y`, `x`/`y`) — no new generation-time state, no
RNG, fully deterministic from a tile's own real geometry.

### Where it hooks in

`engine/tile.ts` builds every motif's SVG node in ONE canonical order
(`sortByLayerPriority`'s output) — that array is what the shared, sequential
`rng` is consumed in, and what Section 10's node-budget thinning selects
from. The Depth-Layering Engine does **not** touch that order. Instead, after
thinning has fully resolved which placements survive
(`survivingPlacements`), the ALREADY-BUILT `finalMotifGroups` array is
re-ordered to match `assignDepthLayers(survivingPlacements, tileSize)`'s
plane order — a pure paint-order permutation of existing SVG nodes, applied
after every RNG draw and every thinning decision has already happened.

An earlier version of this engine reordered placements BEFORE generation
instead. That measurably changed which RNG values landed on which
placement (a reordered array consumed by a sequential RNG generator
produces different content), which in turn changed
`botanicalBeautyMetrics.ts`'s `botanicalComplexity` score for premiumHero
tiles — an unintended side effect on an unrelated existing invariant,
caught by `botanicalBeautyMetrics.test.ts`'s own on/off regression test.
The current design (reorder only the final SVG nodes, after generation and
thinning are complete) has no such side effect.

Gated on `params.premiumHero && artDirectionModel.depthPlan !== 'flat'` —
the same premiumHero/heroFocus presets that opt into the Premium Hero
Builder. Every other style's tile is byte-identical to before this build.

## Diagnostics

`computeDepthDiagnostics(placements, tileSize, motifSize)` returns:

- `layerCount` — how many of the 7 planes actually have an instance.
- `overlapDepth` — average number of OTHER planes overlapping the hero's own
  bounding circle.
- `heroOcclusionRatio` — fraction of the hero's own area covered by
  foreground-plane instances (real occlusion, a stronger depth cue than
  color alone).
- `foregroundFramingScore` — fraction of the tile's 4 corner quadrants that
  contain a foreground-plane instance.
- `rearLayerVisibility` — fraction of rear-plane instances NOT majority-
  occluded by anything closer (some rear visibility is needed for depth to
  read at all).
- `flattenedCompositionRisk` — true when 2 or fewer planes are present.

Attached to `TileData.depthDiagnostics`, undefined for every tile that
doesn't opt into real depth.

## Tests

`engine/depthLayers.test.ts` — 9 tests covering plane assignment for each
role/geometry combination, paint-order guarantees (hero always last), and
the diagnostics on edge cases (empty tile, single-plane composition,
occlusion detection).
