# Changelog

Build-numbered technical changelog for the rendering engine. Distinct
from `docs/USER_GUIDE.md`'s Thai, feature-facing changelog (versioned
`v1.x`, aimed at the app's end users) — this file tracks engine-internal
builds aimed at contributors and reviewers.

---

## Build 001 — Composition Intelligence Foundation V2

**Goal**: dramatically improve generated-pattern visual quality (target:
6-8/10 -> 8-9/10) without adding new features, panels, or generators.

### Added

- `src/engine/patternPhysics.ts` (new module) — `applyAttraction`, a
  deterministic role-based attraction pass (Section 8, Pattern Physics).
- `engine/hierarchy.ts`: `ROLE_IMPORTANCE`, `ROLE_LAYER_PRIORITY`,
  `sortByLayerPriority`, `REGULAR_LATTICE_LAYOUTS`.
- `engine/compositionIntelligence.ts`: `applyGridBalanceCorrection`
  (generalizes the old quadrant-only balance correction),
  `applyNegativeSpaceCorrection`, `applyFlowBias`, 4 new optional
  `CompositionIntelligenceParams` fields.
- `critic/visualAnalysis.ts`: `detectFragmentedSilhouette` — the 11th
  Design Critic visual-analysis detector (Section 9, Silhouette Check).
- `critic/artDirection.ts`: `fragmentedSilhouette` recommendation rule.

### Changed

- `engine/tile.ts`: applies `sortByLayerPriority` before SVG assembly
  (hero now always paints on top); strips the new V2 Composition
  Intelligence fields for `REGULAR_LATTICE_LAYOUTS`.
- `engine/styleDna.ts`: `resolveStyleDna` now wires `clusterStyle`/
  `clusterDensity`/`flowProfile` into real `attractionStrength`/
  `flowBiasStrength`/`negativeSpaceStrength` values; corrected a stale
  module comment describing the Cluster Engine as not yet existing.
- `engine/designModel.ts`: `normalizeParams` clamps the 4 new
  `compositionIntelligence` fields.
- `DEFAULT_COMPOSITION_INTELLIGENCE` now includes non-zero defaults for
  `attractionStrength`, `negativeSpaceStrength`, `flowProfile`
  (`'directional'`), and `flowBiasStrength` — every new "Generate" now
  produces measurably different (see `docs/PERFORMANCE.md`), intentionally
  improved output for every non-Regular-Lattice layout. Patterns saved
  before this build (with their own literal `compositionIntelligence`
  object recorded, lacking these fields) are completely unaffected —
  confirmed via `tile.test.ts`'s backward-compatibility tests.

### Fixed

- A real, previously-latent paint-order bug: a hierarchy-tagged hero motif
  could be drawn (and therefore visually buried) underneath a
  later-generated secondary/filler motif at an overlap point, undercutting
  the Hierarchy Engine's own `heroScale` boost.
- `engine/compositionIntelligence.ts`'s private `shortestOffset` helper
  duplicated `engine/svgGeometry.ts`'s already-exported `periodicOffset` —
  removed the duplicate, now imports and reuses the canonical one.

### Tests

~48 new tests across `engine/hierarchy.test.ts`,
`engine/patternPhysics.test.ts` (new file),
`engine/compositionIntelligence.test.ts`, `engine/designModel.test.ts`,
`engine/styleDna.test.ts`, `engine/tile.test.ts`,
`critic/visualAnalysis.test.ts`, `critic/artDirection.test.ts`. Full
project suite: 127 files / 1510 tests passing.

### Documentation

`app/COMPOSITION_ENGINE_V2.md` (new developer doc),
`docs/BUILD_REPORT.md`, `docs/DESIGN_DECISIONS.md`,
`docs/KNOWN_ISSUES.md`, `docs/PERFORMANCE.md`, `docs/ROADMAP.md` (all
new), plus `app/README.md` summary section and
`docs/USER_GUIDE.md` Thai changelog (v1.48).
