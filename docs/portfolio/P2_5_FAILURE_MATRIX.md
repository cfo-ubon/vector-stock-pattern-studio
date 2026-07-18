# P2.5 Sprint 3 — Failure Injection Matrix

Real, measured results from `npm run validate:recovery:matrix`
(`scripts/validateRecovery.ts matrix`), which wires the 9 required
`collectionService.ts` operations into `recoveryEngine.ts`'s 9 failure
injection points and runs all 81 combinations against a real, freshly
seeded dataset (60 assets, 86 collections — one unique target per
combination). Report JSON: `validation-results/collections/recovery-matrix.json`.

## The 9 operations

| Operation | Real function called | Store the failure targets |
|---|---|---|
| createCollection | `createCollectionService` | `collections` |
| renameCollection | `renameCollection` | `collections` |
| archiveCollection | `archiveCollection` | `collections` |
| unarchiveCollection | `unarchiveCollection` | `collections` |
| deleteCollection | `deleteCollectionSafely` | `portfolioAssets` (see below) |
| bulkAssign | `assignAssetsToCollections` | `portfolioAssets` |
| bulkRemove | `removeAssetsFromCollections` | `portfolioAssets` |
| coverUpdate | `setCollectionCoverAsset` | `collections` |
| metadataUpdate | `updateCollectionDescription` | `collections` |

`deleteCollection` targets `portfolioAssets` rather than `collections`
because `deleteCollectionCascade`'s collections-store action is a
`.delete()` call — `during-transaction`/`aborted-transaction` both patch
`.put()`, so they'd never observe a pure delete. The cascade's *asset*
writes (removing the deleted collection's id from every member's
`collectionIds`) are real `.put()` calls, so targeting `portfolioAssets`
is what makes those two points meaningful for this operation.

## The 9 failure injection points

`before-transaction`, `during-transaction`, `aborted-transaction`,
`rejected-promise`, `thrown-exception`, `after-commit`,
`after-persistence`, `before-ui-refresh`, `validation-interruption` — see
`app/src/catalog/validation/recoveryEngine.ts`'s header comment and the
`installFailureInjector` switch for the exact, distinct mechanism each
one uses.

## Results

**81/81 scenarios run. 81/81 recovered (retry succeeded). 81/81 clean
after recovery** (zero orphaned memberships, zero stale cover references
in every post-recovery integrity scan). Exit code 0.

| Metric | Count |
|---|---|
| Total scenarios | 81 |
| Fault actually triggered (`injected: true`) | 73 |
| Not applicable via this harness (`notApplicable: true`) | 8 |
| Recovered (`retryOutcome: 'succeeded'`) | 81 / 81 |
| Clean after recovery | 81 / 81 |

### The 8 "not applicable" combinations — explained, not a defect

`before-ui-refresh` and `validation-interruption` both work by
intercepting a `getAll()` call. `runRecoveryScenario` installs the fault,
then calls the operation's own `run()` — if the operation itself never
calls `getAll()` as part of its own write path, the fault has nothing to
intercept (the injector is uninstalled again before
`deps.captureSnapshot()`/`deps.scanIntegrity()` ever run, by design — see
`recoveryEngine.ts`'s `runRecoveryScenario`).

`archiveCollection`, `unarchiveCollection`, `coverUpdate`, and
`metadataUpdate` all share the same shape: `requireCollection(id)` (a
`.get()` by primary key, not `.getAll()`) followed by one
`putCollectionRecord()` call. Neither step ever calls `getAll()`. That's
why exactly `4 operations × 2 points = 8` combinations report
`injected: false` — `createCollection`/`renameCollection` both call
`assertNameNotTaken()` (which does call `loadCollections()` → `getAll()`)
and `bulkAssign`/`bulkRemove`/`deleteCollection` all call
`loadPortfolioAssets()`/`loadCollections()` at the top of their bulk
logic — every one of those 5 operations **did** trigger both points
correctly (`injected: true` for all of them, confirmed in the matrix
data).

This is proven correct behavior, not an untested gap:
`recoveryEngine.test.ts`'s own `installFailureInjector` unit tests for
`before-ui-refresh` and `validation-interruption` call `loadCollections()`
/`validateCollectionIntegrity()` directly while the injector is still
installed (bypassing `runRecoveryScenario`'s automatic flow entirely) and
confirm both points work exactly as designed. The 8 "not applicable"
combinations are a structural fact about which of the 9 operations happen
to read via `getAll()` as part of their own write path — 5 do, 4 don't.

## Full entry-level detail

See `validation-results/collections/recovery-matrix.json`'s `entries`
array (81 objects: `operation`, `point`, `store`, `injected`,
`notApplicable`, `operationOutcome`, `retryOutcome`,
`cleanBeforeFailure`, `cleanAfterFailure`, `cleanAfterRecovery`).
