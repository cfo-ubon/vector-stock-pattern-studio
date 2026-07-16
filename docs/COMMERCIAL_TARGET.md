# Commercial Target

The business KPI document for Vector Stock Pattern Studio's generation
engine, Version 1. Every target below is either a real, already-measured
number from `docs/BUILD_REPORT.md`/`docs/PERFORMANCE.md`, or an explicit
target for a metric this codebase already computes — nothing here is
aspirational marketing copy disconnected from what the engine can
actually report on itself.

**Every future build must explain, in its own `docs/BUILD_REPORT.md`
entry, how it moves (or deliberately doesn't move) each KPI below.** A
build that doesn't touch a given KPI should say so explicitly rather than
leave the reader guessing.

---

## Commercial Quality

**Target**: 9.0+ / 10 (informal, human-facing framing of the real
`overallScore` + `commercialScore` composites below).

**Current (Build 001.1)**: real 30-scenario average `overallScore`
(editorialBotanical preset) is 79.6-80.4/100 (~8.0-8.4/10 on the same
informal scale) — up from Build 001's 78.6-79.6 (~7.9-8.0/10). Not yet at
target; see `docs/BUILD_REPORT.md`'s Build 001.1 "Remaining Weaknesses"
and `docs/ROADMAP.md`'s Recommended Next Build for the specific,
identified next step (a style-aware `commercialScore` adjustment).

## Commercial Score

**Target**: 85+ average across a representative portfolio (see Portfolio
Production Target below).

**Current (Build 001.1)**: `critic/commercialValidation.ts`'s
`commercialScore` — the 100-pattern Visual Portfolio Review (Build
001.1, Section 8) measured a portfolio average of 68.6, with the top 5
patterns at 85-87. **Real, measured gap**: the portfolio average is well
below the top performers because `commercialScore` structurally favors
hero-centric Style DNA presets over minimal/airy ones (see Known Issues
#3) — closing this gap is the Recommended Next Build's #1 item.

## Hero Visibility

**Target**: 90+ average (`computeHeroVisibilityScore`, `engine/scoring.ts`).

**Current (Build 001.1)**: not yet separately re-measured across the full
30-scenario suite in this build's own numbers table, but its 3 dominant
inputs moved in the right direction — `heroDetailRatio` 56.0 → 60.9,
`hierarchy` 95.7 → 97.6, `heroSeparation` steady at 100.0. A future build
should add Hero Visibility Score itself to the standard before/after
measurement table (it currently has to be reconstructed from its
component metrics).

## Performance

**Target**: no layout's median generation time exceeds ~1.5s in this
environment (informal ceiling for an interactive tool); no new pass adds
worse than O(n log n) complexity without a documented, justified reason.

**Current (Build 001.1)**: no new O(n²) (or worse) pass was added — every
new module (Sections 5/6/7) is a single O(n) read over already-extracted
instances/metrics. Build 001's own O(n²) Pattern Physics cost (`radial`
worst case ~1039ms) is unchanged and still the dominant per-layout cost
(see `docs/KNOWN_ISSUES.md`'s still-open item #2 — spatial-hash
optimization, not yet done in any build).

## SVG Compatibility

**Target**: every generated pattern stays under `knowledge/rules`'s hard
SVG node budget (currently 8000 nodes) and remains valid, importable SVG
in standard vector tools (Illustrator/Affinity/Figma) — no proprietary
extensions, no malformed markup.

**Current (Build 001.1)**: the hard node budget is enforced structurally
(`engine/candidateEngine.ts`'s `applyHardRejectRules`) and unchanged this
build. A real regression was found and fixed during this build (Section
1's 2 new overlay primitives pushed one already-marginal real scenario
over budget — see `docs/PERFORMANCE.md`) — the fix (`densityDamping`) is
now a permanent, tested part of how hero detail scales with tile density,
so this specific failure mode should not recur as future builds add more
per-instance detail.

## Portfolio Production Target

**Target**: 100+ patterns producible per Style DNA preset batch, with a
real, repeatable Top 20 / Best 10 / Best 5 ranking methodology.

**Current (Build 001.1)**: established for the first time this build —
100 patterns (7 seeds × 15 presets, trimmed) generated and ranked by
`commercialScore` in the real `DesignSpecification` pipeline (not a
separate ad-hoc script's own scoring logic). This methodology is
reusable by any future build to re-run the same portfolio review and
compare against Build 001.1's own numbers (`docs/BUILD_REPORT.md`).

## Marketplace Readiness

**Target**: every generated pattern scores a real, evaluable fit against
at least the 3 named commercial product uses this KPI doc tracks
(Wallpaper, Fabric, Gift Wrap) via `collection/productTargets.ts`'s
already-shipped `evaluateProductTargets` (10 product uses total, Phase 4).

**Current**: unchanged infrastructure from Phase 4/Build 001.1 — this
build surfaces 3 of the 10 scores (`wallpaperScore`/`fabricScore`/
`giftWrapScore`) directly in `critic/commercialValidation.ts`'s output
for the first time at the Design Critic level (previously only reachable
via the Collection Engine's own Product Targets panel).

## SEO Automation Status

**Status**: real, shipped, unrelated to this build. SEO Hint Engine
(Marketplace Integration Engine Phase 5), per-marketplace metadata
generation, and keyword bundling are all real, already-working features
outside Composition Quality's scope — Build 001 and Build 001.1 are both
explicitly composition/commercial-scoring-only builds (see
`docs/ROADMAP.md`'s "Explicitly out of scope" section). No change this
build.

## JSON Automation Status

**Status**: real, shipped, unrelated to this build. The Design
Specification JSON schema (`trend/designSpecTypes.ts`, schema version 1)
and its full read/write/validate pipeline (Trend Intelligence Studio
Phases 1-5) are unchanged by Build 001.1 — this build only reads
`DesignSpecification` fields (`critic/commercialValidation.ts`), it never
adds or changes a schema field. No change this build.

---

## Revision Log

- **Build 001.1**: this document created. Baseline KPI values are Build
  001.1's own real, measured numbers — there is no earlier baseline to
  compare against since this is the KPI document's first version.
