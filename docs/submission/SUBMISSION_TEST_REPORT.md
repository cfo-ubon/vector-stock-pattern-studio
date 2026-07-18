# Submission Center Test Report — Build 015

## Summary

```
Test Files  12 passed (12)
     Tests  98 passed (98)
  Duration  ~6s
```

Run with `npx vitest run src/catalog/submission/ --no-watch` from `/app`.
Zero failures, zero skipped tests. `npx tsc -b --force` and
`npx oxlint src/catalog/submission/` are both clean.

## Coverage by required test category

The brief mandates: Submission creation, Validation, Duplicate detection,
Status transitions, Filtering, Search, Statistics, Large dataset,
Regression. Every category is covered:

| Category | Test file | Representative tests |
|---|---|---|
| Submission creation | `submissionRecord.test.ts` | default field values, optional fields carried through, empty patternId/marketplaceId rejected, unique ids |
| Validation | `submissionValidation.test.ts` | every required check individually, multi-issue reporting, unknown marketplace, per-marketplace description requirement |
| Duplicate detection | `submissionDuplicateDetection.test.ts` | same-version, already-approved, already-submitted, cross-marketplace/cross-pattern non-conflicts, self-exclusion |
| Status transitions | `submissionStatus.test.ts`, `submissionService.test.ts` | full state machine table, golden happy path, illegal-transition rejection, rejected/needs-revision resubmission loop |
| Filtering | `submissionSearchFilter.test.ts` | marketplace/status/pattern/date-range filters, AND-combination |
| Search | `submissionSearchFilter.test.ts` | title/keyword/notes/patternId substring match, case-insensitivity, empty query |
| Statistics | `submissionStatistics.test.ts` | totalSubmissions, byStatus, byMarketplace, empty-list zero counts |
| Large dataset | `submissionLargeDataset.test.ts` | 2,000 records across 5 marketplaces / 400 patterns — persistence, filter, search, statistics, queue ordering, all at scale |
| Regression | full-suite run (below) | 244 test files / 2,843 tests, no change outside `catalog/submission/` |

## Test files

### `submissionStatus.test.ts` (9 tests)
Every status accepted/rejected by `isSubmissionStatus`; the full
transition table has an entry for every status; the golden happy path
(`DRAFT -> READY -> QUEUED -> SUBMITTED -> APPROVED -> ARCHIVED`) is
fully legal; every status can reach `ARCHIVED` directly; `ARCHIVED` can
only return to `DRAFT`; `APPROVED` is terminal except for archiving;
`REJECTED`/`NEEDS_REVISION` both route to `DRAFT`; `DRAFT` cannot skip to
`QUEUED`/`SUBMITTED`; `QUEUED` can fall back to `READY`;
`assertValidSubmissionTransition` throws `InvalidSubmissionStatusTransitionError`
(carrying `from`/`to`) for illegal transitions.

### `marketplaceProfile.test.ts` (7 tests)
Exactly the 5 required built-ins (Shutterstock, Adobe Stock, Freepik,
Getty Images, Etsy); every built-in resolves via `getMarketplaceProfile`;
`isKnownMarketplace` true/false; `registerMarketplaceProfile` adds a new
marketplace at runtime, immediately visible to every lookup — the
concrete proof of "future marketplaces without code changes"; rejects
re-registering an existing id (including a built-in) with
`DuplicateMarketplaceProfileError`; `resetMarketplaceProfileRegistry`
restores exactly the built-ins.

### `submissionRecord.test.ts` (11 tests)
Default field values on a fresh `DRAFT` record; every optional field
carried through when provided; empty/whitespace `patternId`/
`marketplaceId` rejected with `InvalidSubmissionInputError`; unique id
per call; `isValidSubmissionId` shape check; `normalizeSubmissionRecord`
fills in missing fields with safe defaults (mirroring
`normalizeCollection`) and leaves a fully-populated record unchanged;
`isValidSubmissionRecord` accepts real records and rejects garbage.

### `submissionStore.test.ts` (9 tests)
Empty by default; `putSubmission` insert and upsert-by-id;
`putSubmissionsBulk` for many records in one call; `deleteSubmission`
removes exactly the targeted record; `clearSubmissionStore`; graceful
recovery from corrupted localStorage JSON and from malformed entries
mixed into otherwise-valid JSON; isolation from other localStorage keys
(explicitly checked against P3's own `vsp-collection-backup-history` key
to prove no cross-contamination between the two isolated stores).

### `submissionDuplicateDetection.test.ts` (10 tests)
No conflict with no existing records; same-version detection; no
false-positive for a different version; already-approved and
already-submitted detected regardless of version; a single existing
record can trigger multiple simultaneous reasons; different marketplace
never conflicts; different pattern never conflicts; candidate excludes
itself via `submissionId`; a Draft/Rejected-only existing record never
triggers already-approved/already-submitted.

### `submissionValidation.test.ts` (13 tests)
Fully valid submission passes with zero issues; each required check
individually triggers its own issue code (missing-svg, missing-preview,
missing-title empty/whitespace, missing-description gated by marketplace
profile, insufficient-keywords and too-many-keywords against the real
Etsy 5-13 bound, missing-category); a marketplace with
`requiresDescription: false` does not require one; unknown marketplace
short-circuits to a single `unknown-marketplace` issue; every
simultaneous issue is reported together, not just the first; duplicate
integration (flags a conflicting existing record, does not flag its own
already-persisted self).

### `submissionService.test.ts` (13 tests)
`createSubmission` persists a `DRAFT`; `updateSubmissionDraft` updates
fields while editable, throws `SubmissionNotFoundError` for an unknown
id, throws `SubmissionNotEditableError` once `READY`, remains editable in
`NEEDS_REVISION`/`REJECTED`; `markReady` transitions on valid input and
leaves the record + status unchanged (persisted state included) on
invalid input; the full golden-path lifecycle
(`DRAFT -> READY -> QUEUED -> SUBMITTED -> APPROVED -> ARCHIVED`)
including `submittedAt` being set; the rejected -> draft -> ready
resubmission loop, including the history entry carrying its `note`;
every transition appended to `statusHistory` in order; illegal
transitions throw `InvalidSubmissionStatusTransitionError`; unknown id
throws `SubmissionNotFoundError`; `deleteSubmissionRecord` removes the
record permanently.

### `submissionQueue.test.ts` (4 tests)
Empty queue for no `QUEUED` records; FIFO ordering by `updatedAt` across
interleaved statuses; `getNextQueuedSubmission` returns the earliest and
`undefined` for an empty queue; `getQueueLength` counts only `QUEUED`.

### `submissionHistory.test.ts` (4 tests)
`getSubmissionHistory` returns a record's own `statusHistory` verbatim
and reflects appended transitions; `getPatternSubmissionTimeline`
returns every submission for one pattern across marketplaces oldest
first, and an empty array for a pattern with none.

### `submissionSearchFilter.test.ts` (12 tests)
`filterSubmissions`: no criteria returns everything; marketplace,
status, pattern, and inclusive date-range filters individually; multiple
criteria combine with AND semantics. `searchSubmissions`: empty/
whitespace query returns everything; case-insensitive title match;
per-keyword match (not a joined string); notes match; patternId match;
no-match returns empty.

### `submissionStatistics.test.ts` (3 tests)
All-zero counts for an empty list; `totalSubmissions`/`byStatus` counted
correctly across a mixed-status set; `byMarketplace` totals and
per-marketplace `byStatus` breakdown.

### `submissionLargeDataset.test.ts` (1 test, "Large dataset" category)
2,000 submissions — 400 distinct patterns x 5 built-in marketplaces, one
submission each, statuses cycling through Draft/Ready/Queued/Submitted/
Approved. Verifies: bulk write completes in well under 5 seconds;
`countSubmissions`/`loadSubmissions` round-trip all 2,000; a single-
marketplace filter returns exactly 400; every status filter returns
exactly 400; a text search matches only the intended subset and every
result genuinely contains the query; `computeSubmissionStatistics`
totals are internally consistent (`byMarketplace` totals sum correctly,
`byStatus` counts across the 5 cycled statuses sum to 2,000); queue FIFO
ordering holds over the full interleaved dataset; store clears back to
zero. 30-second test timeout; observed runtime well under that.

## Regression

Full pre-existing suite re-run alongside this new work with no change to
any file outside `app/src/catalog/submission/`:

```
Test Files  244 passed (244)   (was 232 before Build 015 — +12 new files)
     Tests  2843 passed (2843) (was 2745 before Build 015 — +98 new tests)
```

No change to `catalog/domain/collection.ts`, `catalog/domain/collectionMembership.ts`,
`catalog/storage/collectionStore.ts`, `catalog/services/collectionService.ts`
(the frozen Collection API surface, still guarded by
`collectionApiFreeze.test.ts`, which passed unmodified) or to any file
under `catalog/backup/` (Backup & Restore, P3).

## Known gaps

- No dedicated performance/soak test beyond the single 2,000-record large
  dataset case — out of scope for a foundation build whose brief asked
  for large-dataset *correctness*, not a new performance baseline (P2.5
  Sprint 1/2 already established that harness for the Collection module
  specifically).
- No UI-level test, since no UI was built this phase.
