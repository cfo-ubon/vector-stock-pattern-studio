# Portfolio Manager P2.5 Sprint 3 — Crash Recovery and Data Integrity Certification

## 1. Executive Summary

Sprint 3 built a domain-agnostic failure-injection and durability
library (`recoveryEngine.ts`, `durabilityEngine.ts`), wired it to all 9
required `collectionService.ts` operations, and ran the full required
evidence matrix against real data: an 81-scenario Node-side failure
matrix (9 operations × 9 injection points), 900 repeated Node-side
durability cycles (100 per operation), a 6-operation idempotency check,
an IndexedDB consistency manifest across before/after-failure/after-
recovery/after-repeated-recovery, a LARGE-dataset (100k assets/10k
collections/504,544 memberships) recovery run, a 100-cycle real-browser
recovery run, and a 5-trial real-OS-process-kill crash simulation.
**Every scenario recovered cleanly — zero unexplained corruption, zero
unexpected deletions, zero atomicity violations.** One real production
defect was found and fixed during this sprint's own construction (a
bulk-write atomicity gap across 5 functions in `collectionStore.ts`/
`portfolioStore.ts`) and is the reason the recovery matrix above is
meaningful rather than trivially passing. `DB_VERSION` remains 5, no
production database migration occurred, and no new user-facing feature
was added.

## 2. Scope

Per the brief: recovery validation, failure injection, durability
verification, consistency verification, regression tests, documentation,
and minimal production bug fixes *only if proven by evidence*. This is
not a feature sprint.

## 3. Out-of-Scope Items

Explicitly not done, per the brief: Backup & Restore was not
implemented, Sprint 4 was not started, no new UI or user-facing
functionality was added, Collection architecture was not redesigned
(only the one proven-necessary atomicity fix, applied minimally), no
unrelated refactoring, no filesystem-corruption simulation (Section 9
explicitly excludes it).

## 4. Branch and Commits

Branch: `claude/vector-pattern-stock-app-aqimbk`. This sprint's work
lands in a single commit per the brief's Section 15 policy ("Commit
message: 'Portfolio Manager P2.5 Sprint 3: Crash Recovery & Data
Integrity Certification'"), after full verification (Section 15) —
committed and pushed as the final step of this sprint (see
`docs/portfolio/P2_5_SPRINT3_TEST_REPORT.md` and this report's own
"Definition of Done" section for the evidence gathered before that
commit).

## 5. Base Commit

`fe1c0aa` (Portfolio Manager P2.5 Sprint 2, already merged onto this
branch) — confirmed present, clean tree, before any Sprint 3 work began.

## 6. Files Changed

**New library code**: `app/src/catalog/validation/recoveryEngine.ts`,
`app/src/catalog/validation/durabilityEngine.ts`.

**New tests**: `app/src/catalog/validation/recoveryEngine.test.ts` (15
tests), `app/src/catalog/validation/durabilityEngine.test.ts` (6 tests).

**New CLI scripts**: `app/scripts/validateRecovery.ts` (matrix/
durability/idempotency/consistency/large modes),
`app/scripts/browserRecovery.ts` (cycle/crash modes).

**Production code fixed** (the one proven defect — see Section 14):
`app/src/catalog/storage/collectionStore.ts` (`putCollectionRecordsBulk`,
`deleteCollectionCascade`), `app/src/catalog/storage/portfolioStore.ts`
(`putPortfolioAssetsBulk`, `importAssetTransaction`,
`deletePortfolioAssetAndFiles`).

**Barrel updated**: `app/src/catalog/validation/index.ts` (exports
`recoveryEngine`/`durabilityEngine`).

**`package.json`**: 7 new `validate:recovery:*` scripts.

**New docs** (this file plus 6): `docs/portfolio/P2_5_SPRINT3_REPORT.md`,
`P2_5_RECOVERY_REPORT.md`, `P2_5_FAILURE_MATRIX.md`,
`P2_5_DURABILITY_REPORT.md`, `P2_5_CONSISTENCY_REPORT.md`,
`P2_5_BROWSER_RECOVERY.md`, `P2_5_SPRINT3_TEST_REPORT.md`.

**Updated docs**: `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`,
`docs/ROADMAP.md`, `docs/CHANGELOG.md`, `app/README.md`. Not touched:
`docs/USER_GUIDE.md` (no user-visible behavior changed, per the brief's
explicit instruction).

**Not committed**: generated validation output
(`app/validation-results/collections/recovery-*.json`,
`browser-recovery-*.json` — gitignored, same as every prior sprint's
output), any temporary debug test files (created and deleted during
development, per Sprint 3's own debugging notes below), generated
Chromium user-data-dir profiles under the OS temp directory (`/tmp/
vsp-crash-*`, cleaned up automatically after each crash trial).

## 7. Pre-coding Findings

Confirmed before any code was written: branch and latest commit `fe1c0aa`
matched, working tree was clean, Sprint 1/Sprint 2 reports and validation
infrastructure were reviewed, `DB_VERSION` was 5 with no exported reset
mechanism (`storage/db.ts`'s `openDb()` module-private `dbPromise` — used
later to justify why genuine process-restart durability can only be
tested via the browser layer, not Node/`fake-indexeddb`), the baseline
regression run (`npm test`) passed clean at 223 test files / 2655 tests
before any Sprint 3 change.

## 8. Failure Matrix

81 scenarios (9 operations × 9 injection points), all against real
`collectionService.ts` calls. **81/81 recovered, 81/81 clean after
recovery.** 8 of the 81 combinations are structurally not applicable via
this harness (explained, not a defect — see below). Full detail:
`docs/portfolio/P2_5_FAILURE_MATRIX.md`.

## 9. Recovery Results

Every scenario across the matrix, the 900 durability cycles, the LARGE
dataset run, and the browser cycle run measured collection count,
membership count, cover references, stale covers, orphan references,
duplicate IDs, and the full integrity scanner result before/after-
failure/after-recovery. Zero unexplained corruption anywhere. Full
detail: `docs/portfolio/P2_5_RECOVERY_REPORT.md`.

## 10. Durability Results

900 repeated recovery cycles (100 per operation, all 9 operations):
**900/900 durable, 900/900 clean.** Full detail:
`docs/portfolio/P2_5_DURABILITY_REPORT.md`.

## 11. Idempotency Results

6 operations, 5 repeats each: **30/30 repeats stable, 0 divergences.**
Full detail: `docs/portfolio/P2_5_DURABILITY_REPORT.md`.

## 12. Consistency Manifest

Before/After Failure/After Recovery/After Repeated Recovery manifests
captured and diffed automatically. Zero unexplained mismatches at any
transition. Full detail: `docs/portfolio/P2_5_CONSISTENCY_REPORT.md`.

## 13. Browser Recovery

100 real open/mutate/reload/reopen/validate cycles in real Chromium: 0
failures, 0 page errors, 0 console errors, 0 duplicate rows, integrity
clean throughout. 5 real-OS-process-kill crash trials: committed writes
always survived, in-flight writes were never partially present, integrity
always clean. One real bug found and fixed in this sprint's own test
harness (not production code) — see `docs/portfolio/P2_5_BROWSER_RECOVERY.md`
for the full writeup.

## 14. Large Dataset Recovery

LARGE preset (100,000 assets, 10,000 collections, 504,544 memberships):
`bulkAssign`, `bulkRemove`, `renameCollection`, `archiveCollection` all
injected, recovered, and clean — each scenario completed in under 14
seconds. Full detail: `docs/portfolio/P2_5_RECOVERY_REPORT.md`.

## 15. Production Defects

**One real defect found and fixed**, discovered by the failure-injection
matrix itself during this sprint's own construction (before any of the
formal runs in Sections 8-14 above):

- **Evidence**: `recoveryEngine.test.ts`'s `during-transaction` test
  injected a synchronous throw on the 2nd of 4 puts inside a real
  `assignAssetsToCollections` call. A temporary debug test proved exactly
  1 of 4 writes had silently landed in the database despite the caller
  observing a rejected Promise.
- **Root cause**: 5 bulk-write functions across `collectionStore.ts`
  (`putCollectionRecordsBulk`, `deleteCollectionCascade`) and
  `portfolioStore.ts` (`putPortfolioAssetsBulk`, `importAssetTransaction`,
  `deletePortfolioAssetAndFiles`) all shared the same pattern: issue
  `.put()`/`.delete()` calls in a loop, then attach `oncomplete`/
  `onerror`/`onabort` handlers afterward. If the loop itself threw
  synchronously partway through (a real, spec-possible outcome — e.g. a
  `DataError` for a non-cloneable value, or `TransactionInactiveError`),
  the wrapping `Promise`'s own implicit catch correctly rejected the
  Promise, but the underlying `IDBTransaction` was never explicitly
  aborted and had no listeners attached — so any already-queued writes
  silently auto-committed. The caller is told "nothing happened" while
  something did: a genuine atomicity violation.
- **Classification**: real production defect, not a validation-tool
  artifact — confirmed by reproducing it against real IndexedDB
  transaction semantics (`fake-indexeddb`), not a quirk of the test
  harness.
- **Fix (minimal, mechanical, identical across all 5 sites)**: move
  handler attachment before the loop; wrap the loop in `try { ... }
  catch { t.abort(); }`. Behaviorally identical to the previous code on
  every success path (IndexedDB events are always asynchronous, so
  attaching handlers earlier changes nothing observable when nothing
  throws) — and now guarantees true all-or-nothing rollback on the
  throwing path.
- **Regression test**: `recoveryEngine.test.ts`'s `during-transaction`/
  `aborted-transaction` tests are this fix's permanent coverage; the full
  81-scenario matrix, 900 durability cycles, and LARGE dataset run
  (Sections 8, 10, 14) are the fix's evidence at scale.
- **Files changed**: `app/src/catalog/storage/collectionStore.ts`,
  `app/src/catalog/storage/portfolioStore.ts` (5 functions total). No
  other production file was touched.

No other production defects were found across any of the Node-side or
browser-side testing in this sprint. The browser crash-simulation section
did surface a bug — but it was in `browserRecovery.ts`, a new Sprint 3
test-harness file (`browser.newContext()` silently creating an ephemeral,
non-disk-backed CDP context), not in any production code; see
`docs/portfolio/P2_5_BROWSER_RECOVERY.md` for that writeup.

## 16. Tests by Category

21 new tests (`recoveryEngine.test.ts`: 15, `durabilityEngine.test.ts`:
6), covering failure injection, the recovery engine, durability cycles,
idempotency, and cleanup guarantees. Full breakdown, plus 5
test-construction errors found and fixed (none touching production
code): `docs/portfolio/P2_5_SPRINT3_TEST_REPORT.md`.

## 17. Full Regression Result

Before Sprint 3: 223 test files / 2655 tests (Sprint 2's baseline, both
before and after — see Section 7). After Sprint 3's library, tests, and
the one production defect fix: **225 test files / 2676 tests, 0
failures.** (`+2` files, `+21` tests — exactly the two new Sprint 3 test
files and their 21 tests; no existing test was modified, added, or
removed elsewhere.)

## 18. Build and Lint

`npx tsc --noEmit`: clean, no errors, every time it was run across this
sprint (after each new file, after each fix). `npx oxlint`: clean on
every new/modified file (`recoveryEngine.ts`, `recoveryEngine.test.ts`,
`durabilityEngine.ts`, `durabilityEngine.test.ts`,
`scripts/validateRecovery.ts`, `scripts/browserRecovery.ts`,
`collectionStore.ts`, `portfolioStore.ts`, `validation/index.ts`) — one
`no-unused-vars` warning was found and fixed during development (an
unused `cycleIndex` parameter in a test), no other warnings.
`npm run build` succeeds (verified as part of the final verification
pass in Section 15 of the brief, before commit).

## 19. Security and Data Safety

No new attack surface — every new file is either a pure library module
(`recoveryEngine.ts`/`durabilityEngine.ts`, no I/O beyond the existing,
unmodified `collectionStore.ts`/`portfolioStore.ts`/`collectionService.ts`
call chain) or a dev-only CLI script never reachable from the production
UI, matching every prior sprint's convention. The one production change
(the atomicity fix) *reduces* a real data-integrity risk — it does not
introduce one. `DB_VERSION` unchanged at 5; no production database
migration occurred; validation modules remain outside the production
bundle (dev-only scripts, `src/catalog/validation/` never imported by
any `src/components/` or `src/App.tsx` code path).

## 20. Known Issues

- The 8 "not applicable" combinations in the failure matrix (Section 8)
  are explained architecturally, not a coverage gap — see
  `P2_5_FAILURE_MATRIX.md`.
- The crash simulation's in-flight write was found fully absent in all 5
  trials (never partially present) — real, positive atomicity evidence,
  but it means no trial happened to catch the write with some records
  landed and some not; see `P2_5_BROWSER_RECOVERY.md`'s
  `caughtInFlightAtLeastOnce` discussion.
- Node-side recovery scenarios (`fake-indexeddb`) cannot, by
  construction, validate genuine process-restart durability — a fresh
  Node process always starts empty regardless of whether the prior
  process crashed or exited cleanly. This is why Section 9's crash
  simulation had to be built against a real browser instead (see
  `P2_5_BROWSER_RECOVERY.md`).

## 21. Technical Debt

See `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`'s new "P2.5 Sprint 3"
section for the formal entries (P2.5-11 through P2.5-14), which close
P2.5-10 ("no crash-recovery certification... belongs to a Sprint 3
recovery-certification stage").

## 22. Documentation

7 new files (this report plus `P2_5_RECOVERY_REPORT.md`,
`P2_5_FAILURE_MATRIX.md`, `P2_5_DURABILITY_REPORT.md`,
`P2_5_CONSISTENCY_REPORT.md`, `P2_5_BROWSER_RECOVERY.md`,
`P2_5_SPRINT3_TEST_REPORT.md`), 4 updated
(`TECHNICAL_DEBT_REGISTER.md`, `ROADMAP.md`, `CHANGELOG.md`,
`app/README.md`). `docs/USER_GUIDE.md` intentionally not touched — no
user-visible behavior changed this sprint.

## 23. Definition of Done

- [x] All recovery scenarios complete (81 matrix + 900 durability + 30
      idempotency + 4 consistency-transition + 4 LARGE + 100 browser
      cycle + 5 crash trials)
- [x] All failure injections complete (9 points × 9 operations, 8
      explained as structurally not applicable)
- [x] Zero unexplained corruption
- [x] Zero unexpected deletions
- [x] Integrity scanner passes in every post-recovery check
- [x] Durability verified (900/900 cycles, 5/5 real crash trials)
- [x] Idempotency verified (30/30 repeats stable)
- [x] Consistency manifests generated (4 manifests, 3 diffs, all clean)
- [x] Browser recovery passes (100/100 cycles)
- [x] Stress recovery passes (LARGE dataset, 4/4 scenarios)
- [x] Regression passes (225 files / 2676 tests, 0 failures)
- [x] TypeScript passes
- [x] Lint passes
- [x] Production build passes
- [x] No production database risk
- [x] No `DB_VERSION` change
- [x] Documentation complete
- [ ] Commit created, branch pushed — final step, after this report

## 24. Sprint 4 Recommendation

Per the brief's explicit closing instruction: **do NOT begin Sprint 4.**
Sprint 3's own scope now closes P2.5-10 (crash-recovery certification).
The two candidates that have remained open across every sprint so far —
**Backup & Restore** (P1's Blob-per-file design already supports zipping
the entire `portfolioFiles` store the same way `services/exportAsset.ts`
zips one asset today) and **CI wiring for the baseline policy** (P2.5-3,
still open) — are natural next-sprint candidates, but scoping and
sequencing that decision belongs to whoever reads this report next, not
to this sprint.
