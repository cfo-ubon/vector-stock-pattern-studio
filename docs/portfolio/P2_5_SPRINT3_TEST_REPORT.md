# P2.5 Sprint 3 — Test Report

Covers the tests added this sprint for the new recovery/durability
library modules (Section 12 of the brief). Full-suite regression results
(before/after, covering every prior sprint's tests plus these) are
reported in `P2_5_SPRINT3_REPORT.md`'s "Full Regression Result" section,
not duplicated here.

## New test files (21 tests total, all passing)

### `recoveryEngine.test.ts` (15 tests)

**`ALL_FAILURE_INJECTION_POINTS`** (1 test)

- lists exactly the 9 required points, all unique

**`installFailureInjector`** (6 tests)

- `before-transaction`: prevents any write from reaching the store
- `during-transaction`: aborts a bulk write after N puts, leaving zero
  partial writes (this test only passed once the production atomicity
  fix — see below — was applied)
- `aborted-transaction`: explicit abort also leaves zero partial writes
- `before-ui-refresh`: fails one `getAll` call, a subsequent
  un-injected read succeeds
- reports `injected: false` when `triggerOnCall` is never reached
- `uninstall` always restores the original prototype method

**`runRecoveryScenario`** (7 tests)

- createCollection: before-transaction failure recovers cleanly via retry
- bulkAssign: during-transaction failure recovers with correct final
  membership count
- renameCollection: after-commit failure — data already correct, no
  rollback expected
- archiveCollection: thrown-exception before invocation — nothing
  happens, retry succeeds
- bulkRemove: rejected-promise races a caller-side rejection without
  corrupting the real write
- validation-interruption: an interrupted scan has no side effects; a
  clean re-scan is correct
- never leaves a monkey-patched IndexedDB prototype installed after a
  scenario completes

**idempotent retry semantics** (1 test)

- repeating the same recovery action twice more produces no further
  state change (no duplicate memberships, no accumulated corruption)

### `durabilityEngine.test.ts` (6 tests)

**`runDurabilityCycles`** (3 tests)

- runs the requested number of cycles and reports durable+clean for a
  fully-recoverable operation
- does not accumulate corruption across 100 repeated bulk-assign
  recovery cycles
- rejects a cycles count below 1

**`verifyIdempotentRecovery`** (3 tests)

- reports stable when repeated recovery produces no further state change
- reports the first divergence index when state genuinely keeps changing
  (a synthetic non-idempotent case, to prove the detector actually
  detects instability, not just always reporting "stable")
- rejects a repeats count below 1

## The one production defect these tests caught

`recoveryEngine.test.ts`'s `during-transaction` test (`installFailureInjector`
describe block) initially failed even after every test-construction issue
below was fixed — injecting a throw on the 2nd of 4
`assignAssetsToCollections` puts left `members.length` at neither 0 nor 4.
A temporary debug test proved exactly 1 of 4 writes had silently landed
despite the caller observing failure — a real atomicity violation in
`putCollectionRecordsBulk`/`deleteCollectionCascade`
(`collectionStore.ts`) and `putPortfolioAssetsBulk`/
`importAssetTransaction`/`deletePortfolioAssetAndFiles`
(`portfolioStore.ts`): each issued `.put()`/`.delete()` calls in a loop
*before* attaching `oncomplete`/`onerror`/`onabort` handlers, so a
mid-loop synchronous throw rejected the wrapping Promise (via the
executor's own implicit catch) while leaving already-queued writes to
silently auto-commit. Fixed by moving handler attachment before the loop
and wrapping the loop in `try { ... } catch { t.abort(); }` — behaviorally
identical on every success path (IndexedDB events are always
asynchronous) and now guarantees true all-or-nothing rollback on the
throwing path. See `P2_5_SPRINT3_REPORT.md`'s Production Defects section
for the full writeup; `recoveryEngine.test.ts`'s `during-transaction`/
`aborted-transaction` tests are this fix's permanent regression coverage.

## Test-construction errors and fixes (no production code involved)

1. **`InvalidDatasetConfigError` from an under-specified test seed**: the
   test file's `seed()` helper initially left `DEFAULT_DATASET_CONFIG`'s
   non-zero ratios (`emptyCollectionRatio: 0.05`, etc.) in place, which
   made `avgMembershipsPerAsset` exceed the assignable collection pool
   for small test datasets. Fixed by explicitly zeroing every ratio in
   `seed()`, matching Sprint 2's `consistencyManifest.test.ts` pattern.
2. **Silent no-op writes from `includeHighMembershipFixtures`**: several
   `bulkAssign`-based tests initially asserted `changedCount` but got
   `skippedCount` instead, because `DEFAULT_DATASET_CONFIG`'s
   `includeHighMembershipFixtures: true` default pre-assigns asset 0 into
   `collections[0]` — exactly the target most tests used. Fixed by
   setting `includeHighMembershipFixtures: false` in the test seed.
3. **Microtask-starvation hang in the `rejected-promise` failure
   point**: an early design for `installFailureInjector`'s
   `rejected-promise` case used a recursive `queueMicrotask` polling loop
   to detect when the injector had fired, racing it against the real
   operation. When the real operation resolved before the poll target was
   reached, the polling loop never terminated — a `vitest run` hang
   requiring a manual `pkill`, the same bug class Sprint 2's
   `soakRunner.test.ts` hit and fixed. Fixed by redesigning
   `InstalledFailureInjector` to expose an event-driven `onTriggered:
   Promise<void>`, resolved exactly once by the injector itself, never
   polled.
4. **`rejected-promise` race leaking into the retry step**: the
   `bulkRemove: rejected-promise` test initially observed `members.length
   === 1` instead of `0`, because the caller's `await` could see the
   injected rejection before the real underlying transaction had fully
   settled, letting the subsequent `retry()` race against a still-in-flight
   write. Fixed by adding a `finally { await realRun.catch(() => {}); }`
   in `runRecoveryScenario`'s `rejected-promise` branch, so `afterFailure`
   always reflects the operation's true final state.
5. **`capturedAt` timestamp comparison in the idempotency test**: `expect(after).toEqual(before)`
   failed because two real `captureConsistencySnapshot()` calls'
   `capturedAt: Date.now()` fields legitimately differ by a millisecond.
   Fixed by comparing `{ ...after, capturedAt: 0 }` against
   `{ ...before, capturedAt: 0 }` instead of the raw objects.

None of the above touched production code — all five were issues in the
newly-written Sprint 3 test files themselves, found and corrected before
this report was written. Only the atomicity fix (above, in
`collectionStore.ts`/`portfolioStore.ts`) is production code, and it was
proven necessary by a real, reproducible test failure first.

## Regression policy honored

No flaky test's timeout was widened to force a pass. The one hang
encountered (item 3 above) was fixed by removing the actual polling-loop
race condition, not by adding a longer timeout or a retry.
