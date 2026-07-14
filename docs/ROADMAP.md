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

## Recommended Next Build

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

## Explicitly out of scope (per the brief, and still true)

Marketplace, SEO, AI Integration, Collection Builder, Prompt System, and
Batch Production changes are unrelated to composition quality and belong
to whichever future build actually needs them — nothing in this roadmap
should be read as smuggling those in.
