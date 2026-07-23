# Rejection Intelligence — Build 026

`app/src/catalog/submission/rejectionIntelligence.ts` (domain model +
normalizer) and `rejectionStore.ts` (IndexedDB persistence,
`rejectionRecords` store).

## Why this exists

Before Build 026, no structured rejection-reason field existed anywhere
in the codebase — `SubmissionRecord` only had a free-text `note` on its
status history. There was no way to analyze "which rejection reasons are
most common," "which preset gets rejected for what," or "did a
resubmission after this rejection actually get approved."

## The 17 categories

```ts
export type RejectionCategory =
  | 'technical-quality' | 'vector-construction' | 'similarity'
  | 'duplicate-content' | 'metadata' | 'trademark' | 'copyright'
  | 'ai-policy' | 'commercial-value' | 'composition' | 'color'
  | 'artifacts' | 'file-corruption' | 'unsupported-format'
  | 'keyword-issue' | 'category-issue' | 'other';
```

16 named categories plus the required `'other'` catch-all — every
rejection lands in a named category or `'other'`, never silently
dropped.

## Normalization: keyword-based, not ML

`normalizeRejectionReason(marketplaceReasonText)` is a deliberately
simple keyword/regex matcher over the marketplace's own rejection text —
no trained classifier, no ML dependency. Rules are checked in a specific
order, most-specific-first (e.g. `duplicate-content`'s "duplicate of a
previous submission" is checked before the more generic `similarity`'s
"too similar"), so a more specific match always wins. Anything matching
no rule falls back to `'other'` rather than guessing.

## Human correction wins

```ts
export function effectiveCategory(record: RejectionRecord): RejectionCategory {
  return record.correctedCategory ?? record.normalizedReason;
}
```

`correctedCategory` is `null` until a human reviews and confirms/corrects
the automated guess. Every downstream analysis (the Commercial Feedback
Engine's `topRejectionCategories`, `breakdownByCategory`) reads through
`effectiveCategory`, never `normalizedReason` directly — the automated
guess is the best available signal until a human overrides it, and it
never pretends to be more authoritative than that.

## `RejectionRecord` fields

| Field | Purpose |
|---|---|
| `marketplaceReasonText` | The marketplace's own text, verbatim — never edited or truncated |
| `normalizedReason` | Automated best-guess category |
| `userInterpretation` | The contributor's own notes — distinct from both the marketplace text and the automated guess |
| `correctedCategory` | Human-confirmed category, `null` until reviewed |
| `resubmissionResult` | `'pending' \| 'approved' \| 'rejected-again' \| null` — tracks whether a rework attempt succeeded |

## Storage

A plain IndexedDB store (`rejectionRecords`, keyPath `rejectionId`,
indexed by `submissionId` and `normalizedReason`) — no legacy data to
migrate, since this domain didn't exist before Build 026. Links to a
submission via `SubmissionRecord.rejectionRecordId` (schema v2, see
`docs/SUBMISSION_TRACKER.md`).
