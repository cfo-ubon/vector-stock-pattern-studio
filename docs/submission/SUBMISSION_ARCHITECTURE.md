# Submission Center Architecture — Build 015 (Commercial Workflow Foundation)

The first Commercial Workflow module. A production-ready submission
*management* subsystem — planning, tracking, and validating a pattern's
journey toward one or more marketplaces. It does **not** perform any
automatic upload; that is explicitly out of scope for this foundation
build.

## What this is, and isn't

A `SubmissionRecord` tracks ONE (pattern, marketplace) listing attempt
through its own lifecycle. A single pattern can have many records in
flight simultaneously — one per marketplace, or several over time after
a rejection. This is a materially different, richer concept than
`catalog/domain/types.ts`'s existing `WorkflowStatus` field on
`PortfolioAsset`, which tracks one *production-pipeline* status per
asset (draft/ready/submitted/approved/...) with no per-marketplace
fan-out. Both concepts coexist without conflict: `WorkflowStatus` says
"is this asset production-ready"; `SubmissionRecord` says "what has
happened when I tried to list this pattern on marketplace X."

## Layer map

```
app/src/catalog/submission/
  submissionStatus.ts             8-status state machine + transition rules
  marketplaceProfile.ts           Marketplace Profiles — 5 built-ins + runtime registry
  submissionRecord.ts             SubmissionRecord domain type + factory
  submissionStore.ts              Isolated localStorage-backed persistence
  submissionDuplicateDetection.ts Duplicate Detection (3 conflict rules)
  submissionValidation.ts         Submission Validation (structured readiness report)
  submissionService.ts            Orchestration layer (create/update/transition/delete)
  submissionQueue.ts              Submission Queue (read-side view over QUEUED records)
  submissionHistory.ts            Submission History (per-record + per-pattern timeline)
  submissionSearchFilter.ts       Submission Search + Submission Filter
  submissionStatistics.ts         Submission Statistics
  index.ts                        Public barrel
```

Every one of the brief's 9 named modules (Submission Queue, Submission
Record, Submission History, Marketplace Profiles, Submission Status,
Submission Validation, Submission Search, Submission Filter, Submission
Statistics) maps to a real file above — none were merged away or skipped.

## Decoupling: why `patternId` is a plain string

`SubmissionRecord.patternId` is deliberately **not** typed against
`catalog/domain/types.ts`'s `PortfolioAsset` — no file in this module
imports it. The Submission Center is a decoupled planning/tracking layer
that can reference a pattern from Portfolio Manager, the pattern
generator's own saved-patterns library, or any future source, without
importing (and so without any risk of coupling to, or needing to modify)
the frozen Collection API. A caller resolves `patternId` to whatever "the
pattern" means in its own context; `submissionValidation.ts`'s
`SubmissionReadinessInput` (`{ hasSvg, hasPreview }`) is the one place a
caller hands over pattern-derived facts, as plain booleans it already
computed itself — never a live object this module would need to know the
shape of.

This decoupling is also why `submissionRecord.ts` defines its own
`generateSubmissionId` (`SUB-YYYYMMDD-XXXXXX`, matching
`domain/id.ts`'s existing shape) rather than importing from
`domain/id.ts` — zero edits to any file outside `catalog/submission/`
were needed to build this module, keeping it unambiguously outside the
"do not modify the certified Collection API" and "do not modify Backup &
Restore" boundaries the brief set.

## Storage: isolated, no IndexedDB change

Per the brief ("No IndexedDB schema changes unless absolutely required...
create isolated submission storage" if persistence is needed),
`submissionStore.ts` is `localStorage`-backed: one dedicated
`vsp-submission-center-records` key, JSON serialize/parse, matching the
same convention already established by `workbench/workspaceSettings.ts`
and P3's `catalog/backup/backupHistoryStore.ts`. `storage/db.ts`'s
`DB_VERSION` was not touched, and no new IndexedDB object store was
created. The store recovers gracefully from corrupted or partially
malformed stored JSON (falls back to an empty store rather than
throwing), the same defensive pattern `backupHistoryStore.ts` uses.

## Marketplace Profiles: data-driven, extensible without code changes

`marketplaceProfile.ts` ships 5 built-in profiles — Shutterstock, Adobe
Stock, Freepik, Getty Images, Etsy — as plain data (id, label, keyword
count bounds, whether a description/category is required). This is a
distinct, deliberately lighter-weight concept from
`src/marketplaces/*.json` + `metadata/marketplaceProfiles.ts` (which
drive SEO text generation and export-package building for the pattern
generator's own Stock Submission Center) — this module only carries what
submission *readiness validation* needs, and imports nothing from that
system.

"Architecture must allow future marketplaces without code changes" is
satisfied concretely: `registerMarketplaceProfile(profile)` adds a new
marketplace to the live in-memory registry at runtime — a future
settings screen, a config loader, or a test can call it with no edit to
`marketplaceProfile.ts` itself required. `getMarketplaceProfile`,
`isKnownMarketplace`, and `listMarketplaceProfiles` all read from the
same registry, so a runtime-registered marketplace is immediately usable
everywhere validation/statistics/search look one up.

## Orchestration layer

`submissionService.ts` plays the same role `services/collectionService.ts`
plays for Collections: the one place record creation, status transitions,
validation, and storage are tied together, so nothing else needs to
coordinate `submissionStore.ts` + `submissionStatus.ts` +
`submissionValidation.ts` by hand. It never touches IndexedDB or the
Collection module — every read/write goes through `submissionStore.ts`.

## Public barrel

`index.ts` re-exports the full public surface, mirroring the convention
already used by other large feature modules in this repo (`src/assets/index.ts`,
`src/knowledge/index.ts`) — a future UI (Build 016, most likely) has one
import path instead of reaching into individual files.

## Explicitly out of scope for this foundation build

- **Automatic upload to any marketplace** — the brief's first constraint.
  Nothing in this module makes an HTTP request, opens a browser tab, or
  touches any marketplace's real API. "Marketplace" here means a local
  profile of rules, not a live integration.
- Any UI component, view, or button — service layer only, matching P2
  Stage 1's and P3's own "foundation first, no UI yet" precedent.
- Any modification to `docs/portfolio/COLLECTION_API_FREEZE.md`'s frozen
  surface, or to `catalog/backup/`'s Backup & Restore system — neither
  was touched; no production defect was found or claimed in either.
- A new IndexedDB object store or `DB_VERSION` bump — not needed;
  `localStorage` suffices for this foundation's scope.
