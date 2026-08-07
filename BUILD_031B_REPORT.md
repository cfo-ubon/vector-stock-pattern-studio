# Build 031B — Decision OS: The Business Brain

**Status: Shipped (partial integration, honestly scoped — see Known Limitations)**

## What this build is

Build 031B is not a feature or a dashboard. It is the shared Policy →
Evidence → Confidence → Decision engine ("Decision OS") the spec asked
for: one place where a business rule is expressed once, as data, and
every AI module in the app can ask "what should happen here?" instead of
encoding its own if/switch logic.

This build delivers the full core engine, a complete test suite for it,
and **two real, verified integrations** into existing modules — replacing
their inline decision logic with calls into the Decision OS while
preserving their exact existing output shape and UX. It does **not**
integrate all five modules named in Part 10 of the spec; see Known
Limitations for what's left and why.

## What was built

### Core engine (`app/src/decisionOS/`)
- **Policy Engine** (`policyEngine.ts`) — in-memory registry of
  `PolicyDefinition` objects (fully data-driven except one `evaluate`
  function each), plus a small IndexedDB-backed override layer (Part 9:
  enable/disable/reprioritize a policy without touching source code, no
  UI required).
- **Evidence Engine** (`evidenceEngine.ts`) — 9 registered providers (one
  per `EvidenceSourceKind`: portfolio, collection, qa, commercial,
  marketplace, businessGoals, mission, pipeline, export), each a pure
  `(context) => EvidenceRecord[]` function reading only caller-supplied
  `context.data` — never IndexedDB directly. A request-scoped
  `EvidenceCache` avoids re-running a provider twice within one decision.
- **Confidence Engine** (`confidenceEngine.ts`) — derives a 0–100 score
  from real inputs only (evidence completeness, policy coverage, missing
  data penalty, conflict penalty, freshness penalty). Zero evidence always
  yields score 0 / band `'unknown'` — never a fabricated mid-range guess.
- **Decision Engine** (`decisionEngine.ts`) — `evaluateDecision` (pure,
  directly unit-testable, no I/O) and `runDecision` (async, loads real
  Part 9 overrides from IndexedDB). Added `runDecisionSync` — a
  synchronous sibling that evaluates against policies' code-defined
  defaults (no override lookup) so a previously-synchronous, directly-
  testable caller doesn't have to become async just to adopt the Decision
  OS.
- **Business Impact** (`businessImpact.ts`) — a fixed qualitative enum
  (`VERY_HIGH`/`HIGH`/`MEDIUM`/`LOW`/`UNKNOWN`), **never** a revenue
  estimate. Downgraded by confidence band; unknown confidence forces
  `UNKNOWN` impact outright rather than a partial downgrade (a bug caught
  and fixed during this build — see Errors Found and Fixed below).
- **Decision Timeline** (`decisionTimeline.ts` + `storage/`) — append-only
  audit history of every recorded `Decision`. Explicitly not consulted by
  any policy or evidence provider — this build has no learning logic, per
  the spec.
- **Policy set** (`policies/`) — 15 policies across 4 domains:
  - Factory (7): completeExistingWorkFirst, repairBeforeGenerate,
    qaBeforeExport, seoBeforePackaging, packagingBeforeExport,
    noDuplicatePackage, noIncompleteCollectionExport
  - Portfolio (3): avoidOversaturation, preferMissingCategories,
    preferCollectionDiversity
  - Marketplace (4): useVerifiedProfilesOnly, preferLiveMarketEvidence,
    preferPortfolioGap, preferEvergreenWhenDemandUnknown
  - Commercial (1): neverExportBelowReadinessThreshold

### Real integrations (Part 10)
Two of the five named modules now route their core decision through the
Decision OS, with **zero change to observable output** (verified by their
existing, unmodified test suites passing unchanged):

1. **`aiCeo/decisionEngine.ts`** — the 3-way market-evidence /
   Portfolio-gap / evergreen-fallback choice, previously an inline
   `if/else if/else` chain, is now decided by `MARKETPLACE_POLICIES`
   via `runDecisionSync`. The three recommendation-building functions
   (`marketDrivenRecommendation`, `portfolioGapRecommendation`,
   `evergreenFallbackRecommendation`) are unchanged; only which one gets
   called is now Decision-Engine-routed. `aiCeo/businessCoach.ts` and
   `aiCeo/morningBrief.ts` both inherit this automatically since they
   call `rankAiCeoRecommendations`.
2. **`aiCeo/portfolioDoctor.ts`** — the category-concentration
   UNBALANCED/HEALTHY threshold check is now decided by
   `PORTFOLIO_POLICIES`'s `avoidOversaturation` policy. The max-category/
   share math is still computed locally (Decision OS reasons about data,
   it never recomputes it); only the threshold decision itself moved.

Two thin adapters (`decisionOS/adapters/marketplaceAdapter.ts`,
`decisionOS/adapters/portfolioAdapter.ts`) reshape each caller's
already-computed data into the `DecisionRequestContext.data` shape the
relevant evidence providers expect.

### Bug found and fixed during integration
Writing `factoryPolicies.test.ts` surfaced a real, pre-existing shape
mismatch: `qaEvidenceProvider`'s `qa:assetQaStatus` evidence record's
`value` is `{ passed: boolean | null }`, but `factoryPolicies.ts`'s
`qaBeforeExport` policy read it as `QaEvidenceInput` and accessed
`.assetQaPassed` (always `undefined`). This meant `qaBeforeExport` would
have unconditionally blocked every export request regardless of actual
QA status. Fixed by typing that evidence record locally as
`{ passed: boolean | null }` and reading `.passed`. Caught entirely by
the new test suite before this policy was ever wired into a real caller —
it never shipped broken.

### Part 14 — Backup
- Closed a pre-existing Build 031A gap: `commercialPackageHistory` was
  created in the DB schema but never added to `APP_BACKUP_STORE_NAMES`,
  so it was silently excluded from every `.vspsb` backup since Build
  031A shipped.
- Added `decisionTimeline` and `decisionPolicyOverrides` to the same
  list.
- All 3 stores verified with a dedicated round-trip test
  (`appBackup031BStores.test.ts`): non-empty backup/restore, and clean
  empty-store behavior.
- `storage/db.ts`: `DB_VERSION` 13 → 14 (v13→v14 migration adds
  `decisionTimeline` and `decisionPolicyOverrides`, both
  idempotent-guarded like every other store in this file).

### Part 12/13 — Offline & Performance
- Zero network calls anywhere in `decisionOS/` — every evidence provider
  reads only `context.data`, supplied entirely by the caller's own
  already-loaded records.
- `EvidenceCache` is request-scoped (created per `runDecision`/
  `runDecisionSync` call or per batch), never a module-level singleton —
  verified by `evidenceEngine.test.ts`'s cache-isolation tests.

## Testing

- **67 new decisionOS unit tests** across 11 files: policy engine (5),
  evidence engine (6), confidence engine (6), decision engine incl.
  `runDecisionSync` integration (7), business impact (5), storage
  round-trips for both new stores (7), and per-domain policy tests —
  factory (13), portfolio (6), marketplace (7), commercial (5).
- **3 new backup round-trip tests** (`appBackup031BStores.test.ts`).
- Fixed 6 stale `DB_VERSION`-hardcoded assertions in
  `storage/db.migration.test.ts` (13 → 14) that the version bump broke —
  a real test-maintenance fix, not a regression.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean except 2 pre-existing warnings in files this
  build never touched (`submissionPackageBuilder.ts` control-regex,
  `evidenceDisplay.tsx` fast-refresh) — confirmed via `git status` on
  those two files.
- **Full regression suite run twice, both clean**: 429/429 test files,
  4023/4023 tests passing both times.
- `npm run build`: production build succeeds; `/studio` rebuilt with the
  new bundle (content-hashed chunk names changed as expected since
  `decisionOS/` is now bundled into `App.tsx`'s import graph via
  `aiCeo/decisionEngine.ts` and `aiCeo/portfolioDoctor.ts`).
- Browser verification: served the rebuilt `/studio` via `vite preview`
  and confirmed the app shell loads (HTTP 200 at the correct GitHub
  Pages base path, all JS/CSS assets resolve). A full interactive
  Playwright walkthrough of Mission Control / Portfolio Doctor screens
  was **not** performed — Playwright is not an installed dependency in
  this project and this session did not add one. This is a real gap,
  not a claim of full UI verification.

## Known Limitations / Explicitly Out of Scope

1. **Only 2 of the 5 named Part 10 modules were integrated.**
   `commercial/commercialRecommendation.ts` (`actionForBucket`),
   `autopilot`'s generation orchestrator, and
   `missionControl/heroOpportunity.ts` still use their own inline logic.
   `commercialRecommendation.ts` in particular is a strong future
   candidate (its ordered collection/QA/SEO/threshold checks map closely
   onto the existing Factory/Commercial policies), but integrating it
   without changing its `CommercialRecommendation[]` output ordering/
   content needed more time than this pass had. Doing so is the natural
   next increment.
2. **Policy Management (Part 9) has no consumer yet.** The override
   storage layer (`policyOverrideStore.ts`, `setPolicyStatus`/
   `setPolicyPriority`/`clearPolicyOverride`) is built, tested, and wired
   into `loadEffectivePolicies`/`runDecision`, but nothing in the app
   currently calls those setters — there's no way for an operator to
   actually change a policy's status/priority yet (by design, Part 9
   says "no large UI"; a minimal invocation path may still be worth
   adding later).
3. **No Playwright-verified interactive browser walkthrough** — see
   Testing section above.
4. **`businessGoalsEvidence.ts` and `exportEvidence.ts` are registered
   but unconsumed** by any of the 15 current policies — built ahead of
   need per the spec's "reusable" requirement, exactly like Build 031A's
   own pattern for pre-provisioned-but-unused stores.

## Commits

- `958425b` — Build 031B: Decision OS core, real integrations into AI
  CEO + Portfolio Doctor (pushed to
  `claude/build-030-ai-ceo-mission-control`)
- (this commit) — `/studio` production rebuild + this report

## Files changed

- New: 39 files under `app/src/decisionOS/` (domain types, policy
  engine, evidence engine, confidence engine, decision engine, business
  impact, decision timeline, 9 evidence providers + barrel, 4 policy
  domain files + barrel, 2 storage modules, 2 adapters, 11 test files)
- New: `app/src/backup/appBackup031BStores.test.ts`
- Modified: `app/src/aiCeo/decisionEngine.ts`,
  `app/src/aiCeo/portfolioDoctor.ts`, `app/src/backup/appBackupFormat.ts`,
  `app/src/storage/db.ts`, `app/src/storage/db.migration.test.ts`,
  `docs/USER_GUIDE.md` (v1.90 changelog entry)
- Rebuilt: `/studio` (production bundle)
