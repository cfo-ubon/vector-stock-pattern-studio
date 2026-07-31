# Build 028 — Marketing Intelligence & AI Design Director

## Phase 1: Repository Audit + Proposed Architecture

Status: Phase 1 complete. Phases 2–7 not yet started.

Branch: `claude/build-028-marketing-design-intelligence`, based on `origin/main`
at commit `4344c99` (latest production commit — Application Backup System).
`claude/build-027-offline-pc-ipad` (Windows/iPad packaging, PARTIAL/PAUSED per
explicit user instruction) is untouched and left exactly as-is for later resumption.

---

## 1. Existing architecture this build must plug into

Audited directly from source (not assumed):

- **IndexedDB**: `app/src/storage/db.ts`. Single `IDBOpenDBRequest`,
  `DB_VERSION = 7`, `DB_NAME = 'vsp-db'`. One `onupgradeneeded` handler; every
  store creation is a `if (!db.objectStoreNames.contains(X)) db.createObjectStore(...)`
  guard, so upgrades are idempotent and additive. 15 stores exist today. Each
  version bump is documented in a header comment narrating v1…v7. This is the
  exact, only pattern used for schema evolution in this codebase — no ORM, no
  generic migration runner.
- **Domain record + store pairs**: every catalog subsystem (submission, queue,
  import, etc.) follows one shape: `<thing>Record.ts` (factory `create*Record`,
  defensive `normalize*Record`, type guard `isValid*Record`, opaque id format
  with a validator, `schemaVersion` field for additive-safe evolution) paired
  with `<thing>Store.ts` (IndexedDB CRUD via `openDb/idbAvailable/requestAsPromise`
  from `storage/db.ts`, an in-memory cache mirrored fire-and-forget to
  IndexedDB for synchronous reads, `whenXHydrated()`, and `seed*ForTest`/
  `reset*ForTest` hooks used by tests).
- **Knowledge facades**: `app/src/knowledge/<domain>/index.ts` — thin
  re-export surfaces over real logic living elsewhere, barrelled from
  `knowledge/index.ts` as `export * as XKnowledge from './x'`. No new logic
  belongs in a facade; it stabilizes an import surface.
- **Backup System** (`app/src/backup/appBackup*.ts`): registering a new store
  into the full `.vspsb` backup is exactly two edits — (a) add the store name
  to the `APP_BACKUP_STORE_NAMES` const array in `appBackupFormat.ts`, (b)
  nothing else; `appBackupBuilder.ts`/`appBackupRestore.ts` iterate that array
  generically via `dumpAllStores(...)`. New localStorage-backed settings (if
  any) go in `APP_BACKUP_SETTINGS_KEYS`.
- **Marketplace profiles**: `app/src/marketplaces/*.json` (Adobe Stock,
  Shutterstock, Etsy, Freepik, Creative Fabrica, Creative Market) loaded by
  `app/src/metadata/marketplaceProfiles.ts` into `MARKETPLACE_PROFILES`. No
  hardcoded marketplace list in TS — this build must read from here, not
  reinvent marketplace rules.
- **Trend/Design Spec system** (`app/src/trend/`): `DesignSpecification` +
  `KeywordBundle` is the existing "marketing input → design spec" shape, and
  `designSpecToParams.ts`'s `buildGenerateParamsFromDesignSpec(spec, seed)` is
  the exact, direct precedent for "marketing evidence → real generator
  params" that Module 2 Section 8 (Design Parameter Recommendation) must
  follow — a pure, traceable field-copy into `GenerateParams`, nothing
  invented at generation time.
- **Navigation**: `app/src/App.tsx` holds a single `view` union
  (`'editor' | 'dashboard' | 'trendStudio' | 'portfolio' | 'backup'`);
  `ProjectBar.tsx` renders nav buttons via `onOpenX` callback props. Adding a
  screen = extend the union, add a button + callback, add a `view === 'x'`
  render branch. This is exactly how `📈 นักการตลาด` and `🎨 นักออกแบบ` get added.
- **Scoring precedent**: `critic/commercialAppealScore.ts`'s
  `computeCommercialAppealScoreV2` combines only already-computed real
  sub-scores, documents each dimension's provenance in comments, and never
  pads with invented numbers. Commercial Opportunity Scoring extends this
  pattern but must go further per the user's explicit requirement: weights
  must be visible and user-editable (existing precedent uses a fixed
  unweighted mean), so this is new, not copied verbatim.
- **Existing commercial feedback engine**: `app/src/catalog/commercial/commercialFeedbackEngine.ts`
  already computes feedback signals from submission/sales/rejection data.
  Module 4 (Commercial Feedback Loop) must **wire into and extend this**,
  not duplicate it — `commercialFeedbackSignals` store persists snapshots of
  what that engine (plus new marketing-specific signals) produces.
- **Docs**: flat `docs/*.md`, `SCREAMING_SNAKE_CASE.md` naming, `docs/architecture/`,
  `docs/backup/` subdirs exist already — new docs follow this.
- **Tests**: `describe` per exported function, `it` per behavior, deterministic
  injectable `now`, co-located `<module>.test.ts`, named exports only.

---

## 2. Proposed module layout

```
app/src/marketing/                     Module 1 — Marketing Intelligence
  domain/
    researchSource.ts + .test.ts       (record: research source metadata)
    marketObservation.ts + .test.ts    (record: one observation, source-status enum)
    marketSnapshot.ts + .test.ts       (record: portable snapshot aggregate)
    marketKeyword.ts + .test.ts        (record: keyword intelligence + clustering)
    seasonalEvent.ts + .test.ts        (record: calendar event + region/marketplace profile)
    marketOpportunity.ts + .test.ts    (record: scored opportunity)
    scoringProfile.ts + .test.ts       (record: editable weight/band profile)
    dailyMission.ts + .test.ts         (record: Today's Mission + Daily Production Plan item)
  storage/
    researchSourceStore.ts, marketObservationStore.ts, marketSnapshotStore.ts,
    marketKeywordStore.ts, seasonalEventStore.ts, marketOpportunityStore.ts,
    scoringProfileStore.ts, dailyMissionStore.ts   (+ .test.ts each)
  scoring/
    opportunityScoring.ts + .test.ts   (transparent weighted scoring engine, Section 9)
  keyword/
    keywordClustering.ts + .test.ts    (Section 5)
  seasonal/
    seasonalTiming.ts + .test.ts       (Section 6 — start/submission-window math)
  gap/
    marketGapFinder.ts + .test.ts      (Section 7)
  compare/
    marketplaceComparison.ts + .test.ts (Section 8)
  mission/
    dailyMissionGenerator.ts + .test.ts (Section 1 + 10)
  snapshot/
    snapshotService.ts + .test.ts      (save/duplicate/compare/archive/export/import)
  components/                          (Marketing Intelligence Center UI, one file per section)

app/src/design-director/               Module 2 — AI Design Director
  domain/
    designBrief.ts, designStrategy.ts, designConfiguration.ts (+ .test.ts each)
  storage/
    designBriefStore.ts, designStrategyStore.ts, designConfigurationStore.ts (+ .test.ts)
  brief/
    briefGenerator.ts + .test.ts       (Section 1 — marketing evidence -> Design Brief)
  strategy/
    designStrategyModes.ts + .test.ts  (Section 2)
  categoryAssistants/
    <20 category files> + .test.ts     (Section 3 — real per-category controls, not renames)
  hero/
    heroMotifDesigner.ts + .test.ts    (Section 4, incl. pre-generation checks)
  secondaryFiller/
    secondaryFillerSystem.ts + .test.ts (Section 5)
  composition/
    compositionDirector.ts + .test.ts  (Section 6 — 16 compositions, strengths/weaknesses)
  color/
    colorDirector.ts + .test.ts        (Section 7)
  paramMapping/
    designParamRecommendation.ts + .test.ts (Section 8 — evidence -> GenerateParams, audited)
  collection/
    collectionBuilder.ts + .test.ts    (Section 9 — coherence score)
  review/
    preGenerationReview.ts + .test.ts  (Section 10)
  generation/
    generationResultLink.ts + .test.ts (Section 11 — lineage + READY/REVIEW/REJECT)
  components/                          (AI Design Director UI)

app/src/marketing/handoff/             Module 3 — Marketing -> Design handoff
  handoffService.ts + .test.ts         (status machine, evidence lineage, audit history)

app/src/marketing/feedback/            Module 4 — Commercial Feedback Loop
  feedbackSignals.ts + .test.ts        (wraps catalog/commercial/commercialFeedbackEngine.ts)

app/src/knowledge/market/index.ts + .test.ts   (facade barrel entry)
```

## 3. Data model (14 stores, DB_VERSION 7 → 8)

Every store follows the audited record+store pattern (opaque id + validator,
`schemaVersion`, `createdAt/updatedAt`, factory + normalize + type guard).
Field lists below are the store's persisted shape; UI-only derived values are
computed, not stored.

1. **researchSources** — id, sourceType, marketplace, sourceTitle, searchTerm,
   url, observationDate, region, language, note, tags[], createdAt.
2. **marketObservations** — id, researchSourceId, trendDirection,
   demandSignal (qualitative band), competitionSignal (band), buyerIntent,
   seasonality, notes, confidence, evidenceStatus (`VERIFIED_SOURCE |
   USER_IMPORTED | USER_OBSERVATION | LOCAL_SALES_DATA |
   LOCAL_PORTFOLIO_DATA | AI_INFERENCE | SAMPLE_DATA`), tags[], createdAt.
3. **marketSnapshots** — id, createdAt, researchDateRange{from,to},
   marketplaces[], regions[], sourceCount, keywords[], themes[], niches[],
   motifs[], styles[], colors[], seasons[], productUseCases[],
   observedCompetition, observedDemand, opportunityScores[] (opportunity id
   refs), recommendations[], confidence, dataFreshness, evidenceRefs[]
   (observation/source ids), archived: boolean.
4. **marketKeywords** — id, keyword, parentTheme, relatedKeywords[],
   marketplace, language, buyerIntent, trendDirection, competitionEstimate
   (band), opportunityEstimate (band), seasonalRelevance, productRelevance,
   portfolioCoverage, lastUsedDate, lastSubmittedDate, duplicateRisk,
   evidenceSource, confidence, cluster (`core|subject|style|color|
   composition|productUse|seasonal|buyerIntent`).
5. **seasonalEvents** — id, eventName, region, marketplaceProfile, eventDate,
   recommendedDesignStartDate, recommendedSubmissionStartDate,
   expectedDemandWindow{from,to}, lateProductionWarningDate, isGlobal,
   isUserDefined.
6. **marketOpportunities** — id, snapshotId, title, theme, niche, marketplace,
   score (see scoring engine output shape below), status, evidenceRefs[],
   createdAt.
7. **scoringProfiles** — id, name, weights (per-dimension, editable),
   bands (85/70/55/40 configurable thresholds + labels), isDefault,
   updatedAt.
8. **dailyMissions** — id, date, opportunityId, marketplace(primary/
   secondary), niche, theme, category, heroMotif, secondaryMotifs[],
   composition, colorDirection, density, buyerGroup, productUseCases[],
   designCount, colorwayCount, submissionTiming, opportunityScore,
   confidence, evidenceFreshness, risks[], status (`RESEARCH|SELECTED|
   BRIEF_READY|DESIGNING|GENERATED|QA_REVIEW|READY_TO_EXPORT|
   READY_TO_SUBMIT|SUBMITTED|ARCHIVED`).
9. **designBriefs** — id, sourceSnapshotId, sourceOpportunityId, marketplace
   (primary/secondary[]), targetCustomer, targetProduct, theme, niche,
   collectionTitle, visualConcept, emotionalDirection, heroMotif,
   secondaryMotifs[], fillerMotifs[], patternType, composition, style,
   palette, backgroundTreatment, density, scale, rhythm, negativeSpace,
   complexity, colorwaysRequired, exportFormats[], seoDirection,
   prohibitedElements[], commercialGoals[], evidenceLinks[], confidence,
   editableNotes, fieldRationale (map of field -> "Selected because…"
   string), lockedFields[], status.
10. **designStrategies** — id, mode (11 modes from Section 2), briefId,
    parameterDeltas (what the mode changed and why).
11. **designConfigurations** — id, briefId, generateParams (real
    `GenerateParams`, audited/traceable), mappingRationale[] (evidence ->
    param, per field), seed, createdAt.
12. **marketingDesignHandoffs** — id, snapshotIdFrozen, opportunityId,
    briefId, status (9-state machine from Module 3), missingInfoResolved[],
    auditHistory[] (status transitions with timestamp + actor).
13. **commercialFeedbackSignals** — id, signalType (`successful_theme|
    successful_palette|successful_motif|successful_marketplace|
    low_performing_collection|high_rejection_category|
    oversupplied_portfolio_area|profitable_niche|underused_keyword|
    repeat_buyer_opportunity`), evidenceRefs[], sampleSize, confidence,
    computedAt, sourceEngineVersion.
14. **recommendationHistory** — id, recommendationType, refId (mission/
    opportunity/brief id), recommendedValue, userDecision
    (accept/reject/postpone/edit), editedValue, decidedAt.

`storage/db.ts`: `DB_VERSION = 8`, one guarded `createObjectStore` block per
store above (with needed indexes, e.g. `marketSnapshots` by `createdAt`,
`marketOpportunities` by `snapshotId`), documented in the existing v1…v7
narrative comment as a new "v8 (Build 028)" entry. No existing store is
touched, renamed, or dropped — purely additive, matching every prior
migration in this codebase.

`appBackupFormat.ts`: all 14 store names appended to `APP_BACKUP_STORE_NAMES`.
No other backup code changes required per the audited generic-iteration
pattern; migration/compatibility tests added per existing convention
(`backup/migrationCompatibility.test.ts` precedent).

## 4. Evidence-provenance rule (non-negotiable, enforced in types)

`evidenceStatus`/`evidenceSource` is a **required, non-optional** field on
every record that feeds a recommendation (`marketObservations`,
`marketKeywords`, `marketOpportunities`, `designBriefs` field rationale).
Scoring and brief-generation code must refuse to silently default this to
`VERIFIED_SOURCE` — the type system makes `SAMPLE_DATA` a real, visibly
distinct enum member, and UI components render a badge from it directly
(no separate "is this real" boolean to fall out of sync).

## 5. Phase plan (this doc = Phase 1)

- **Phase 2**: `marketing/domain/*` + `marketing/storage/*` (research
  sources, observations, snapshots incl. save/duplicate/compare/archive/
  export/import, offline snapshot access), `storage/db.ts` v8 migration +
  migration tests, `knowledge/market` facade.
- **Phase 3**: opportunity scoring engine + editable `scoringProfiles`,
  Trend Explorer, Seasonal Calendar, Keyword Intelligence + clustering,
  Market Gap Finder, Marketplace Comparison, Daily Mission generator +
  Marketing Intelligence Center UI (nav item `📈 นักการตลาด`).
- **Phase 4**: `design-director/*` — Design Brief generator, 11 strategy
  modes, 20 category assistants, Hero/Secondary-Filler/Composition/Color
  Directors, param-mapping-with-audit-trail, AI Design Director UI (nav item
  `🎨 นักออกแบบ`).
- **Phase 5**: Marketing→Design handoff state machine + Collection Builder +
  Pre-Generation Commercial Review + generation result linking
  (READY/REVIEW/REJECT, no silent discard).
- **Phase 6**: Commercial Feedback Loop wired to existing
  `commercialFeedbackEngine.ts` + portfolio/submission/sales data.
- **Phase 7**: `.vspsb` backup integration/migration tests, full regression,
  responsive iPad/desktop viewport pass, offline-mode verification, 7 new
  docs + updates to `USER_GUIDE.md`/`CLAUDE.md`/architecture/backup/schema
  docs, `BUILD_028_REPORT.md`.

## 6. Build 027 preservation

`claude/build-027-offline-pc-ipad` is untouched by this branch (created from
`origin/main`, not from build-027). Its last state: commit `f34ccbd`
(Windows CI test fixes for the first real `windows-latest` run), with
GitHub Actions run `30608268686` in flight when this pause took effect —
result not yet confirmed. Status remains exactly:
Windows source implementation: completed to current state · Windows
downloadable delivery: pending · real Windows verification: pending · real
iPad verification: pending · overall: **PARTIAL / PAUSED BY USER**. No
Windows/iPad work will resume until Build 028 is complete and the user
explicitly instructs resumption.
