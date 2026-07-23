# Topology-Aware Cluster Placement (Build 025, Phase 4)

**Status: implemented, tested, measured — reachable only via the disabled
`luxuryComposition` flag.** See `BUILD_025_AUDIT.md`.

## What existed before this build

`clusterEngine.ts`'s `generateCluster` places supporting members via a
per-archetype offset formula relative to the anchor — real, but with no
concept of a distinct "secondary mass" or "satellite" anchor with its own
guaranteed-connected position independent of the cluster's own internal
geometry. Cross-unit distance was governed only by `placeClusterAnchors`'s
whole-tile scatter.

## What this build adds

`engine/topologyPlacement.ts`'s `buildLuxuryUnit(primary, unitIndex, profile,
tileSize, baseRadius, rng)` builds one bouquet unit's full anchor set:

1. **The primary hero** — always exactly one `massRole: 'primaryHero'`
   anchor per unit (verified by a unit test), at the unit's own scattered
   position.
2. **Secondary anchors** — `profile.secondaryAnchorCount` of them (drawn
   within the profile's own declared range), placed via
   `placeMassSecondaries()` at a distance from the primary drawn from a
   discrete `DIST_RHYTHM_FRACTIONS = [1.0, 0.62, 0.82, 0.45]` cycle (mirroring
   `clusterEngine.ts`'s `SIZE_RHYTHM` convention — a small recurring set of
   distances reads as an intentional rhythm to `engine/scoring.ts`'s
   `rhythmRegularity`, not a continuous random draw, which measurably
   collapsed that metric during this build's own tuning — see
   `BUILD_025_AUDIT.md`'s development history), bounded between
   `profile.minSecondaryDistanceMul` and `profile.maxSecondaryDistanceMul`
   times `baseRadius * primary.sizeMul` — always within plausible botanical
   reach, never a stray far-flung anchor (a unit test asserts every
   secondary lands within `maxSecondaryDistanceMul * 1.15` of the primary,
   wraparound-aware).
3. **An optional secondary hub** (`dualMassConnected` only) — one
   `massRole: 'secondaryHero'` anchor, itself with its own small ring of
   secondaries, giving that profile a genuine two-mass composition. Every
   other profile produces zero `secondaryHero` anchors (verified by a unit
   test).
4. **Satellites** — exactly `profile.allowedSatellites` small accent anchors
   (verified exact-count by a unit test) at the profile's own bounded reach.

Every anchor carries `{x, y, sizeMul, massRole, unitIndex}` — `unitIndex`
lets `heroDominanceEngine.ts` and the orchestrator group anchors back to
their own unit even after all units' anchors are flattened into one array
for Hero Dominance.

## Determinism

`buildLuxuryUnit` is a pure function of its rng stream — given the same seed
and inputs it produces byte-identical anchor arrays (verified by a unit
test comparing two calls with freshly-seeded but identical RNGs).

## Where this is used

Only by `engine/luxuryFloralCompositionEngine.ts`'s orchestrator, itself
only reachable via `params.luxuryComposition`. See
`docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md` for the full pipeline and why the
feature ships disabled.
