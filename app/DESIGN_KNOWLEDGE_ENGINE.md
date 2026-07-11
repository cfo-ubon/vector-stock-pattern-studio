# Design Knowledge Engine — Phase 6.5

Developer documentation for the Design Knowledge Engine (DKE): the
centralized, structured design-knowledge layer under `src/knowledge/`
that every other engine in this app is meant to consume instead of
reaching into `services/*`, `style-dna/*`, `motif-grammar/*`, etc.
directly.

**This phase does not redesign any previous engine, move business logic
into the UI, or duplicate rules across modules.** Every `knowledge/*`
subfolder is a thin facade over an already-real, already-tested module
built in an earlier phase (Design Intelligence Core Phase 1, Style DNA
Engine, Commercial Collection Engine Phase 4, Marketplace Intelligence
Engine Phase 5, Project Phoenix V2, Design Workbench Phase 6) — see each
subfolder's own header comment for exactly what it wraps and why. The two
places this phase genuinely adds new logic are documented explicitly
below (Learning History and the Recommendation Engine's personalization).

## Contents

1. [Why a facade, not a rewrite](#why-a-facade-not-a-rewrite)
2. [Folder structure](#folder-structure)
3. [Knowledge Schema](#knowledge-schema)
4. [What's genuinely new this phase](#whats-genuinely-new-this-phase)
5. [Developer guide](#developer-guide)
6. [Validation](#validation)
7. [Performance notes](#performance-notes)

## Why a facade, not a rewrite

Before this phase, an audit of the codebase (see the git history / prior
session's research pass) found that every one of the brief's 10 named
knowledge categories already had a real, working, mostly-JSON-driven
engine behind it:

| Brief category | Already lived in |
|---|---|
| Style Knowledge | `style-dna/*.json`, `services/styleDnaService.ts`, `engine/hierarchy.ts` |
| Motif Knowledge | `motif-grammar/*.json`, `services/motifGrammarService.ts` |
| Palette Knowledge | `color-roles/*.json`, `palettes/*`, `services/colorRoleService.ts`, `collection/colorStory.ts` |
| Composition Knowledge | `engine/styleDna.ts` (Flow/Rhythm), `engine/clusterEngine.ts`, `pattern-grammar/*`, `layouts/*` |
| Pattern Knowledge | `pattern-grammar/*.json`, `services/patternGrammarService.ts` |
| Collection Knowledge | `trend/collectionPlan.ts`, `collection/productTargets.ts`, `collection/colorStory.ts`, `collection/motifReuse.ts` |
| Marketplace Knowledge | `marketplaces/*.json`, `metadata/marketplaceProfiles.ts`, `services/marketplaceService.ts` |
| Design Rules | `engine/candidateEngine.ts`'s hard-reject thresholds (TS-only before this phase) |
| Recommendation Engine | 4 independent recommenders (Style DNA export recommendation, Product Targets, Trend Pack Auto-match, Quality Loop recommendations) |
| Learning History | `workbench/workbenchFavorites.ts` (explicit favorites only — no usage counts, recents, disable, or export/import) |

Given the brief's own instruction not to redesign previous engines or
duplicate rules, the correct architecture is a facade layer: `knowledge/*`
re-exports and composes these real modules under one consistent API
surface, so a future consumer writes `import { StyleKnowledge } from
'../knowledge'` instead of learning 7 different services' import paths —
without any of the underlying engines changing behavior.

## Folder structure

```
src/knowledge/
  index.ts              Top-level barrel — the one import surface
  style/index.ts         Style DNA + Hierarchy Presets facade
  motif/index.ts          Motif Grammar facade + derived forbidden/
                           recommended combinations
  palette/index.ts        Palette + Color Role + Color Story facade,
                           new real WCAG contrast accessibility notes
  composition/index.ts     Flow/Rhythm/Cluster/Pattern Grammar/Layout
                           facade — also now the single source of truth
                           for LAYOUT_CLUSTER_ARCHETYPES (moved out of
                           PropertyInspector.tsx, which previously kept
                           its own duplicate copy)
  pattern/index.ts         Pattern Grammar facade + commercial
                           suitability (composes Product Targets)
  collection/index.ts      Collection Plan / Product Targets / Color
                           Story / Motif Reuse facade
  marketplace/index.ts     Marketplace Profile facade
  rules/
    rejectRules.json       Real hard-reject thresholds, externalized
                            from engine/candidateEngine.ts
    index.ts                getHardNodeBudget() — candidateEngine.ts's
                             HARD_NODE_BUDGET now reads from here
  recommendation/index.ts  NEW real aggregator — see below
  history/index.ts         NEW Learning History engine — see below
  validation.ts            NEW cross-domain validation — see below
```

## Knowledge Schema

Two new JSON Schemas were added to `src/schemas/`, registered in
`validators/index.ts`'s existing `SCHEMA_REGISTRY` (the same
`makeValidator(schemaId)` pattern every other domain already uses — no
second validation engine):

- **`rejectRules.schema.json`** — `{ schemaVersion, hardNodeBudget,
  structuralChecks[] }`. Validated via `validateRejectRulesData`.
- **`learningHistory.schema.json`** — `{ schemaVersion, enabled,
  styleDnaUsage, paletteUsage, motifUsage, recentCollections[] }`.
  Validated via `validateLearningHistoryData`. Per-value validation
  inside the three usage maps (must be a non-negative number) is enforced
  by `knowledge/history`'s own `normalizeLearningHistory`, not the
  schema — the hand-rolled validator (`validators/jsonSchemaValidator.ts`)
  only supports a boolean `additionalProperties`, not a per-key value
  schema (documented in the schema file itself).

Every other knowledge domain reuses its already-existing schema
(`styleDna`, `motifGrammar`, `patternGrammar`, `colorRoleSystem`,
`palette`, `marketplaceProfile`) — none of those were touched.

## What's genuinely new this phase

### Learning History (`knowledge/history`)

Distinct from `workbench/workbenchFavorites.ts` (explicit star-toggle
favorites, unmodified): this tracks **implicit usage** — how often a
Style DNA/Palette/Motif category was actually used, and which collections
were generated recently — in a separate `localStorage` key
(`vsp-knowledge-learning-history-v1`), using the same load/save/normalize/
export/import pattern `workbench/workspaceSettings.ts` established.
Supports everything the brief's Section 10 names: favorites (via the
existing `workbenchFavorites.ts`, unchanged), frequently-used styles/
palettes/motifs (`getFrequentStyleDna`/`getFrequentPalettes`/
`getFrequentMotifs`), recent collections (`getRecentCollections`, capped
at 20), disabling (`setLearningHistoryEnabled` — when disabled, every
`record*` function becomes a real no-op, not just a hidden UI control),
clearing (`clearLearningHistory`, preserves the `enabled` flag), and
export/import (`serializeLearningHistory`/`parseLearningHistoryJson`).

`components/workbench/DesignWorkbench.tsx` is its first real consumer:
every spec that becomes current records Style DNA + Palette usage, and
clicking "Generate Collection" records a recent-collection entry — small,
additive hooks, no business logic added to the component itself (the
component only calls `recordStyleDnaUsage`/`recordPaletteUsage`/
`recordCollectionGenerated`, all pure functions living in
`knowledge/history`).

### Recommendation Engine (`knowledge/recommendation`)

A real, deterministic, rule-based aggregator over the 4 independent
recommenders this codebase already had:

- `recommendStyleDna` — all styles, or narrowed to a marketplace's real
  `exportRecommendation.recommendedSites`; with a `LearningHistory`,
  frequently-used styles are stably re-sorted to the front of that same
  real candidate set (never a fabricated addition).
- `recommendPalettesForStyle` / `recommendMotifFamiliesForStyle` — a
  style's own real preferred order, with history-based promotion.
- `recommendMarketplacesForStyle` — a style's real curated marketplace
  list.
- `recommendProductUses` — wraps `collection/productTargets.ts` unchanged.
- `recommendTrendPack` — wraps the real "Auto-match" resolver
  (`trend/designIntelligence.ts`'s `resolveTrendPack`, the same logic
  behind the Trend Studio form's "✨ Auto-match" button).
- `recommendQualityImprovements` — wraps `trend/designSpecQuality.ts`'s
  `buildQualityRecommendations` (Design Workbench Phase 6) unchanged.

Nothing here invents a score, a copy string, or a hardcoded list — every
recommendation traces back to a real rule or a real recorded usage count.

### Validation (`knowledge/validation.ts`)

- `validateAllKnowledge()` — every real knowledge data file (Style DNA,
  Motif Grammar, Pattern Grammar, Color Role System, every Palette, every
  Marketplace Profile, the new Reject Rules, the default Learning
  History) against its own real JSON Schema, in one call.
- `validateKnowledgeRelationships()` — genuinely new: walks the real,
  already-loaded data structures to confirm every cross-domain id
  reference actually resolves (Style DNA → Palette/Motif Category/Layout/
  Hierarchy Preset; Motif Grammar → Pattern Grammar; Pattern Grammar →
  Layout/Hierarchy Preset). Schema validation alone can't catch a
  dangling foreign-key-like reference — this is the first check in the
  codebase that does.

## Developer guide

### Consuming the DKE from a new engine or component

```ts
import { StyleKnowledge, RecommendationEngine } from '../knowledge';

const styles = StyleKnowledge.listStyleKnowledge();
const recommended = RecommendationEngine.recommendStyleDna({ marketplaceId: 'etsy' });
```

Or import a single subfolder directly (`import { listStyleKnowledge } from
'../knowledge/style'`) when you only need one domain — both work; the
barrel just saves remembering 10 different paths.

### Adding a new knowledge domain

1. Create `knowledge/<domain>/index.ts`. If it wraps an existing module,
   keep it a thin facade — re-export/rename, don't reimplement.
2. If it's genuinely new data, add a JSON Schema under `schemas/`,
   register it in `validators/index.ts`'s `SCHEMA_REGISTRY`, and add it to
   `knowledge/validation.ts`'s `validateAllKnowledge()`.
3. Add the new subfolder to `knowledge/index.ts`'s barrel.
4. If the new domain references another domain's ids, add a check to
   `validateKnowledgeRelationships()`.

### Extending Learning History

Every `record*` function follows the same shape: `(history, ...args) =>
history` (a pure reducer, no side effects) — `DesignWorkbench.tsx` (or any
future caller) owns the `useState`/`useEffect`/`localStorage` wiring, the
same convention `workbench/workspaceSettings.ts` established. A new
"frequently used X" concept should add one more `Record<string, number>`
field to `LearningHistory`, a `record<X>Usage` reducer, and a
`getFrequent<X>` reader — mirroring the existing three exactly.

## Validation

Run `npm test -- src/knowledge` to exercise the full DKE test suite,
including `validation.test.ts`'s live check that every real committed
knowledge file is schema-valid and every cross-domain reference resolves
— a change to any `style-dna/*.json`, `motif-grammar/*.json`,
`pattern-grammar/*.json`, palette, or marketplace JSON file that breaks
its own schema or introduces a dangling reference fails this suite.

## Performance notes

`validateAllKnowledge()` + `validateKnowledgeRelationships()` together run
in well under 200ms against the full real dataset (asserted in
`validation.test.ts`) — every knowledge domain in this app is a small,
already-in-memory array (15-20 records at most per domain), so there was
no need for lazy loading, pagination, or caching here, unlike the Design
Workbench's Project Explorer (which does paginate, for genuinely large
user-generated Project/Trend-Pack lists).
