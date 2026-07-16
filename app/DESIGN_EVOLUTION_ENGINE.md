# Design Evolution Engine — Phase 8

Developer documentation for the Design Evolution Engine (DEE): the
genetic-algorithm-style layer under `src/evolution/` that generates a
population of Design Specification variants from one starting spec,
scores them with the real Design Critic, and evolves that population
across generations toward higher measurable quality.

**This phase never generates artwork or scores anything itself.** Every
render comes from the real SVG Intelligence Engine
(`trend/designSpecQuality.ts`'s `runDesignSpecQualityLoop`), every score
comes from the real Design Critic (`critic/designReport.ts` +
`critic/qualityGate.ts`, Phase 7), and every lineage diff comes from the
real Workbench diff utility (`workbench/jsonDiff.ts`'s `diffJson`) — this
phase only adds the population/generation search loop around them.

## Contents

1. [Why a search loop, not a new scorer](#why-a-search-loop-not-a-new-scorer)
2. [Folder structure](#folder-structure)
3. [Section-by-section mapping](#section-by-section-mapping)
4. [The Mutation Engine's 6 levers](#the-mutation-engines-6-levers)
5. [The Crossover Engine's 4 trait groups](#the-crossover-engines-4-trait-groups)
6. [Design DNA](#design-dna)
7. [Genuine convergence, empirically verified](#genuine-convergence-empirically-verified)
8. [UI wiring](#ui-wiring)
9. [Developer guide](#developer-guide)
10. [Testing](#testing)
11. [Performance notes](#performance-notes)

## Why a search loop, not a new scorer

An audit before writing any code confirmed every piece DEE needs already
existed as real, tested logic:

| Brief concept | Already lived in |
|---|---|
| Rendering a candidate from a spec | `trend/designSpecQuality.ts`'s `runDesignSpecQualityLoop` (`engine/candidateEngine.ts` underneath) |
| Scoring a candidate | `critic/designReport.ts`'s `buildDesignReport` (11-dimension Design Critique) |
| Commercial pass/fail | `critic/qualityGate.ts`'s `checkQualityGate` |
| Field-level diff between two specs | `workbench/jsonDiff.ts`'s `diffJson` |
| Reproducible per-candidate seeding | `engine/candidateEngine.ts`'s `deriveSeed` |
| Real Hierarchy Presets to mutate between | `engine/hierarchy.ts`'s `HIERARCHY_PRESETS` |

Nothing above was redesigned. `src/evolution/` is the population/
generation search loop that was genuinely missing: every prior engine
operates on *one* spec at a time (or, for the Quality Loop, re-renders the
*same* spec with a new seed) — nothing before this phase mutated,
crossed over, selected among, or evolved *multiple spec-level variants*
of a Design Specification.

## Folder structure

```
src/evolution/
  types.ts               Section 8 — Design DNA + every shared type
  candidateGenerator.ts   Section 1 — generateInitialPopulation(seedSpec, seed, count)
  mutationEngine.ts       Section 2 — 6 named mutation operators
  crossoverEngine.ts      Section 3 — 4 named trait-group crossover
  fitnessEvaluation.ts    Section 4 — evaluateFitness via the real Design Critic
  selectionStrategy.ts    Section 5 — elitist / tournament / rouletteWheel
  diversityControl.ts     Section 6 — diffJson-based distance + pruning
  evolutionTimeline.ts    Section 7 — recordGeneration / compareGenerations
  stoppingConditions.ts   Section 9 — quality threshold / max generations / budget
  evolutionEngine.ts       Orchestrator — runEvolution(seedSpec, seed, config)
  index.ts                 Barrel (export * as X from './x')
```

## Section-by-section mapping

| Brief section | Module | Notes |
|---|---|---|
| 1. Candidate Generator | `candidateGenerator.ts` | Configurable `count`; candidate 0 is always the untouched seed spec |
| 2. Mutation Engine | `mutationEngine.ts` | 6 operators, `styleDnaId` never touched |
| 3. Crossover Engine | `crossoverEngine.ts` | 4 trait groups, each taken wholly from one parent |
| 4. Fitness Evaluation | `fitnessEvaluation.ts` | Real Design Critic, transparent 11-dimension breakdown |
| 5. Selection Strategy | `selectionStrategy.ts` | 3 configurable algorithms |
| 6. Diversity Control | `diversityControl.ts` | `diffJson`-based distance, soft pruning with top-up |
| 7. Evolution Timeline | `evolutionTimeline.ts` | Per-generation record + `compareGenerations` |
| 8. Design DNA | `types.ts` | `DesignDna` — lineage, mutations, crossover record |
| 9. Stopping Conditions | `stoppingConditions.ts` | Quality threshold / max generations / duration / evaluation budget |

## The Mutation Engine's 6 levers

Every operator patches one real `DesignSpecification` field — never a
fabricated one — and none of them ever touch `styleDnaId`:

- **`clusterDensity`** — jitters `density`.
- **`motifScale`** — jitters one randomly chosen `hierarchy` scale field
  (`heroScale`/`secondaryScale`/`fillerScale`/`accentScale`), clamped to
  the real min/max observed across every built-in `HIERARCHY_PRESETS`
  entry for that field — not a hand-picked range.
- **`overlap`** — `DesignSpecification` has no direct "overlap" field;
  overlap is emergent from how much space motifs claim relative to how
  tightly they're packed. This operator jitters `density` (the same real
  lever) with a sharper amount than `clusterDensity` — the same honesty
  discipline Phase 7's Art Direction Engine applied to indirect levers.
- **`hierarchy`** — swaps to a different real `HIERARCHY_PRESETS` entry
  wholesale, rather than randomizing 8 fields independently, so the
  result is always internally consistent.
- **`paletteWeighting`** — reassigns which of the palette's own
  already-approved colors plays which named role
  (background/primary/secondary/accent). `palette.id` never changes —
  the most literal reading of "maintain Style DNA": emphasis changes,
  identity doesn't.
- **`negativeSpace`** — jitters `negativeSpace`.

## The Crossover Engine's 4 trait groups

Each group is a coin flip between "take it wholly from parent A" or
"take it wholly from parent B" — never a field-by-field blend within a
group, so a child can never end up with, say, `palette.id` from one
parent paired with `colorRoles` resolved for the other parent's palette:

- **`composition`** — `composition`, `repeatType`, `rhythm`, `flow`
- **`palette`** — `palette`, `colorRoles`, `background`
- **`cluster`** — `hierarchy`, `density`, `negativeSpace`
- **`motif`** — `heroMotifs`, `secondaryMotifs`, `fillers`

`styleDnaId` and every non-evolved field (project/marketplace/trend/
keywordBundle/svgHints/seoHints/exportHints/qualityTargets) always come
from parent A.

## Design DNA

Every `EvolutionCandidate` carries a `DesignDna` record:
`{ candidateId, generation, parentIds, appliedMutations, crossover }`.
`parentIds` has 0 entries for the untouched seed candidate, 1 for a pure
mutation, and 2 for a crossover child. `appliedMutations` is real
`diffJson` output per mutation, not a hand-written description —
inspecting a candidate's DNA always shows exactly which fields changed
and why.

## Genuine convergence, empirically verified

Before writing the final test suite, the engine was run against real
generated data (not synthetic fixtures) to confirm it actually converges,
the same discipline Phase 7 used. Two things were only found this way:

- **A fully hard-rejected generation 0 is real and possible** — a spec
  whose density/negative-space combination blows the Candidate Engine's
  node-count safety budget produces a `fitness.score === -1` for every
  candidate. `EvolutionFitness.rejected` was added specifically to
  surface this transparently (mirroring `critic/improvementLoop.ts`'s
  own hard-reject guard) rather than let a caller mistake `-1` for a
  legitimately terrible-but-real score.
- **The engine recovers from that state** — in the empirical run that
  found the above (density 0.6, negativeSpace 0.18), generation 0's best
  score was `-1` (every candidate rejected) and generation 1 already
  found a real, non-rejected 46/100 candidate via mutation/crossover,
  with population average climbing 7 → 23 → 46 over the following
  generations. This exact scenario is now `evolutionEngine.test.ts`'s
  "genuine convergence" test.

Elitism (the previous generation's best always survives unchanged into
the next generation's population) is what makes the timeline's best
score **structurally** non-decreasing — this is a provable guarantee,
not a probabilistic hope, and is asserted directly via
`evolutionTimeline.ts`'s `summarizeTimeline().monotonicallyImproved` in
every convergence test.

## UI wiring

`components/workbench/EvolutionPanel.tsx` is a new dockable panel
(`evolution` in `workbench/workspaceSettings.ts`'s `RightPanelId`,
lazy-loaded like every other Phase 6+ panel). It exposes population
size / max generations / selection algorithm controls, a "Run Evolution"
button, the winning candidate's full critique breakdown and Design DNA,
an "Apply Winning Design" button that forwards the real winning spec to
the Workbench (never edits it directly), and a browsable Evolution
Timeline showing every generation's candidates and scores.

## Developer guide

### Adding a new mutation operator

1. Add the id to `MutationType` in `types.ts`.
2. Add a `(spec, rng) => DesignSpecification` function to
   `mutationEngine.ts` that patches one real field, never `styleDnaId`.
   If a real reference range exists (like `HIERARCHY_PRESETS`), compute
   bounds from it instead of hand-picking numbers.
3. Add it to `MUTATION_OPERATORS`.

### Adding a new crossover trait group

Add the id to `CrossoverTrait` in `types.ts` and a case to
`pickTraitFields` in `crossoverEngine.ts` returning the real fields that
belong to that group — always as a whole group, never split further.

### Adding a new selection algorithm

Add the id to `SelectionAlgorithm` in `types.ts` and a case to
`selectCandidates` in `selectionStrategy.ts` that operates purely on the
already-computed `fitness.score` — never re-scores anything.

## Testing

`npx vitest run src/evolution` runs the full suite. `mutationEngine`,
`crossoverEngine`, `selectionStrategy`, `diversityControl`,
`stoppingConditions`, `evolutionTimeline`, and `candidateGenerator` are
pure-logic and run in well under a second combined.
`fitnessEvaluation.test.ts` and `evolutionEngine.test.ts` render real
candidates and are the slowest files in the whole app's test suite (see
Performance notes) — generous per-test timeouts are set explicitly.

## Performance notes

Each fitness evaluation renders one real candidate pool via
`runDesignSpecQualityLoop(spec, seed, 'fast', 1)` — roughly 4 seconds per
evaluation in this environment. A full run with the default config
(`populationSize: 6`, `maxGenerations: 3`) costs on the order of
10-16 evaluations (population size for generation 0, then
`populationSize - 1` new candidates per later generation since the
previous best is always carried over and reused without re-evaluating),
i.e. roughly 40-70 seconds end to end. `evolutionEngine.ts` reuses the
carried-over elite's already-computed fitness every generation instead of
re-rendering it, which is why the real cost is `populationSize +
(populationSize - 1) * (generations - 1)` evaluations, not
`populationSize * generations`. `EvolutionConfig.maxDurationMs` and
`maxEvaluations` exist specifically so a caller (the UI, or a future
batch job) can cap real wall-clock/compute cost directly rather than only
indirectly through `maxGenerations`.
