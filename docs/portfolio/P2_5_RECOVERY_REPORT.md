# P2.5 Sprint 3 — Recovery Report

Summarizes what "recovery" was actually verified in this sprint, across
all four evidence sources: the failure injection matrix (Node), the
100-cycle durability runs (Node), the LARGE-dataset recovery runs (Node),
and the real-browser cycle/crash runs (Playwright/Chromium). Section
references are to `docs/portfolio/P2_5_FAILURE_MATRIX.md`,
`P2_5_DURABILITY_REPORT.md`, and `P2_5_BROWSER_RECOVERY.md`, which carry
the full per-scenario data this report summarizes.

## What "recovery" means here

For every scenario: capture a snapshot + integrity scan **before** the
operation, install a fault, attempt the operation (**after failure**),
uninstall the fault, retry the operation (**after recovery**), and
compare all three snapshots. "Recovered" means the retry succeeded and
the post-recovery integrity scan is clean — not just that the retry
didn't throw.

## Section 4 — Recovery validation

Every failure scenario in the matrix (`P2_5_FAILURE_MATRIX.md`) measured,
for each of before/after-failure/after-recovery: collection count,
membership count, cover references, stale covers, orphan references,
duplicate IDs (via `captureConsistencySnapshot`), and the full integrity
scanner result (via `validateCollectionIntegrity`). Result: **81/81
scenarios reached a clean, correct state after recovery** — the matrix
never observed a lingering orphan, stale cover, or duplicate membership
after a retry.

## Section 5 — Durability (100 repeated cycles)

`runDurabilityCycles` (`durabilityEngine.ts`) ran all 9 operations for
100 cycles each (900 total inject→retry cycles) — see
`P2_5_DURABILITY_REPORT.md` for the full breakdown. Every operation:
**100/100 cycles durable, 100/100 clean, no first-failure cycle.**
Committed operations stayed durable across 100 repetitions; failed
operations never left partial state.

## Section 10 — LARGE dataset recovery (100k/10k/500k+)

`npm run validate:recovery:large` seeded the real LARGE preset
(100,000 assets, 10,000 collections, 504,544 memberships — generated in
905ms, persisted in 1.9s) and ran real failure-injection scenarios
against it for `bulkAssign`, `bulkRemove`, `renameCollection`, and
`archiveCollection` (the four operations Section 10 names).

| Operation | Injected | Recovered | New corruption after recovery | Duration |
|---|---|---|---|---|
| bulkAssign | yes | yes | none | 13.2s |
| bulkRemove | yes | yes | none | 12.7s |
| renameCollection | yes | yes | none | 10.5s |
| archiveCollection | yes | yes | none | 10.5s |

"New corruption after recovery" compares the integrity scan's orphan/
stale-cover counts *before* the scenario against the counts *after
recovery* — a delta check, not an absolute-zero check, because
`largeDatasetConfig` deliberately seeds pre-existing fixture corruption
(2% orphaned memberships, 10% stale covers — the same Sprint 1
"integrity scenario" fixtures every LARGE-preset dataset in this repo
carries) unrelated to the scenario under test. All four scenarios: zero
*new* corruption. Every recovery scenario at LARGE scale completed in
under 14 seconds.

## Section 8 — Browser recovery (100 real cycles)

`npm run validate:recovery:browser-cycle` drove the real running app in
real headless Chromium through 100 open/mutate/reload/reopen/validate
cycles. **100/100 cycles succeeded, 0 page errors, 0 console errors, 0
duplicate collection rows, integrity scan clean on every cycle.** Full
detail in `P2_5_BROWSER_RECOVERY.md`.

## Section 9 — Crash simulation (5 real OS-level kills)

`npm run validate:recovery:browser-crash` spawned real Chromium against a
real disk-backed profile, issued a real `SIGKILL` mid-session, and
reopened the same profile in a second, independent process. **5/5
trials: the committed write survived the kill, the deliberately
uncommitted in-flight write was never partially present (always fully
absent), and the post-crash integrity scan was always clean.** Full
detail — including a real bug this sprint found and fixed in its own
test harness (not production code) — in `P2_5_BROWSER_RECOVERY.md`.

## Cross-cutting finding: the one production defect

Section 4/5's evidence is only meaningful because of a real fix
discovered during this sprint's own construction (before any of the
formal matrix/durability runs above): 5 bulk-write functions across
`collectionStore.ts`/`portfolioStore.ts` had a loop-then-attach-handlers
pattern that could silently auto-commit already-issued writes if a
mid-loop `store.put()`/`.delete()` call threw synchronously — a real
atomicity violation, reproduced with `count=1 of 4` writes landing
despite the caller observing failure. Fixed (move handler attachment
before the loop; wrap the loop in `try { ... } catch { t.abort(); }`) —
see the Sprint 3 report's Production Defects section and
`P2_5_SPRINT3_TEST_REPORT.md` for the regression tests that now guard
this. Every recovery scenario in this report ran **against the fixed
code** — the matrix/durability/large/browser results above are the
regression evidence for that fix at scale.

## Honest limitations

- Node-side scenarios use `fake-indexeddb`, which is memory-only per
  process — a fresh Node process always starts empty regardless of
  whether the prior process crashed or exited cleanly. This makes
  Node/`fake-indexeddb` structurally unable to validate genuine
  process-restart durability; that evidence comes only from the real
  browser crash simulation (Section 9 above).
- The crash simulation's in-flight (deliberately uncommitted, never
  `await`ed) write was found **fully absent** in all 5 trials — the
  `SIGKILL` landed before that write's transaction had committed, in
  every trial, and no trial ever showed a partial write (some-but-not-all
  of the 5 records). That is the correct, expected result: data that was
  never safely committed should not reappear after a crash, and it
  didn't. The genuinely inconclusive case this harness could have hit —
  every trial's kill landing *after* the async write silently finished,
  never testing the interrupted case at all — did not occur here; see
  `P2_5_BROWSER_RECOVERY.md`'s `caughtInFlightAtLeastOnce` field for how
  that's distinguished in the report data.
