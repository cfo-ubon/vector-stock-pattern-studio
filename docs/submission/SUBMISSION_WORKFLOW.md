# Submission Workflow — Build 015

How a submission moves from creation through validation, queueing,
submission, and a marketplace's decision — and how duplicate detection
and search/filter/statistics fit around that lifecycle.

## End-to-end flow

```
1. createSubmission(input)                 -> SubmissionRecord (status: DRAFT)
2. updateSubmissionDraft(id, updates)      -> fill in title/description/keywords/category/notes
   [repeat step 2 until ready]
3. markReady(id, readiness)                -> SubmissionValidationReport
                                               + transitions to READY iff valid
4. enqueueSubmission(id)                   -> READY -> QUEUED
   [external process eventually reads the queue and performs the real
    submission action — see "What this build does NOT do" below]
5. markSubmitted(id)                       -> QUEUED -> SUBMITTED, sets submittedAt
6. one of:
   markApproved(id)                        -> SUBMITTED -> APPROVED (terminal)
   markRejected(id, note?)                 -> SUBMITTED -> REJECTED
   markNeedsRevision(id, note?)            -> SUBMITTED -> NEEDS_REVISION
7. (from REJECTED/NEEDS_REVISION) restoreSubmissionToDraft(id) -> DRAFT, editable again
   [return to step 2 for a resubmission, conventionally with version + 1]
8. archiveSubmission(id, note?)            -> any status -> ARCHIVED (shelve at any point)
```

## Creating a submission

```ts
const record = createSubmission({
  patternId: 'VSP-20260718-ABCDEF', // caller-resolved — see SUBMISSION_ARCHITECTURE.md
  marketplaceId: 'etsy',
  titleSnapshot: 'Floral Seamless Pattern',
  descriptionSnapshot: 'A lush spring floral pattern with soft pastel colors.',
  keywordSnapshot: ['floral', 'spring', 'seamless', 'pastel', 'nature'],
  category: 'Patterns',
});
// record.status === 'DRAFT'
```

Every field beyond `patternId`/`marketplaceId` is optional at creation —
a submission can start as a bare draft and be filled in incrementally via
`updateSubmissionDraft` (only permitted while `status` is `DRAFT`,
`NEEDS_REVISION`, or `REJECTED` — see `SUBMISSION_STATUS.md`'s "Design
rules").

## Validation before Ready

`markReady(submissionId, readiness)` is the only path into `READY`.
`readiness: { hasSvg, hasPreview }` is supplied by the caller — this
module has no way to inspect the pattern's actual files itself (see
`SUBMISSION_ARCHITECTURE.md`'s decoupling rationale). A caller backed by
Portfolio Manager derives it from a real `PortfolioAsset`:

```ts
const readiness = {
  hasSvg: asset.sourceFileReferences.some((f) => f.role === 'svg'),
  hasPreview: asset.previewReference !== null,
};
```

`markReady` always returns `{ record, validation }`. If
`validation.valid` is `false`, `record` is the **unchanged** input record
(still whatever status it was) — nothing was written, and the caller
inspects `validation.issues` to show what's missing. If `valid` is
`true`, `record` is the newly `READY` record.

Required checks (all must pass):

| Check | Source | Issue code |
|---|---|---|
| SVG exists | `readiness.hasSvg` | `missing-svg` |
| Preview exists | `readiness.hasPreview` | `missing-preview` |
| Title exists | `record.titleSnapshot` non-empty | `missing-title` |
| Description exists | `record.descriptionSnapshot` non-empty, if the marketplace profile requires one | `missing-description` |
| Keywords available | `record.keywordSnapshot.length` within the marketplace's `minKeywords`/`maxKeywords` | `insufficient-keywords` / `too-many-keywords` |
| Category assigned | `record.category` non-null, if the marketplace profile requires one | `missing-category` |
| No duplicate submission to the same marketplace | `submissionDuplicateDetection.ts` | `duplicate-submission` |

An unregistered `marketplaceId` short-circuits with `unknown-marketplace`
alone — every other check is marketplace-relative and meaningless
without a profile to check against.

## Duplicate detection

`detectDuplicateSubmission({ patternId, marketplaceId, version, submissionId? }, existing)`
checks three independent rules, all scoped to the same
(patternId, marketplaceId) pair — a different marketplace or a different
pattern is never a conflict:

1. **same-version** — an existing record for the exact same
   (pattern, marketplace, version) already exists, in any status.
2. **already-approved** — an existing record for this (pattern,
   marketplace), any version, is `APPROVED`.
3. **already-submitted** — an existing record for this (pattern,
   marketplace), any version, is currently `SUBMITTED` (pending).

The candidate's own `submissionId` (when re-validating an existing
record) is excluded from the comparison set, so a record never conflicts
with itself.

## Resubmitting after rejection

There is no dedicated "resubmit" function — the workflow is:
`restoreSubmissionToDraft` (REJECTED/NEEDS_REVISION -> DRAFT) ->
`updateSubmissionDraft` (fix whatever was flagged, and conventionally
increment `version` via the same call, e.g.
`updateSubmissionDraft(id, { version: record.version + 1, ... })` — note
`version` is not currently part of `SubmissionDraftUpdate`'s typed field
set; a resubmission that needs a version bump constructs the updated
record directly via `submissionStore.putSubmission`, or a future
extension adds `version` to the editable fields) -> `markReady` again.
The **same** `submissionId` is reused across attempts — a resubmission is
not a new record, it is the same listing attempt continuing after
revision, which is exactly what keeps `statusHistory` a complete,
continuous record of everything that happened to this one submission.

## Queue

`getSubmissionQueue(records)` — a pure, read-only view filtering to
`QUEUED` status and sorting FIFO by `updatedAt` (the moment each record
most recently entered `QUEUED`, since every transition bumps
`updatedAt`). `getNextQueuedSubmission(records)` returns the head.
Actually moving a submission into or out of `QUEUED` is
`submissionService.ts`'s job (`enqueueSubmission`,
`transitionSubmission(id, 'READY')` to dequeue) — the queue module itself
never mutates anything, keeping "what's next" logic trivially testable
against an in-memory list.

## What this build does NOT do

Nothing in `submissionService.ts` or anywhere else in this module ever
calls out to a real marketplace. `markSubmitted` only means "this app
now records the status as Submitted" — the actual act of uploading files
and metadata to Shutterstock/Adobe Stock/Freepik/Getty Images/Etsy is
external to this foundation, explicitly deferred per the brief's "Do NOT
implement automatic upload to any marketplace." A future build would
insert a real upload step between `enqueueSubmission` and
`markSubmitted`, calling `markSubmitted` only after a real upload
succeeds.

## Search and filter

Both are pure functions over an in-memory record list (typically
`loadSubmissions()`, or any already-narrowed subset):

```ts
filterSubmissions(records, { marketplaceId: 'etsy', status: 'READY' });
filterSubmissions(records, { patternId, createdFrom, createdTo });
searchSubmissions(records, 'floral'); // case-insensitive, matches title/keywords/notes/patternId
```

## Statistics

```ts
const stats = computeSubmissionStatistics(records);
stats.totalSubmissions;              // number
stats.byStatus.READY;                // count across every marketplace
stats.byMarketplace.etsy.total;      // count for one marketplace
stats.byMarketplace.etsy.byStatus.QUEUED;
```

`byStatus` reports all 8 statuses (a superset of the brief's 5 named
ones — Ready/Queued/Submitted/Approved/Rejected — Draft/NeedsRevision/
Archived counts cost nothing extra and are strictly more information).
