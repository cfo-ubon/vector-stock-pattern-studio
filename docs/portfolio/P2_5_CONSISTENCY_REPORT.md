# P2.5 Sprint 3 — Consistency Manifest Report

Real, measured results from `npm run validate:recovery:consistency`
(Section 7). Reuses Sprint 2's unmodified
`captureConsistencySnapshot()`/`diffConsistencySnapshots()`
(`consistencyManifest.ts`) as `recoveryEngine.ts`'s `RecoveryDeps` — no
new snapshot mechanism was needed for Sprint 3. Report JSON:
`validation-results/collections/recovery-consistency.json`.

## The four manifests

1. **Before Failure** — a real `ConsistencySnapshot` captured before any
   fault is installed, against a freshly seeded dataset (50 assets, 10
   collections, zero pre-existing membership).
2. **After Failure** — captured immediately after a `during-transaction`
   fault (triggered on the 2nd of 6 `bulkAssign` puts) causes the
   operation to fail.
3. **After Recovery** — captured after the same `bulkAssign` call is
   retried without any injected fault.
4. **After Repeated Recovery** — captured after the same `bulkAssign`
   call is retried 3 more times (Section 6's idempotency requirement
   folded directly into the consistency manifest, per Section 7).

## Measured diffs

| Transition | Membership Δ | New orphans | New stale covers | Notes |
|---|---|---|---|---|
| Before → After Failure | 0 | no | no | The failed transaction rolled back completely — zero partial writes, matching the fixed atomicity guarantee. |
| After Failure → After Recovery | +6 | no | no | The retried `bulkAssign` succeeded in full — all 6 requested (asset, collection) pairs landed. |
| After Recovery → After Repeated Recovery | 0 | no | no | 3 further retries of the identical call added nothing further — idempotent by construction (`addCollectionMembership` dedupes). |

**Result: clean.** No unexplained asset/collection count mismatch at any
transition, no new orphaned memberships, no new stale cover references,
and the repeated-recovery membership delta is exactly 0 as expected.

## Automatic diffs

`diffConsistencySnapshots(before, after, expected)` computes every field
above automatically (asset/collection/membership/orphan/stale-cover/
duplicate-collectionId deltas) and flags `unexplainedAssetCountMismatch`/
`unexplainedCollectionCountMismatch`/`newOrphansIntroduced`/
`newStaleCoversIntroduced` — all four flags were `false` at every
transition in this run. `scripts/validateRecovery.ts`'s
`runConsistencyMode` passes `{ assetCountDelta: 0, collectionCountDelta:
0 }` as the expectation for the failure→recovery and recovery→repeated
transitions (bulk membership changes never change asset/collection
*counts*, only membership arrays) — both held exactly.

## Machine-readable output

The full manifest objects (`ConsistencySnapshot`'s `capturedAt`,
`assetCount`, `collectionCount`, `activeCollectionCount`,
`archivedCollectionCount`, `membershipCount`, `orphanCount`,
`staleCoverCount`, `duplicateCollectionIdAssetCount` for each of the four
captures) and the three `ConsistencyDiff` objects are in
`validation-results/collections/recovery-consistency.json`'s
`manifests`/`diffs` keys.
