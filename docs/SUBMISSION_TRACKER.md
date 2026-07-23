# Submission Tracker & Duplicate Prevention — Build 026

Extends Build 015's Submission Center (`docs/submission/SUBMISSION_ARCHITECTURE.md`)
rather than replacing it. Two additions: `SubmissionRecord` schema v2
(more fields to actually track a submission through a real production
workflow), and a 4th duplicate-detection rule layered on the existing
three.

## SubmissionRecord schema v2

`app/src/catalog/submission/submissionRecord.ts` — `SUBMISSION_SCHEMA_VERSION = 2`.
Every v2 field is optional on the interface and defaulted in
`normalizeSubmissionRecord`, so a v1 record already in a user's database
loads without crashing or losing data:

| Field | Purpose |
|---|---|
| `productionAssetId` | Links to `domain/productionAssetId.ts` — `null` until computed |
| `contributorAccountLabel` | Which of the user's own marketplace accounts this went out under |
| `submittedFilename` | The exact filename actually uploaded |
| `submittedFileTypes` | e.g. `['svg', 'eps']` — what file types were included |
| `editorialDesignation` | `'commercial' \| 'editorial' \| null` |
| `aiDeclaration` | `'not-ai-generated' \| 'ai-assisted' \| 'ai-generated' \| 'not-declared'` |
| `submissionBatchId` | Links to a `ProductionBatch` of type `'submission-batch'` |
| `reviewDate` / `approvedDate` / `rejectionDate` | Milestone timestamps beyond the existing `statusHistory` log |
| `rejectionRecordId` | Links to a `RejectionRecord` (see `docs/REJECTION_INTELLIGENCE.md`) |
| `resubmissionAllowed` / `resubmissionDate` | Tracks the rework path after a rejection |
| `marketplaceAssetId` / `marketplaceUrl` | The marketplace's own id/URL for the listing, once known |
| `reviewerNotes` / `userNotes` | Two separate free-text fields — a marketplace reviewer's own words vs. the contributor's own |

None of this changes `submissionStatus.ts`'s 8-status state machine or
any v1 field's meaning — v2 is purely additive.

## Duplicate detection: the 4th rule

`app/src/catalog/submission/submissionDuplicateDetection.ts` already had
three rules, all scoped to the same `(patternId, marketplaceId)` pair:
`same-version`, `already-approved`, `already-submitted`. Build 026 adds:

```
same-production-asset — an existing record for the SAME marketplace
carries the same content-derived productionAssetId but a DIFFERENT
patternId.
```

The first three rules are blind to this case by construction — they all
require the same `patternId`. A design re-imported under a new catalog
asset id (a renamed file, a re-exported copy, a fresh import of the same
generated SVG after a folder move) would otherwise sail through
undetected, even though it's byte-for-byte the same sellable content
already submitted to that marketplace. Candidates/records with a `null`
`productionAssetId` never match each other — `null` means "unknown," not
"same," so a pre-Build-026 record without one is never a false positive.

`detectDuplicateSubmission(candidate, existing)` remains a pure function
— it never reads or writes storage; callers pass in whatever existing
records are relevant (typically `loadSubmissions()`'s full result).
`submissionValidation.ts` and `portfolioHealthCalculator.ts` both now
pass `productionAssetId` through to it, and `submissionPackageBuilder.ts`
includes its result in every built package as
`duplicate-warning-report.json` (see `docs/SUBMISSION_PACKAGE_BUILDER.md`).

## Storage migration: localStorage → IndexedDB

Build 015 stored submissions in a single `localStorage` JSON blob
(`submissionStore.ts`). `storage/db.ts`'s DB_VERSION 5→6 upgrade
(Build 026) adds a `submissions` IndexedDB object store, indexed by
`patternId`, `marketplaceId`, `status`, and `productionAssetId`. The
`onupgradeneeded` handler only creates the empty store — it never reads
`localStorage` itself (an IndexedDB schema upgrade must not depend on
synchronous localStorage access). The one-time migration that reads the
old `localStorage` key and writes every record into the new store runs
in `submissionStore.ts` itself, the first time it opens after the
upgrade, with its own error handling rather than being a silent side
effect of `openDb()`.
