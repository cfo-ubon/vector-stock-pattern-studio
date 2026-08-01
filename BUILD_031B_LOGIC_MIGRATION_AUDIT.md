# Build 031B Hardening — Logic Migration Audit

Companion document to `BUILD_031B_REPORT.md`. Every business-decision rule
found in Mission Control, Autopilot, Business Coach, Portfolio Doctor,
Commercial Pipeline, and AI CEO is listed below with its classification,
its migration status, and — where migrated — the Decision OS policy ID and
evidence provider that now own it.

Classification key:
- **Technical validation** — checks whether an operation is even possible
  (file exists, data present). Stays local; not a business decision.
- **Presentation logic** — formatting/labeling/sorting for display only.
- **Business policy** — a decision about *what should happen next* given
  real evidence. Must live in Decision OS.
- **Evidence gathering** — reads already-computed storage records into the
  shape a policy can reason about. Lives in an `decisionOS/adapters/*.ts`
  file, not in the policy itself.
- **Confidence calculation** — how sure the system is. Owned by
  `decisionOS/confidenceEngine.ts`, never invented locally.

---

## 1. AI CEO (`aiCeo/decisionEngine.ts`)

| Original rule | Classification | Status | Policy ID | Evidence provider |
|---|---|---|---|---|
| 3-way live-evidence / portfolio-gap / evergreen-fallback selection | Business policy | **Migrated** (prior session) | `marketplace.*` (3 policies) | `marketplaceAdapter.ts` |
| `buildContinueRunRecommendation` (resume interrupted run) | Presentation/technical — reshapes an already-real `AutonomousDesignRun` into a card | Not migrated (see Autopilot Gate below for the actual "resume vs generate" decision, which *is* migrated) | — | — |
| `buildMoveReadyRecommendation`, `mapDashboardRecommendation` | Presentation — reshapes Build 017's own already-decided Dashboard Snapshot recommendation | Not migrated (Dashboard Snapshot is itself a separate, already-shipped recommendation engine; re-deciding its output here would be a second, competing decision system) | — | — |

`decisionTraceFrom()` (`aiCeo/decisionTrace.ts`) is now the one shared
helper every module below reuses to attach a `DecisionTrace` to a visible
recommendation — extracted from `aiCeo/decisionEngine.ts` in this hardening
pass so Portfolio Doctor, Business Coach, and the Commercial Pipeline don't
each reimplement it.

## 2. Portfolio Doctor (`aiCeo/portfolioDoctor.ts`)

| Finding | Classification | Status | Policy ID |
|---|---|---|---|
| Category concentration (oversaturation) | Business policy | Migrated (prior session) | `portfolio.avoidOversaturation` |
| Empty collections | Business policy | **Migrated this pass** | `portfolio.preferCollectionDiversity` |
| REVIEW/REJECT rate (30% threshold) | Business policy | **Left local, documented** — no existing policy fires at the same 30%-of-total threshold; the closest policy (`factory.repairBeforeGenerate`) fires on any nonzero count, a materially different rule. Delegating would silently change behavior, so this finding's threshold math stays in `portfolioDoctor.ts` rather than being force-fit onto a policy that doesn't actually match it. | — |
| READY-not-imported | Business policy | **Migrated this pass** | `factory.completeExistingWorkFirst` |
| Not-prepared-for-submission | Business policy | **Migrated this pass** (new policy added) | `portfolio.completeSubmissionPrep` |
| Category gap assessment (least-covered category) | Business policy | **Not migrated** — `portfolio.preferMissingCategories` policy exists and is tested, but Portfolio Doctor has no dedicated "category gap" finding to attach it to (category concentration's `diversifyPortfolio` action already implicitly points at the least-covered category). Documented as a known limitation, not silently dropped. |
| Duplication concern | Business policy | **Not migrated** — no existing Portfolio Doctor finding or Decision OS policy models "near-duplicate assets" today; out of scope for this hardening pass. Documented as a known limitation. |

A real bug was found and fixed while wiring the 4th finding:
`portfolioEvidence.ts`'s `portfolio:categoryConcentration` evidence record
spread a possibly-`null` `categoryConcentration` object, producing a
truthy `{ total, oversupplyShare }` value with `share: undefined` — which
fooled `avoidOversaturation`'s `!concentration` null check (`undefined <
number` is always `false` in JS) into firing on unrelated queries that
never supplied concentration data. Fixed to stay `null` when there is
genuinely no concentration evidence.

## 3. Business Coach (`aiCeo/businessCoach.ts`)

All 8 cards are direct reshapes of `AiCeoRecommendation`s already produced
by `rankAiCeoRecommendations` (`aiCeo/decisionEngine.ts`) or real counts
(`weekly-progress`, `portfolio-growth`, `submission-readiness` — pure
arithmetic over real records, not a business decision). **This pass added
`decisionTrace` passthrough** from the underlying recommendation to every
card (`BusinessCoachCard.decisionTrace`), so `todays-focus`, `quick-win`,
`blocker`, `unfinished-work`, and `next-action` now expose policy IDs,
evidence IDs, confidence, and business impact whenever their source
recommendation was Decision-OS-routed — `null` otherwise, never fabricated.

## 4. Commercial Pipeline (`commercial/commercialRecommendation.ts`)

| Original rule (`actionForBucket`) | Classification | Status | Policy ID |
|---|---|---|---|
| `generatorCompleted`/`svgExists` FAIL → skip entirely | Technical validation | Stays local | — |
| Collection assignment missing → `completeCollection` | Business policy | **Migrated this pass** (new policy) | `commercial.completeCollectionFirst` |
| QA not passed → `repair` | Business policy | **Migrated this pass** (new policy, reuses existing `qa:assetQaStatus` evidence) | `commercial.repairBeforeSeo` |
| Metadata/SEO missing → `finishSeo` | Business policy | **Migrated this pass** (new policy) | `commercial.finishSeoBeforePackaging` |
| Score ≥ threshold and 0 failing checks → `exportReady` | Business policy | **Migrated this pass** (new policy) | `commercial.recommendExportWhenReady` |
| Collection missing a "colorway"-tagged asset → `generateColorway` | Business policy | **Not migrated** — collection-level (not per-asset), no existing policy models it; documented as a known limitation. | — |

The 4 new policies are priority-ordered (6 < 11 < 16 < 21) to reproduce
`actionForBucket`'s original if/else-if cascade exactly — verified by the
pre-existing `commercialRecommendation.test.ts` suite passing unchanged
plus a new traceability test. The pre-existing
`commercial.neverExportBelowReadinessThreshold` policy (an actual
permission gate for `requestedAction: 'export'|'buildPackage'`, distinct
from this "what's next" recommendation) is untouched.

## 5. Mission Control (`components/missionControl/MissionControlView.tsx` + panels)

Mission Control is a composite screen, not a single decision-making
module. Its constituent panels were addressed as follows:

| Sub-screen | Status |
|---|---|
| Morning Brief (top recommendation) | `AiCeoBrief.topRecommendation` already carries `decisionTrace` (AI CEO section above); **this pass wired `ExplanationBlock`** to accept and render it — policies/evidence/business-impact/blocked-reasons — purely additive, no existing wording changed. |
| Business Coach panel | **This pass** added a per-card "Why?" expandable trace (policies/evidence/confidence/business impact/alternative), rendered only when `card.decisionTrace` is non-null. |
| Portfolio Doctor panel | **This pass** added the same per-finding "Why?" trace. |
| Hero Card (`missionControl/heroOpportunity.ts`) | **Not migrated** — this module calls `autopilot/decisionEngine.ts`'s `selectEvidence` directly (evidence *selection*, not a policy cascade); it does not model a business decision Decision OS currently owns a policy for. Documented as a known limitation. |
| Goals Panel, Conversation Panel | **Not touched** — out of scope for this hardening pass; neither currently produces a Decision-OS-eligible recommendation. |

## 6. Autopilot (`autopilot/decisionEngine.ts`, `components/autopilot/AutopilotView.tsx`)

| Rule | Classification | Status | Policy ID |
|---|---|---|---|
| "Should we generate new patterns, or is unfinished work more important?" | Business policy | **Migrated this pass** — new `autopilot/generationGate.ts` + `decisionOS/adapters/generationGateAdapter.ts`, wired into `AutopilotView.handleBuildPlan` before a Design Plan is built | `factory.completeExistingWorkFirst`, `factory.repairBeforeGenerate` (both pre-existing, previously unused by any real caller) |
| Evidence selection within a chosen mode (`selectEvidence`'s mission/opportunity/seasonal/portfolio-gap/evergreen priority) | Business policy (a separate, narrower decision from "should we generate at all") | **Not migrated** — this is the same evidence-selection logic Mission Control's Hero Card also uses; migrating it was out of scope for this pass (see Known Limitations in the final report). | — |
| "Finish SEO" / "package existing READY items" / "expand an incomplete collection" / explicit block branches named in the original spec | Business policy | **Not migrated** — the gate currently distinguishes only `generate` vs `resumeExistingWork` (unfinished runs / un-imported READY items) vs `repairExisting` (REVIEW/REJECT backlog). The 3 additional named branches were out of scope for this pass; documented as a known limitation, not silently dropped. | — |
| Design Plan field resolution (theme/category/marketplace/palette/etc.) | Presentation/technical — reshapes already-selected evidence into a displayable plan, no new decision | Not applicable | — |

The gate is evaluated once, synchronously (`runDecisionSync`), immediately
before a Design Plan would be built for a brand-new generation request. If
it recommends `resumeExistingWork` or `repairExisting`, the user sees "AI
does not recommend new generation yet." plus the real reason, policy IDs,
evidence IDs, confidence, and business impact, and can either navigate to
Autopilot History or explicitly click "Generate Anyway" to override. The
`initialAction` auto-start path (Mission Control quick actions that skip
the goal screen) does **not** currently route through this gate — it was
judged higher-risk to touch that automatic, already-tested one-shot path
within this pass; documented as a known limitation.

## 7. Removed/avoided duplication

No existing business-decision code was found duplicated *after* migration
that should have been deleted — every migrated rule's local computation
(counts, booleans) is technical extraction feeding the new policy, not a
parallel decision. The one exception plausibly worth calling out is
`autopilot/decisionEngine.ts`'s `selectEvidence` priority chain (mission >
opportunity > seasonal > portfolio-gap > evergreen), which is structurally
identical in spirit to the already-migrated marketplace 3-way fallback but
was not migrated in this pass (see Autopilot section above).
