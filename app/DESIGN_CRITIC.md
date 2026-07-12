# Design Critic & Art Direction Engine — Phase 7

Developer documentation for the Design Critic (`src/critic/`): the module
that reviews an already-generated tile the way an experienced surface
pattern designer would, and turns that review into measurable scores,
named problems, and — where a real spec field exists to change — concrete
recommendations a designer (or the Improvement Loop) can apply.

**The Design Critic never generates artwork.** Every module in
`src/critic/` only reads already-real, already-computed data: a
`DesignSpecification`, a rendered `TileData`, `CompositionMetrics`
(`engine/scoring.ts`), a `DesignSpecQualityReport`
(`trend/designSpecQuality.ts`), and the Design Knowledge Engine
(`src/knowledge/`, Phase 6.5) where a rule needs grounding in real style
data. It evaluates and recommends; it never renders a shape.

## Contents

1. [Why a critic, not a second scorer](#why-a-critic-not-a-second-scorer)
2. [Folder structure](#folder-structure)
3. [Section-by-section mapping](#section-by-section-mapping)
4. [The Improvement Loop](#the-improvement-loop)
5. [The Quality Gate](#the-quality-gate)
6. [UI wiring](#ui-wiring)
7. [Developer guide](#developer-guide)
8. [Testing](#testing)
9. [Performance notes](#performance-notes)

## Why a critic, not a second scorer

An audit before writing any code found that most of the brief's "measurable
design principles" already existed as real, tested scoring logic:

| Brief concept | Already lived in |
|---|---|
| Composition/Hierarchy/Balance/Rhythm/Flow/Negative Space/Overlap/Repeat Quality/Motif Diversity/Commercial Readiness scores | `trend/designSpecQuality.ts`'s `DesignSpecQualityReport` (12 fields) |
| Measurable penalty system (19 named rules, exact point values) | `engine/scoring.ts`'s `SOFT_PENALTY_RULES` / `applySoftPenalties` |
| Cluster Quality | `engine/scoring.ts`'s `CompositionMetrics.clusterCohesion` |
| Collection-level consistency scoring | `collection/collectionScore.ts`'s `computeCollectionScore` |
| Per-instance geometry (position/rotation/scale) | `engine/svgGeometry.ts`'s `extractInstances` |

Given the brief's own "do not redesign previous engines" constraint, the
Design Critic is a thin **evaluation and recommendation layer** on top of
this real scoring stack, not a second implementation of it:

- `designCritique.ts` **reshapes** an existing `DesignSpecQualityReport` +
  `CompositionMetrics` into the brief's own named 11-dimension shape — it
  computes nothing.
- `problems.ts` **filters** the existing `SOFT_PENALTY_RULES` — it adds no
  new penalty logic, only severity banding (`high`/`medium`/`low`).
- `visualAnalysis.ts` reuses 7 of its 10 detectors' thresholds directly
  from the same `CompositionMetrics` fields the penalty rules already
  check; only 3 detectors (`detectCrowdedAreas`, `detectRepeatedRotation`,
  `detectRepeatedScale`) are genuinely new, and all three are built
  directly on the real per-instance geometry from `extractInstances` —
  none analyze pixels or re-render anything.
- `collectionCritic.ts` **wraps** `computeCollectionScore` unchanged; its
  Thai-language `issues` strings are passed through verbatim, never
  translated or regenerated.

The two places this phase adds genuinely new logic are the Art Direction
Engine's recommendation rules (Section 4) and the spec-mutating
Improvement Loop (Section 8) — both documented below.

## Folder structure

```
src/critic/
  designCritique.ts    Section 1 — 11-dimension DesignCritique, reshaped
                         from DesignSpecQualityReport + CompositionMetrics
  visualAnalysis.ts     Section 2 — 10 detectors (7 threshold-reused, 3 new)
  problems.ts           Section 3 — severity-banded filter over the real
                         SOFT_PENALTY_RULES
  artDirection.ts       Section 4 — one recommendation rule per visual
                         issue id; only proposes a specPatch when a real
                         DesignSpecification field lever exists
  styleCoach.ts         Section 5 — 7 categories, grounded in real
                         knowledge/style records via id/family matching
  collectionCritic.ts   Section 6 — thin wrap of collection/collectionScore.ts
  designReport.ts        Section 7 — aggregates Sections 1-5 into one
                         DesignReport (Problems/Recommendations/Expected
                         Improvements/Priority)
  improvementLoop.ts     Section 8 — the only module that mutates a spec;
                         Evaluate -> Recommend -> Patch -> Re-generate ->
                         Evaluate Again, up to maxRounds
  qualityGate.ts          Commercial quality gate — passed/blockingProblems
  index.ts                Barrel (export * as X from './x')
```

## Section-by-section mapping

| Brief section | Module | Notes |
|---|---|---|
| 1. Design Critic | `designCritique.ts` | 11 named dimensions + `overall` |
| 2. Visual Analysis | `visualAnalysis.ts` | `detectVisualIssues(tile, metrics)` |
| 3. Penalty System | `problems.ts` | `detectProblems(metrics)`, sorted points-desc |
| 4. Art Direction Engine | `artDirection.ts` | `buildArtDirectionRecommendations(spec, visualIssues)` |
| 5. Style Coach | `styleCoach.ts` | `buildStyleCoachNotes(spec, category?)` |
| 6. Collection Critic | `collectionCritic.ts` | `critiqueCollection(collection)` |
| 7. Design Report | `designReport.ts` | `buildDesignReport(...)` |
| 8. Improvement Loop | `improvementLoop.ts` | `runImprovementLoop(spec, seed, maxRounds, category?)` |
| Quality gate | `qualityGate.ts` | `checkQualityGate(report)` |

## The Improvement Loop

`runImprovementLoop` is the one place in this phase that patches a
`DesignSpecification`. Each round:

1. Renders one real candidate via `runDesignSpecQualityLoop(spec, seed,
   'fast', 1)` (the existing Quality Loop, unchanged — never
   reimplemented) and builds a `DesignReport` from the result.
2. If `report.meetsCommercialBar` is already true, stops — no unnecessary
   patch.
3. Otherwise takes the top-priority recommendation that has a real
   `specPatch` and applies it (`{ ...spec, ...patch }`), then re-seeds
   (`deriveSeed`) for the next round.

Two behaviors were only found by testing against real generated tiles, not
synthetic fixtures, and are worth knowing if you touch this file:

- **A rhythm-only patch cannot fix a grid-appearance problem when
  `repeatType` is `'grid'`/`'gridMinimal'`** — those layouts place
  instances on a strict axis-aligned lattice by construction, independent
  of rhythm. `isStrictGridLayout` + `buildRhythmOrLayoutPatch` also swap
  `repeatType: 'scatter'` in that case.
- **A patch can blow the Candidate Engine's node-count budget**, which
  makes every candidate in the next round hard-reject (`pool.winner.score
  === -1`). `runImprovementLoop` guards against ever returning a round
  built on a rejected winner (`round > 0 && loopResult.pool.winner.rejected
  -> break`); round 0 is always kept even if rejected, so the loop never
  returns zero rounds.

## The Quality Gate

`checkQualityGate(report)` fails when any of:

- `report.meetsCommercialBar` is `false` (the spec's own `qualityTargets`
  weren't met), or
- at least one `severity: 'high'` problem is present, or
- `report.critique.overall < 50`.

It does not fail on medium/low-severity problems alone — those are
surfaced but non-blocking.

### Where it's wired

Per the brief's "must become the quality gate before any artwork proceeds
to SEO, export, or marketplace preparation," `LivePreviewPanel.tsx` builds
the same gate from the same `qualityResult` the Quality Panel and the
Design Critic panel already share (never recomputed independently) and
wraps both **"📦 Download Marketplace Package"** and **"🏭 Generate
Collection"** behind it: if the gate fails, a `window.confirm` explains
why and the designer can still proceed — the gate warns, it doesn't lock
the app. If no quality result has been computed yet, both actions proceed
ungated, exactly as before this phase (there's nothing to gate on).

## UI wiring

`components/workbench/DesignCriticPanel.tsx` is a new dockable panel
(`critic` in `workbench/workspaceSettings.ts`'s `RightPanelId`,
lazy-loaded like every other Phase 6 panel). It builds one `DesignReport`
from the same `qualityResult` the Quality Panel already computes and
renders: the gate banner, the 11-dimension Design Critique grid, Visual
Analysis, Problems, Recommendations (each with an "Apply" button when a
real `specPatch` exists, "Advisory only" otherwise), a Style Coach
category picker, an Improvement Loop runner with an "Apply Final Spec"
button, and a Collection Critic section for the active Project's most
recently generated collection.

## Developer guide

### Adding a new visual-analysis detector

1. Add the id to `VisualIssueId` in `visualAnalysis.ts` and a detector
   function built on `extractInstances`/`CompositionMetrics` — never on
   raw pixels.
2. Add a matching entry to `ART_DIRECTION_RULES` in `artDirection.ts`. If
   there's a real `DesignSpecification` field that plausibly fixes it,
   return a `specPatch`; if not, leave `specPatch: undefined` and say so
   in the rationale — never fabricate a patch to a field that doesn't
   exist.
3. If the recommendation should show up in a report's "Expected
   Improvements," add its id to `designReport.ts`'s
   `RECOMMENDATION_DIMENSION` map.

### Adding a Style Coach category

Add to `StyleCoachCategory` and `CATEGORY_MATCHERS` in `styleCoach.ts`,
matched against real `knowledge/style` records (id/label regex, or a
`preferredMotifFamilies` check) — never a hand-written style description
disconnected from real Style DNA data.

## Testing

`npx vitest run src/critic` runs all pure-logic module tests. Component
coverage for the UI lives in
`components/workbench/DesignCriticPanel.test.tsx` and the gate-wiring
tests in `components/workbench/LivePreviewPanel.test.tsx`.

## Performance notes

`runImprovementLoop`'s tests are the slowest in the suite (each round
renders a real candidate pool via the existing Quality Loop) — expect
`improvementLoop.test.ts` alone to take tens of seconds. Every other
critic module is pure, synchronous, and operates on already-rendered data,
so `designCritique`/`visualAnalysis`/`problems`/`artDirection`/
`styleCoach`/`collectionCritic`/`designReport`/`qualityGate` all run in
well under a millisecond per call.
