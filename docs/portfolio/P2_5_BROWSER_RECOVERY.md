# P2.5 Sprint 3 — Browser Recovery Report

Real, measured results from `scripts/browserRecovery.ts`, driving the
actual running app in real Chromium via Playwright — the same
"real browser, real IndexedDB, never `fake-indexeddb`" convention Sprint
2's `uiSoak.ts` established. Two modes: `cycle` (Section 8) and `crash`
(Section 9). Report JSON: `validation-results/collections/
browser-recovery-cycle.json` and `browser-recovery-crash.json`.

## Section 8 — `npm run validate:recovery:browser-cycle`

100 real open/mutate/reload/reopen/validate cycles against a real,
running dev-server-served build, in real headless Chromium
(`chromium.launch()`, temp profile — disk persistence isn't the concern
here, UI/data stability across repeated reloads is).

Each cycle: (1) **mutate** — toggle one asset's membership in a target
collection via a real IndexedDB write (raw `indexedDB` calls matching
`storage/db.ts`'s schema, executed from the Playwright side, the same
technique `uiSoak.ts` used for seeding — the app itself has no seeding
control); (2) **reload** — a real full page reload, not an in-app
navigation; (3) **reopen** — navigate back into the Collections view from
scratch; (4) **validate** — check the collection card grid for duplicate
rows and run a fresh raw-IndexedDB integrity scan.

### Results

| Metric | Result |
|---|---|
| Cycles completed | 100 / 100 |
| Failed cycles | 0 |
| Page errors (`pageerror` events) | 0 |
| Console errors | 0 |
| Duplicate collection rows observed | 0 (across all 100 cycles) |
| Integrity scan corruption observed | 0 (across all 100 cycles) |

**Exit code 0.** No duplicate rows, no stale UI, no orphan preview
artifacts (image-load failures would have shown as console errors, and
none occurred), and no inconsistent Collection state across 100 real
reload cycles.

## Section 9 — `npm run validate:recovery:browser-crash`

5 real trials, each: launch Chromium with a real, disk-backed
`--user-data-dir` profile → seed one fully-committed write (`oncomplete`
observed, default/relaxed durability — the same mode
`collectionStore.ts`/`portfolioStore.ts` use in production, no explicit
`durability` option) → start a second write (5 puts) and deliberately do
**not** await its completion → send a real, uncatchable `SIGKILL` to the
actual OS process as fast as possible → launch a second, fully
independent Chromium process against the **same** on-disk profile →
verify what's actually on disk.

### Why `chromium.launchServer()`/`launchPersistentContext()` alone don't work here

Two Playwright APIs were tried and rejected before landing on the actual
mechanism:

- `chromium.launchServer({ args: ['--user-data-dir=...'] })` — Playwright
  explicitly refuses this ("Pass userDataDir parameter to
  `browserType.launchPersistentContext(userDataDir, options)` instead of
  specifying `--user-data-dir` argument").
- `chromium.launchPersistentContext(userDataDir, options)` — this is the
  API Playwright wants, but its returned `BrowserContext` never exposes a
  real, killable OS process (`context.browser()` is `null` for a
  persistent context) — there is nothing to send a real `SIGKILL` to.

The mechanism that actually works: spawn `/opt/pw-browsers/chromium`
directly via Node's `child_process.spawn` with `--user-data-dir=<dir>`
and `--remote-debugging-port=0`, parse the `DevTools listening on
ws://...` line from stderr, and connect Playwright to that real process
via `chromium.connectOverCDP(wsEndpoint)`. This keeps both properties at
once: a real, disk-backed profile AND a real Node `ChildProcess` handle
whose `.kill('SIGKILL')` is a genuine, uncatchable OS-level termination —
see `launchKillableChromium()` in `browserRecovery.ts`.

### A real bug this sprint found in its own test harness (not production code)

The first working version of `runCrashMode` still measured
`committedWriteSurvived: false` in **5/5 trials**, even for the
fully-awaited, `oncomplete`-observed committed write — which looked like
a genuine production durability defect. Root cause, found by testing an
explicit `{ durability: 'strict' }` transaction option (which changed
nothing) and then auditing the harness itself: `browser.newContext()`,
called on a `Browser` obtained via `connectOverCDP`, silently creates a
**new, separate, in-memory, incognito-style CDP browser context** — it
does not write to the on-disk `--user-data-dir` profile at all,
regardless of durability settings. Every "committed" write in that
version of the test was landing in a throwaway context that vanished the
instant the process was killed, by design, independent of anything the
production code did.

**Fix**: use the browser's already-open default context —
`browser.contexts()[0].newPage()` — instead of `browser.newContext()`.
This is the context genuinely tied to the disk profile Chromium was
launched with. After the fix, re-running with production's actual
default/relaxed durability mode (not the strict mode used to debug the
first hypothesis) gave the real result below.

This was a test-harness defect, not a production defect — it lived
entirely inside `scripts/browserRecovery.ts` (a new Sprint 3 file, not
yet committed at the time it was found) and never touched
`collectionStore.ts`, `portfolioStore.ts`, or any other production code.
It's documented here because Section 1 of the brief requires every claim
to be backed by measured evidence, and the first "evidence" this harness
produced was wrong for a specific, findable reason — the corrected
result is what's reported below.

### Results (production default durability, corrected harness)

| Trial | Committed write survived | In-flight write (5 records) | Post-crash integrity clean |
|---|---|---|---|
| 0 | yes | fully absent (0/5) | yes |
| 1 | yes | fully absent (0/5) | yes |
| 2 | yes | fully absent (0/5) | yes |
| 3 | yes | fully absent (0/5) | yes |
| 4 | yes | fully absent (0/5) | yes |

**5/5 trials: `allCommittedSurvived=true`, `anyPartial=false`,
`allIntegrityClean=true`.** Exit code 0.

- **Committed operations remain durable**: a fully-awaited write with
  `oncomplete` observed survives a real `SIGKILL` of the browser process,
  reopened in a completely independent second process against the same
  disk profile — in every trial.
- **Failed/interrupted operations never leave partial state**: the
  deliberately-uncommitted 5-record write was found either fully present
  or fully absent in every trial — never some-but-not-all. It was fully
  absent in all 5 trials here, meaning the kill landed before that
  transaction's commit was ever recorded — exactly the expected,
  correct behavior (uncommitted data should not reappear after a crash).
- **No corruption**: every post-crash integrity scan (re-implemented
  read-only against the raw IndexedDB data, since `collectionService.ts`
  cannot be imported into a `page.evaluate` sandbox — same "test harness
  re-derives a read-only check independently" precedent
  `consistencyManifest.ts` already established) found zero duplicate
  collection ids, zero orphaned memberships, zero stale cover references.

### `caughtInFlightAtLeastOnce`

The report's `caughtInFlightAtLeastOnce` field is `true` (the in-flight
write was found fully absent in at least one trial — in fact all 5). Had
every trial instead found the in-flight write fully present (5/5), that
would mean the kill always landed *after* that async write had already
silently finished — an inconclusive result that never actually exercised
the "kill mid-write" case. That did not happen here: `SIGKILL` timing is
not fully controllable from outside the process, but in this run it
consistently landed before the deliberately-unawaited write's transaction
committed, in every trial.

## Honest limitations

- `chromium.connectOverCDP` + directly-spawned Chromium is not
  Playwright's documented, first-class API surface for this use case —
  it works because Chromium's CDP protocol and `--user-data-dir` flag are
  stable, well-documented primitives, but it is more manual than
  `launchPersistentContext` and was chosen specifically because
  `launchPersistentContext` cannot expose a killable process handle.
- 5 trials, not 100 — Section 9 (unlike Section 8) does not specify a
  cycle count, and each trial launches two full Chromium processes
  (~15-20s combined), so 5 real trials were run rather than 100. All 5
  were consistent (no trial disagreed with any other).
- This does not simulate filesystem corruption (explicitly out of scope
  per Section 9) — only process termination.
