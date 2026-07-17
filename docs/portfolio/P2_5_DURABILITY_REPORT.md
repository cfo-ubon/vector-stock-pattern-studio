# P2.5 Sprint 3 — Durability Report

Real, measured results from `npm run validate:recovery:durability`
(Section 5) and `npm run validate:recovery:idempotency` (Section 6).
Both use `app/src/catalog/validation/durabilityEngine.ts`, the new
Sprint 3 library module built for exactly this purpose. Report JSON:
`validation-results/collections/recovery-durability.json` and
`recovery-idempotency.json`.

## Section 5 — 100 repeated recovery cycles per operation

`runDurabilityCycles(specFactory, deps, 100)` repeats the same
inject-fault → attempt → uninstall → retry → verify cycle 100 times per
operation (900 cycles total across all 9 operations), tracking whether
every single cycle was both **durable** (`retryOutcome === 'succeeded'`)
and **clean** (post-recovery integrity scan shows zero orphans/stale
covers/duplicates).

| Operation | Failure point used | Cycles | Durable | Clean | First failure cycle |
|---|---|---|---|---|---|
| createCollection | before-transaction | 100 | 100/100 | 100/100 | none |
| renameCollection | during-transaction | 100 | 100/100 | 100/100 | none |
| archiveCollection | during-transaction | 100 | 100/100 | 100/100 | none |
| unarchiveCollection | during-transaction | 100 | 100/100 | 100/100 | none |
| bulkAssign | during-transaction | 100 | 100/100 | 100/100 | none |
| bulkRemove | during-transaction | 100 | 100/100 | 100/100 | none |
| coverUpdate | during-transaction | 100 | 100/100 | 100/100 | none |
| metadataUpdate | during-transaction | 100 | 100/100 | 100/100 | none |
| deleteCollection | during-transaction | 100 | 100/100 | 100/100 | none |

**900/900 cycles durable and clean.** No operation ever regressed on a
later cycle — committed operations stayed durable, failed operations
never left partial state, across 100 full repetitions each.

`createCollection`'s 100 cycles reuse the same target name every cycle
(the fault fires `before-transaction`, so the real write never lands;
`retry()` checks for an existing record with that name before creating,
so cycles 2-100 are no-ops against an already-created record — this is
exactly the idempotent-recovery behavior Section 6 asks for, exercised
as a side effect of Section 5's repetition). `deleteCollection`'s 100
cycles instead use 100 distinct pre-created temporary collections (one
per cycle) since deletion is inherently a one-shot operation per target —
see `scripts/validateRecovery.ts`'s `runDurabilityMode` for the setup.

## Section 6 — Idempotency (repeated-recovery stability)

`verifyIdempotentRecovery(recover, captureSnapshot, equals, 5)` repeats a
single recovery action 5 times in a row and checks that the resulting
`ConsistencySnapshot` stops changing after the first repeat — no
duplicate collections/memberships/assets/cover references accumulate on
the 2nd, 3rd, 4th, or 5th repeat.

| Operation | Repeats | Stable | First divergence |
|---|---|---|---|
| bulkAssign | 5 | yes | none |
| bulkRemove | 5 | yes | none |
| archiveCollection | 5 | yes | none |
| unarchiveCollection | 5 | yes | none |
| metadataUpdate | 5 | yes | none |
| coverUpdate | 5 | yes | none |

**6/6 operations fully stable across 5 repeats.** Final integrity scan
after all 30 repeat-recovery calls: clean (0 orphans, 0 stale covers).

This directly reuses the same fix verified in Section 5 (the atomicity
fix to the 5 bulk-write functions) — idempotency depends on the domain's
own dedup logic (`addCollectionMembership`/`removeCollectionMembership`
in `domain/collectionMembership.ts`, unmodified this sprint) staying
correct under repetition, which these results confirm it does.

## What this does and doesn't prove

Durable and clean across 900 Node-side cycles proves the *logical*
recovery/retry contract holds under heavy repetition against
`fake-indexeddb`. It does not by itself prove real browser-disk
durability across a process crash — that's a separate claim, verified
separately in `P2_5_BROWSER_RECOVERY.md`'s crash-simulation section.
