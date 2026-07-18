# Submission Status — Build 015

Defined in `app/src/catalog/submission/submissionStatus.ts`. 8 statuses,
matching the brief's list exactly (internal identifiers use this
codebase's existing SCREAMING_SNAKE_CASE convention, the same style
`catalog/domain/types.ts`'s `WorkflowStatus` already uses):

| Brief's label | Code identifier | Meaning |
|---|---|---|
| Draft | `DRAFT` | Being prepared; snapshot fields are freely editable. |
| Ready | `READY` | Passed validation; not yet queued. |
| Queued | `QUEUED` | Waiting to be submitted — see `submissionQueue.ts`. |
| Submitted | `SUBMITTED` | Sent to the marketplace; awaiting a decision. |
| Approved | `APPROVED` | Accepted by the marketplace. Terminal except for archiving. |
| Rejected | `REJECTED` | Declined by the marketplace. Can return to Draft to retry. |
| Needs Revision | `NEEDS_REVISION` | Marketplace asked for changes. Can return to Draft to retry. |
| Archived | `ARCHIVED` | Shelved. Can only return to Draft — never straight back into a downstream status. |

## State machine

```
DRAFT ---------> READY ---------> QUEUED ---------> SUBMITTED
  ^                 |                 |                  |
  |                 v                 v          +--------+--------+
  |              ARCHIVED         ARCHIVED       v        v        v
  |                 ^                 ^      APPROVED  REJECTED  NEEDS_REVISION
  |                 |                 |          |         |          |
  +-----------------+-----------------+          v         |          |
                     |                        ARCHIVED     |          |
                     +-------- ARCHIVED <--------+----------+
                                    |
                                    v
                                  DRAFT
```

Full transition table (`SUBMISSION_STATUS_TRANSITIONS`):

| From | Legal destinations |
|---|---|
| `DRAFT` | `READY`, `ARCHIVED` |
| `READY` | `DRAFT`, `QUEUED`, `ARCHIVED` |
| `QUEUED` | `READY` (dequeue), `SUBMITTED`, `ARCHIVED` |
| `SUBMITTED` | `APPROVED`, `REJECTED`, `NEEDS_REVISION`, `ARCHIVED` |
| `APPROVED` | `ARCHIVED` |
| `REJECTED` | `DRAFT`, `ARCHIVED` |
| `NEEDS_REVISION` | `DRAFT`, `ARCHIVED` |
| `ARCHIVED` | `DRAFT` |

## Design rules

- **Every status can reach `ARCHIVED` directly.** A user must always be
  able to shelve a submission regardless of where it currently sits.
- **`ARCHIVED` can only return to `DRAFT`**, never straight back into a
  downstream status like `SUBMITTED`. Whatever made it archived should
  be re-reviewed from scratch, not silently resumed.
- **`DRAFT -> READY` is the one validation-gated transition.** Every
  other transition in the table above is structurally legal to *attempt*
  at any time (`canTransitionSubmissionStatus`/`assertValidSubmissionTransition`
  only check the state machine shape); `DRAFT -> READY` additionally
  requires `submissionValidation.ts`'s report to be `valid: true` —
  enforced by `submissionService.ts`'s `markReady`, the *only* function
  that can move a record into `READY`. `transitionSubmission` (the
  generic entry point) refuses to be used for that specific transition's
  business logic — validation always runs first.
- **`APPROVED` is terminal except for archiving.** There is no
  "un-approve" — a marketplace's approval decision is not something this
  app models as reversible.
- **`REJECTED` and `NEEDS_REVISION` both route back to `DRAFT`.** Both
  represent "the marketplace wants something different" — the record's
  snapshot fields become editable again (`EDITABLE_STATUSES` in
  `submissionService.ts` includes both, alongside `DRAFT` itself), and a
  resubmission conventionally bumps `version` (see
  `SUBMISSION_WORKFLOW.md`'s "Resubmitting after rejection").

## Illegal transitions

Any call to `transitionSubmission`/`markReady`/the named convenience
wrappers (`enqueueSubmission`, `markSubmitted`, `markApproved`, ...) for
a transition not in the table above throws
`InvalidSubmissionStatusTransitionError` (carrying both the `from` and
`to` status) — nothing is written to storage. Examples: `DRAFT ->
SUBMITTED` (must go through `READY` and `QUEUED` first), `APPROVED ->
DRAFT` (approval is terminal), `ARCHIVED -> SUBMITTED` (archived work
must be restored to `DRAFT` and re-reviewed, never resumed mid-flight).
