# Test Stability Report (Build 025, Phase 10)

## The flaky test

`app/src/engine/tile.test.ts` — "Luxury Negative Space Engine —
artisticBalance product fallback (Build 011, Section 2)" — an existing test
(not written by this build) that occasionally exceeded vitest's 15000ms
`testTimeout` under full-suite worker contention, while passing reliably
when run in isolation. This is the specific pre-existing flaky timeout test
the brief asked this build to root-cause and fix genuinely (not by raising
the timeout).

## Investigation method

Standalone timing scripts (`tsx`, deleted after use, never committed) that
imported the REAL fixtures the test itself uses
(`defaultParams()` from `engine/defaults.ts`,
`DEFAULT_COMPOSITION_INTELLIGENCE` from `engine/compositionIntelligence.ts`)
rather than hand-reconstructed stand-ins — an early measurement attempt used
inaccurate reconstructed fixtures and produced a misleadingly fast (~1.7s)
reading, which was discarded once the real-fixture version showed the true
cost.

## What was ruled out

- **Async/timer races**: `buildTile()` (the function under test, called in a
  loop) is fully synchronous and pure — there is no `setTimeout`, no
  `Promise` racing, no shared mutable module state across calls that could
  produce nondeterministic timing behavior. Re-running the test in
  isolation, repeatedly, always passed with consistent timing.
- **Worker-pool-specific bugs**: the test uses no worker-thread APIs,
  message passing, or anything that could behave differently under
  parallel test-file execution beyond ordinary CPU contention.

## Root cause, confirmed by direct measurement

The test's loop (up to 30 seeds × 2 param variants = up to 60 `buildTile()`
calls, hunting for the first seed producing a real difference) used the
DEFAULT fixture (`tileSize: 1200`, `density: 0.55`) — a size that generates
hundreds of bouquet placements per call. Standalone measurement with the
real fixture: ~250-450ms per `buildTile()` call, ~8.5-9.5s total wall-clock
for the 26 iterations this specific fixture needed to find its first
difference. That total sits close enough to the 15000ms `testTimeout` that
ordinary full-suite worker contention (other test files' CPU competing for
the same cores) pushes individual runs over the limit — a genuine
heavy-per-call-cost problem, not a hidden async bug.

## The fix

Shrunk the test's own fixture inside the loop to `tileSize: 400, motifSize:
60` — small enough to exercise the exact same `artisticBalance`
fallback-resolution code path (the only thing this test needs to verify)
with far fewer placements to position and repair per call. Measured effect:
the first differing seed is now found at index 0 (down from needing up to
26 iterations), total loop time ~60-80ms (down from ~8.5-9.5s) — roughly two
orders of magnitude faster, comfortably clear of the timeout under any
realistic contention.

This is a genuine root-cause fix (removing the actual heavy cost that made
the test timing-sensitive), not a workaround (raising `testTimeout`, adding
retries, or skipping the test) — none of those were used.

## Verification

- Single isolated run: 5/5 pass.
- The full `tile.test.ts` file run 5 times consecutively: 119/119 tests
  passed every time.
- A 50-iteration loop of the specific test (via a background shell task):
  `PASS=50 FAIL=0`.
- 3 consecutive full-suite regression runs performed for this build's own
  Phase 14 (see `BUILD_025_REPORT.md`): 290/290 test files, 3171/3171 tests,
  all 3 runs, with zero flakes observed anywhere in the suite.
