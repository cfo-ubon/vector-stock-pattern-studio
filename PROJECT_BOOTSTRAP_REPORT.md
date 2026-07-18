# Project Bootstrap Report — PI-1 (Stock Intelligence Engine)

**Status: NOT IMPLEMENTED. Waiting for approval per work order instructions.**

## 0. Input discrepancy (read first)

The read order specified 10 inputs: Project Constitution, System
Architecture, Domain Model, Engine Specification, Coding Principles,
Review Checklist, Technical Roadmap, Decision Log, Project Memory, and
the PI-1 Blueprint. **Only the PI-1 Blueprint was actually attached** —
a zip containing 8 short files (`01_OBJECTIVES.md` through
`08_WORK_ORDER.md`, ~90 lines combined, largely single sentences per
section). The other 9 documents were not provided, and I searched the
entire repository for any existing trace of "Stock Intelligence Engine,"
"SIE," "Business Engine," "Production Engine," "PI-1," or "Project
Constitution" — there is none. This codebase has no prior concept of
those three engines as an architectural boundary.

This materially limits what this report can responsibly claim:

- **Section 4 (Architecture Compliance) cannot verify compliance
  against SIE / Business Engine / Production Engine boundaries**,
  because no document defines what those three engines are, where their
  boundaries sit, or how they're allowed to call each other. I can only
  compare the *existing* codebase's shape against the *rules stated
  directly in your message* (SIE is single source of truth, Business
  Engine never evaluates artwork, Production Engine never makes business
  decisions, never duplicate commercial scoring logic) — not against a
  System Architecture or Domain Model document, since none exists.
- The Project Constitution, Coding Principles, and Review Checklist may
  contain standards (naming, module boundaries, testing bar, doc
  requirements) that differ from this repo's current de facto
  conventions (documented informally in `CLAUDE.md` and 50+ prior
  "Build N" doc sets under `docs/`). Without them I cannot reconcile the
  two.
- The folder structure below was created and the blueprint filed as
  instructed, but `docs/architecture/`, `docs/specifications/`,
  `docs/standards/`, and `docs/governance/` are otherwise empty — there
  was nothing else to move.

I did not fabricate content for any of the 9 missing documents. See
Section 9 for the specific asks.

## Folder structure created

```
docs/
  architecture/      (pre-existing — 5 ADRs already lived here, untouched)
  specifications/    (new, empty)
  blueprints/
    PI-1/            (new — the 8 blueprint files copied here verbatim)
  standards/         (new, empty)
  governance/         (new, empty)
```

Blueprint files were **copied**, not moved (originals remain in the
upload) — contents were not altered.

## 1. Current Architecture

This is a single React + TypeScript + Vite app (`/app`, ~50,000 LOC
across 357 non-test source files, 267 test files) that generates
seamless vector stock patterns and evaluates/manages them commercially.
There is no SIE / Business Engine / Production Engine split anywhere in
the code or its docs. The actual architecture is a set of largely
independent subsystems, most added as sequential "Build N" or named
phases, documented individually under `docs/`:

- **`engine/`** — the pattern generation engine itself (SVG AST, tile
  engine, layouts, motif factory, hierarchy/composition/flow
  intelligence) plus a large family of **scoring engines**:
  `qualityScore.ts` (legacy), `scoring.ts` (`computeOverallScore`,
  weighted-average), `scoringV2.ts` (`computeOverallScoreV2`,
  layout-aware penalty scoring with explainability).
- **`critic/`** — the "Design Critic & Art Direction Engine": an
  11-dimension critique (`designCritique.ts`), a problem/penalty
  detector (`problems.ts`), a recommendation generator that emits
  `specPatch`-bearing suggestions (`artDirection.ts`), several
  commercial-scoring layers (`commercialValidation.ts`,
  `commercialPatternCritic.ts`, `commercialAppealScore.ts`,
  `commercialJudgeV2.ts`), a unified report aggregator
  (`designReport.ts`), and a closed-loop "evaluate → apply top
  recommendation's spec patch → regenerate → re-evaluate" improvement
  loop (`improvementLoop.ts`) gated by `qualityGate.ts`.
- **`evolution/`** — a genetic-algorithm design optimizer
  (candidate/mutation/crossover/selection/diversity/stopping-condition
  engines) whose `fitnessEvaluation.ts` explicitly reuses
  `critic/designReport.ts` rather than re-scoring, by design.
- **`knowledge/`** — facades over static design knowledge (style,
  motif, palette, composition, pattern, collection, marketplace) plus a
  rule-based `recommendation/` module and a learning-history engine.
- **`metadata/`** — legacy per-marketplace metadata/SEO/readiness
  tooling (`readinessScore.ts`, `marketplaceValidation.ts`,
  `submissionCenter.ts` — an older, pre-`catalog/` submission
  concept).
- **`catalog/`** — the newer, cleanly-layered subsystem built across
  the last several sessions: a frozen Collection API
  (`domain/`, `services/`, `storage/`, certified and API-frozen per
  `docs/portfolio/COLLECTION_API_FREEZE.md`), Backup & Restore
  (`backup/`), Submission Center (`submission/`), an SEO Intelligence
  Engine (`seo/`), and — most recently — a read-only Portfolio
  Dashboard (`dashboard/`) that aggregates the other three into a
  Portfolio Health score, analytics reports, and a recommendation
  engine.
- **`components/`, `workbench/`** — the UI layer (Design Workbench,
  Portfolio UI, panels).

Every one of these subsystems was built by a previous session under a
"do not modify the previous frozen/certified layer" discipline similar
to what your rules ask for now (see `docs/portfolio/COLLECTION_API_FREEZE.md`,
`critic/` module headers stating dimensions "already shipped, three
times over," `evolution/fitnessEvaluation.ts`'s header explicitly
avoiding "a second scoring implementation"). The discipline exists; it
has just never been named SIE / Business Engine / Production Engine.

## 2. Existing modules (mapped against PI-1's 4 named modules)

| PI-1 Blueprint module | Closest existing equivalent | Gap |
|---|---|---|
| PI-1A Pattern Analyzer | `engine/scoring.ts` / `scoringV2.ts` (metrics), `critic/designCritique.ts` (11-dim critique) | Already computes per-pattern metrics; not schema-aligned to PI-1's `04_JSON_SCHEMA.md` |
| PI-1B Commercial Scoring | `critic/commercialValidation.ts` — a working weighted composite: `overall*0.4 + commercialReadiness*0.35 + heroVisibility*0.25`; also `commercialAppealScore.ts`, `commercialJudgeV2.ts` | Different weights/terms than PI-1's Composition 30/Color 20/Hero 20/SVG 15/Commercial 15%; **3 separate implementations already exist** |
| PI-1C Recommendation Engine | `critic/artDirection.ts` — `buildArtDirectionRecommendations()`, emits prioritized recs with `specPatch` | Functionally complete; different output shape than PI-1's flat `recommendations[]` |
| PI-1D Improvement Planner | `critic/improvementLoop.ts` — `runImprovementLoop()`, evaluate → patch → regenerate → re-evaluate, closes the exact loop PI-1D implies | Functionally complete and already in production |

`critic/designReport.ts`'s output (`overall` + per-dimension scores +
recommendations + priority-ordered improvement data +
`meetsCommercialBar`) is structurally close to PI-1's target Review JSON
(`overallScore`, `scores{}`, `recommendations[]`, `improvementPlan[]`) —
different field names, same shape.

## 3. Missing modules

Nothing in PI-1's 4-module list is *conceptually* missing — every stage
of its pipeline (Analyzer → Metrics → Score → Recommendations →
Improvement Plan → Review JSON) already exists in `critic/` and
`engine/`. What's actually missing is:

- A module that outputs the **exact `04_JSON_SCHEMA.md` shape**
  (`overallScore`, `scores`, `recommendations`, `improvementPlan`) —
  none of the existing report builders use those exact field names.
- A **single source-of-truth boundary** (SIE) that the rest of the app
  is required to call through — today, `engine/`, `critic/`,
  `evolution/`, and `catalog/dashboard/` each independently compute
  score-shaped output; nothing enforces "only one of these may be the
  commercial-scoring truth."
- Any of the 9 governance documents themselves (Constitution,
  Architecture, Domain Model, Engine Spec, Coding Principles, Review
  Checklist, Roadmap, Decision Log, Project Memory) as committed
  artifacts in this repo.

## 4. Architecture compliance

Cannot be fully assessed — see Section 0. What I can say against the
rules stated directly in your message, using the existing code as
evidence:

- **"Never duplicate commercial scoring logic"** — already violated
  *within the existing codebase*, independent of PI-1: `engine/scoring.ts`,
  `engine/scoringV2.ts`, `critic/commercialValidation.ts`,
  `critic/commercialPatternCritic.ts`, `critic/commercialAppealScore.ts`,
  `critic/commercialJudgeV2.ts`, `metadata/readinessScore.ts`, and
  `catalog/dashboard/portfolioHealthCalculator.ts` are 8 separate
  scoring implementations across the repo's history, each layered on
  the last rather than replacing it. If PI-1A/B are implemented fresh
  per the blueprint's literal formula, that becomes a 9th.
- **"Business Engine never evaluates artwork" / "Production Engine
  never performs business decisions"** — cannot be checked; no code in
  this repo is currently labeled Business Engine or Production Engine,
  and no document defines which existing modules would become which.
- **"SIE is the Single Source of Truth"** — cannot be checked; nothing
  currently claims that role, and multiple modules currently compute
  overlapping commercial truth (see above).

## 5. Technical debt

- 8 independent commercial/quality scoring implementations (listed
  above) with no deprecation path between them — each newer one layers
  on top rather than retiring the last (explicitly acknowledged in
  `critic/commercialAppealScore.ts`'s own header).
- Two parallel "submission" concepts: the legacy
  `metadata/submissionCenter.ts` and the certified, actively-maintained
  `catalog/submission/`. It's unclear from code alone whether the
  legacy one is dead.
- `engine/` mixes pure generation code with ~25 scoring/quality/critic-
  adjacent files that arguably belong under `critic/` or a dedicated
  metrics layer — there's no hard boundary today between "generates a
  pattern" and "evaluates a pattern," which is precisely the boundary
  PI-1/SIE's governance model is trying to impose.
- No single canonical "Pattern JSON" schema — `engine/designModel.ts`,
  `evolution/types.ts`, and `catalog/domain/types.ts` each define
  related-but-distinct shapes for what a pattern/spec/asset is.

## 6. Risks

- **Highest risk: implementing PI-1A-D as new, separate modules would
  create a 9th scoring implementation**, directly violating the "never
  duplicate commercial scoring logic" rule your message just stated —
  using the blueprint literally (fresh files matching its schema) is in
  tension with using it as intended (a governance rule you also just
  stated). This is the technical contradiction flagged per your own
  instruction: "explain it before making changes."
- Building SIE without the missing System Architecture / Domain Model
  documents risks guessing at boundaries that get redone once those
  documents arrive.
- The PI-1 Blueprint's score formula (Composition 30/Color 20/Hero
  20/SVG 15/Commercial 15%) has no defined metric behind "Color" or
  "Hero" as top-level 20%-weighted terms in the existing scoring code —
  color and hero exist as *inputs* to other scores today, not as
  independently-weighted top-level dimensions. Implementing PI-1B
  literally would require either new metric extraction or reinterpreting
  existing sub-scores under new names.
- 06_TEST_CASES.md's 4 cases ("Balanced pattern," "Weak hero," "Dense
  fillers," "Invalid SVG") are one-line labels with no expected
  score/threshold — cannot be turned into real assertions without more
  detail.

## 7. Recommended implementation order (once approved)

1. Resolve the Section 6 contradiction with you first: should PI-1A/B
   **wrap/re-expose** `critic/designReport.ts` + `commercialValidation.ts`
   under the SIE-shaped schema (recommended — zero duplicated logic,
   fastest path, matches "never duplicate"), or fully replace them
   (requires an explicit decommission plan for the 8 existing scorers)?
2. Obtain the 9 missing governance documents, or an explicit
   acknowledgment that PI-1's 8 files ARE the complete spec and the
   read-order list was aspirational/future work.
3. If wrapping (step 1's recommended path): PI-1A becomes a thin adapter
   translating `critic/designCritique.ts` + `engine/scoringV2.ts` output
   into the `04_JSON_SCHEMA.md` shape — no new scoring math.
4. PI-1B as a thin re-weighting adapter over `commercialValidation.ts`'s
   existing signals, OR a documented decision to change the actual
   weights repo-wide (which is an architecture decision, not an
   implementation detail).
5. PI-1C/D likely need the least new code — `artDirection.ts` and
   `improvementLoop.ts` already do this; mostly a schema-shape adapter.
6. Only after 1-5: tests per `06_TEST_CASES.md`, docs, changelog per
   `08_WORK_ORDER.md`.

## 8. Estimated work for PI-1A

Two scenarios, since the answer depends entirely on the Section 6
decision:

- **Adapter over existing engines** (recommended): 1 new file
  (~150-250 LOC) mapping `designCritique` + `scoringV2` output to the
  Review JSON schema, plus tests. Half a day to a day of focused work,
  once the schema and formula questions in Section 9 are answered.
- **Fresh, from-formula implementation** (blueprint taken literally,
  ignoring existing engines): a new Composition/Color/Hero/SVG analyzer
  from scratch, ~800-1500 LOC plus tests — and a 9th scoring
  implementation per Section 6's risk. Not recommended without an
  explicit decision to deprecate the existing 8.

## 9. Questions requiring clarification

1. **The 9 missing documents** (Constitution, System Architecture,
   Domain Model, Engine Specification, Coding Principles, Review
   Checklist, Technical Roadmap, Decision Log, Project Memory) were not
   in the upload — only the PI-1 Blueprint's 8 files were. Please
   attach them, or confirm the blueprint is the complete spec for now.
2. **Is PI-1/SIE meant to supersede the existing `critic/` +
   `engine/` scoring stack, or sit alongside it?** This is the single
   highest-leverage answer — it determines whether PI-1A/B are adapters
   (fast, zero duplication) or new implementations (slow, and a direct
   violation of "never duplicate commercial scoring logic" as stated).
3. Does "Stock Intelligence Engine" refer to a **new top-level
   directory** (e.g. `app/src/sie/`), or is it a **relabeling** of
   existing directories (`engine/` + `critic/` become "SIE")? The
   Constitution/Architecture doc would normally answer this.
4. What are "Business Engine" and "Production Engine" in terms of
   *this* codebase? No existing module maps cleanly to either name —
   closest candidates would be `catalog/submission/` +
   `catalog/dashboard/` (business-side: readiness, submission,
   analytics) and `engine/` (production-side: SVG generation), but this
   is a guess, not a documented mapping.
5. PI-1's score formula names "Color" and "Hero" as independent 20%
   weighted top-level terms — should these be newly-extracted metrics,
   or renamed/reused existing sub-scores (e.g. `heroVisibility` already
   exists in `commercialValidation.ts`)?
6. `06_TEST_CASES.md`'s 4 cases have no expected score ranges or
   thresholds — what should "Balanced pattern" vs. "Weak hero" actually
   assert?
7. Should the legacy `metadata/submissionCenter.ts` (pre-`catalog/`) be
   treated as dead code / a documented decommission candidate, or is it
   still load-bearing somewhere?
