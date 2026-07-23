# Wrap-Aware Cohesion (Build 025, Phase 7)

**Status: implemented and unit-tested — NOT wired into generation or
connector scoring, and NOT empirically benchmarked.** This is the one
Build 025 module that remains purely available infrastructure, disclosed
honestly rather than presented as integrated.

## The problem this module addresses

A repeating tile wraps seamlessly, so a cluster whose members straddle the
left/right or top/bottom seam can visually "continue" across the repeat
boundary the same way a single cluster's own members read as connected
within one tile. A naive check — "do these two clusters' bounding boxes
overlap once you shift one by `tileSize`?" — produces two kinds of error:

- **False positives**: two clusters can have wrap-overlapping bounding boxes
  while their actual members sit nowhere near each other once the wrap
  offset is undone.
- **False negatives**: a cluster that DOES continue naturally across the
  seam can fail a same-cluster-id check if thinning happened to keep members
  on only one side.

## What this module does

`engine/wrapCohesion.ts`'s `computeWrapCohesion(placements, tileSize,
connectThreshold)` measures the REAL minimum member-to-member distance
across each wrap axis (left-right, top-bottom, and corner), not a bounding-
box heuristic:

1. Groups placements by cluster (`bouquetSpatialGraph.ts`'s
   `groupByCluster`).
2. For every cluster PAIR whose anchors sit near opposite edges on a given
   axis (`EDGE_BAND_FRACTION = 0.12` of the tile), computes the real
   minimum distance between the two clusters' actual members after undoing
   that axis's wrap offset (`minWrappedMemberDistance`).
3. Reports `leftRightContinuity`/`topBottomContinuity`/`cornerContinuity`
   (booleans — is there at least one genuinely-connected pair across that
   seam) and `falsePositiveWrapPairs` (a count of pairs whose bounding boxes
   looked wrap-connected but whose real distance was too large — the
   specific failure mode this module exists to catch, verified directly by
   a unit test constructing that exact scenario).

Unit tests confirm: a genuinely close cross-seam pair is detected as
continuity with zero false positives; a bbox-only "looks connected" pair is
correctly rejected and counted as a false positive instead; a corner-only
continuity case is distinguished from the per-axis checks (and correctly
increments 2 false positives from the naive per-axis view of the same
pair); a single-cluster tile reports no continuity and no false positives.

## Why it isn't wired in yet

The design intention (documented in the module's own header comment) was to
inform Connector Quality's scoring for edge-crossing bridges — a connector
that closes a real wrap-seam gap should score differently than one that
doesn't. That wiring was not implemented in this build, and no benchmark
exists yet measuring its effect on any metric. A future build that revisits
Luxury Floral composition (see `BUILD_025_AUDIT.md`'s recommended next
steps) has a real, tested module ready to integrate rather than needing to
build this measurement from scratch.
