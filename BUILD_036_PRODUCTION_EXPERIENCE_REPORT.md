# Build 036 (spec: Mission 6) — Production Experience Layer

## Naming disclosure

The spec was titled "Mission 6 / Production Experience" and referenced
"Mission 5 Factory Orchestrator" (commit `6fbecb3`) as the verified
baseline. This build is numbered **Build 036** for continuity with this
repository's own sequential Build numbering (Build 032 = Mission 2, Build
033 = Mission 3, Build 034 = Mission 4, Build 035 = Mission 5) — Mission 6
is this sequence's next build, not a renumbering of anything before it.

## What this means

Missions 1-5 built five real engines (Decision OS, Factory Controller,
Factory Intelligence, Continuous Improvement, Production Autopilot) and
one coordination layer (Factory Orchestrator) — but, as Build 035's report
disclosed, none of it had a screen. An owner could not press a button
anywhere in the app to start, watch, review, or finish a production run.
This build adds **no new engine and no new decision logic** — it adds the
first UI that calls `FactoryOrchestrator.startFactory()` and the other
already-existing engine functions, reshaping their real outputs into one
daily workflow: **Home → Start Factory → Progress → Review → Export →
Dashboard → Session Summary**.

## Files

**New pure-logic module — `app/src/productionExperience/`:**
- `progressStages.ts` — derives the 7-stage `ProductionProgressStage`
  (`PREPARING|PLANNING|WAITING_APPROVAL|RUNNING|QA|PACKAGING|COMPLETED`)
  from the real `OrchestrationRun.status` (Mission 5's 11-state machine)
  and the real `FactoryTask[]` queue. For halted states
  (`PAUSED|BLOCKED|CANCELLED|FAILED`) it freezes the stepper at the real
  last-known non-halted stage (walking `run.history` backwards) instead of
  resetting or fabricating progress — satisfies the spec's "Never fake
  progress."
- `ownerActionCenter.ts` — `buildOwnerActionCenter(run, reviewWaitingCount,
  exportReadyCount)`, a pure filter producing only real, non-zero
  `OwnerActionItem[]`.
- `reviewWorkspace.ts` — `latestQualitySnapshotsByAsset` (real max-by-
  `createdAt` per asset), `buildReviewWorkspaceItems` (assets whose LATEST
  `QualitySnapshot.decision === 'REVIEW'`, excluding archived assets),
  `countReviewWaiting`. Reuses Build 026's existing `QualityDecision`
  classification — no new scoring model.
- `index.ts` — barrel.

**New components — `app/src/components/productionExperience/`:**
- `ProductionHomeView.tsx` — the single container. Manages its own
  internal `screen` state (`home|progress|review|export|dashboard|
  summary`) rather than five separate top-level `App.tsx` views, to
  satisfy Part 9's "One workflow. No duplicated UI." All Factory
  Orchestrator calls go through the `factoryOrchestrator` barrel
  (`StartFactory`, `resumeInterruptedFactoryRun`, `approveFactoryRun`,
  `executeFactoryRun`, `cancelFactoryRun`, `completeFactoryRun`) — never a
  submodule import — so this view can never bypass the orchestrator.
  Parts 2/7/8/10 (Daily Brief, Dashboard numbers, Continue Yesterday,
  Session Summary) are all read directly from `productionAutopilot`'s
  existing functions (`generateProductionDailyBrief`,
  `checkContinueYesterday`, `reviewProductionCompletion`,
  `recordOwnerDecision`) with zero recomputation.
- `ProgressStepper.tsx` — presentational 7-step stepper +
  halted-reason banner (`role="alert"`).
- `OwnerActionCenterList.tsx` — renders `null` when there is nothing to
  act on (Part 4's "hide everything that does not require action," taken
  literally).
- `ReviewWorkspacePanel.tsx` — per-row and bulk Approve/Reject/Repair.
- `FactoryDashboardPanel.tsx` — purely presentational; every value arrives
  pre-computed as a prop (Part 12 — no internal computation).
- `SessionSummaryPanel.tsx` — renders `ProductionCompletionReview` fields
  as-is.
- `productionExperience.css` — reuses the app's existing `--bg`/`--panel`/
  `--border`/`--text`/`--accent` custom properties and `@media (max-width:
  1100px)` / `(max-width: 800px)` breakpoints already used everywhere else
  in the app; no new design system.

**Reused wholesale, zero duplication:** the Export screen renders the
existing `CommercialPipelineTab` (Build 031A) directly — `<CommercialPipelineTab
assets={[]} />` — because that component already self-loads via
`loadCommercialPipelineContext()` and its `assets` prop is dead. Part 6 is
satisfied with zero new export logic or UI.

**Edited:**
- `app/src/components/ProjectBar.tsx` — new `onOpenProduction` prop and a
  `🏭 Today's Production` button, placed right after Mission Control and
  before the Autopilot button.
- `app/src/App.tsx` — new `'production'` view branch rendering
  `<ProductionHomeView onClose={() => setView('missionControl')} />`.

**New tests** (9 files, one per module/component, following this repo's
established convention — real `fake-indexeddb`-backed stores cleared in
`beforeEach`, never mocked): `progressStages.test.ts`,
`ownerActionCenter.test.ts`, `reviewWorkspace.test.ts`,
`ProgressStepper.test.tsx`, `OwnerActionCenterList.test.tsx`,
`ReviewWorkspacePanel.test.tsx`, `FactoryDashboardPanel.test.tsx`,
`SessionSummaryPanel.test.tsx`, `ProductionHomeView.test.tsx` (integration
— Good Morning brief, Start Factory → Progress, Continue Yesterday,
Review Approve/Reject reclassification, Export renders the real
Commercial Pipeline, Back calls the real `onClose`). 36 tests total.

## A real bug found and fixed during testing

`ProductionHomeView`'s Review Workspace `Approve`/`Reject` handlers
initially only mutated `PortfolioAsset.workflowStatus`. But
`buildReviewWorkspaceItems` (which drives what the Review Workspace shows)
filters strictly on the asset's **latest `QualitySnapshot.decision`** — a
separate field `workflowStatus` never touches. Clicking Approve did not
actually remove the item from the Review Workspace: a genuinely broken
user-facing loop, caught by an integration test's `waitFor` timing out.
Fixed by making Approve/Reject also create and persist a new
`QualitySnapshot` (via the existing `createQualitySnapshot`/
`putQualitySnapshot`) with `decision: 'READY'` or `'REJECT'` — copying
`beautyScore`/`commercialScore`/`fragmented`/`deadSpace`/
`generatorVersion` from that asset's real prior snapshot (via
`latestQualitySnapshotsByAsset`), changing only the decision. This is an
honest, real, timestamped owner-override reclassification, not a second
scoring model — no new field was invented.

## What was NOT built (honest disclosure)

- **Light Mode**: the app has no light-mode infrastructure anywhere (dark
  colors are hardcoded in `App.css`'s custom properties) — Part 11 asked
  for it, but building a whole light theme was out of scope for a
  UI-wiring mission and no prior mission built the groundwork for it
  either. Disclosed rather than faked.
- **Live SVG thumbnails in the Review Workspace**: items show the asset's
  display name, real Beauty/Commercial scores, and real
  fragmented/dead-space flags as text — not a rendered preview. No
  reusable SVG-thumbnail component existed in the codebase to wire in
  without building a new rendering pipeline, which this mission's "reuse
  every existing engine" constraint argues against inventing.
- **iPad/tablet and keyboard-only verification**: CSS breakpoints and
  `aria-*` attributes (`role="list"`, `aria-current="step"`, `role="alert"`)
  are in place and match the app-wide convention, but only a Desktop-size
  (1400×900) browser check was actually run (see below) — iPad-size and
  keyboard-only navigation were not empirically exercised in this build.

## What WAS verified

- `npx tsc -b` — clean, zero errors, across the whole app.
- `npm run lint` (oxlint) — clean; only 2 pre-existing warnings unrelated
  to this build (`submissionPackageBuilder.ts` no-control-regex,
  `evidenceDisplay.tsx` only-export-components).
- `npm run build` — clean production build; `/studio` rebuilt with the
  current bundle.
- Full regression suite, run twice clean (`node_modules/.vite`/
  `.vite-temp` cleared before each run, both runs executed explicitly from
  within `app/`):
  - Run 1: **487 test files passed (487), 4344 tests passed (4344)**.
  - Run 2: **487 test files passed (487), 4344 tests passed (4344)**
    (identical to run 1).
- **Real browser verification** (Chromium via Playwright, dev server,
  1400×900 viewport, zero console/page errors observed):
  - Home screen renders the real Good Morning brief, all 6 tiles, and the
    single `▶ START FACTORY` action.
  - Clicking `START FACTORY` calls the real `FactoryOrchestrator.
    startFactory()` and lands on the Progress screen showing
    "Waiting Approval" (correctly current) with the real
    "Approve today's production session" action — end-to-end proof the
    UI is wired to the real orchestrator, not a mock.
  - Dashboard screen renders all 7 real numbers with an honest "No factory
    activity yet." status and em-dash for the null Factory Health score.
  - Export screen renders the full, real Commercial Pipeline (Build 031A)
    — Business Metrics, Export Readiness Dashboard, Commercial Package
    Builder — unmodified.
  - Review screen shows the honest empty state ("Nothing waiting for
    review right now.") with no fabricated content.

## Business Safety / architecture note

- **Never bypass Factory Orchestrator (Part 1)**: every state-changing
  call in `ProductionHomeView` goes through the `factoryOrchestrator`
  barrel; there is no direct call into `productionAutopilot`'s workflow
  internals or any lower-level engine for starting/approving/executing/
  cancelling/completing a run.
- **Real reclassification, not UI-only hiding (Part 5)**: Review
  Approve/Reject writes a real, timestamped `QualitySnapshot` in addition
  to `workflowStatus` — the item leaves the Review Workspace because its
  real latest classification changed, not because it was hidden client-side.
- **No duplicated business logic (Part 9 / success criteria)**: Progress,
  Owner Action Center, Dashboard, and Session Summary are all pure
  reshapings of already-computed engine output (`OrchestrationRun`,
  `FactoryTask[]`, `ProductionDailyBrief`, `ProductionCompletionReview`) —
  no new score, gate, or decision rule was introduced anywhere in this
  build.
- **Export stays owner-approved (Part 6)**: reusing `CommercialPipelineTab`
  unmodified means the existing no-auto-upload guarantee from Build 031A
  carries over unchanged.
- **No new backup surface needed (Part 14)**: this build introduces zero
  new IndexedDB stores — it only reads/writes existing stores (factory
  queue/timeline, portfolio assets, quality snapshots, orchestration runs,
  production sessions, owner decisions), all already covered by `.vspsb`
  since Missions 4-5.

## Commit

Committed to branch `claude/build-030-ai-ceo-mission-control`.
