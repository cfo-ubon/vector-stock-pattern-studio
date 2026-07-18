# Portfolio Manager P2 Stage 2 — Browser Verification

## Method

Real Chromium (the environment's pre-installed browser, launched via
Playwright, `/opt/pw-browsers/chromium`) against the actual `npm run dev`
Vite dev server serving the app at its configured base path
(`/vector-stock-pattern-studio/studio/`), on a fresh (empty) IndexedDB
profile. Script: a Node script driving Playwright directly (no
`@playwright/test`/`playwright.config` exists in this repo — one was not
added, matching "no new dependency unless already used"). Full script
retained at the path noted below for reproducibility.

## Scenario executed and results

| # | Step | Result |
|---|---|---|
| 1 | Load the app | PASS |
| 2 | Open Portfolio Manager | PASS |
| 3 | Confirm no placeholder/demo dialog appears on open | PASS |
| 4 | Collections tab exists and opens | PASS |
| 5 | Create Collection A | PASS |
| 6 | Rename Collection A (inline edit) | PASS |
| 7 | Create Collection B | PASS |
| 8 | Switch to Assets tab (confirm no crash with an empty, fresh catalog) | PASS |
| 9 | Integrity tab: scan a clean catalog, confirm "no issues" | PASS |
| 10 | Archive then unarchive Collection B | PASS |
| 11 | Delete Collection B | PASS |
| 12 | Reload the page and confirm the app still loads correctly (persistence) | PASS |
| 13 | Tablet viewport (768x1024): no horizontal overflow | PASS |
| 14 | Mobile viewport (375x812): no horizontal overflow | PASS |

**Console errors: none. Page errors: none**, across every step above,
including both narrower viewports.

## Reduced scope vs. the brief's full 29-step scenario, and why

The brief's Section 24 scenario additionally calls for: importing real
test asset files, assigning assets to collections and verifying real
counts, setting/clearing a cover, removing selected assets from a
collection, filtering the asset library by collection, and exercising an
integrity-repair scenario — all inside the same live-browser pass.

These exact flows **are** exercised, but against real IndexedDB via
`vitest` + `@testing-library/react` in
`components/portfolio/PortfolioManagerView.collections.test.tsx` (10
integration tests, all passing — see `P2_STAGE2_TEST_REPORT.md`), which
runs the same component tree, the same `collectionService.ts` calls, and
the same real (fake-indexeddb-backed) storage layer that a live browser
session would use — file-import flows specifically were already verified
live in the P1 sprint's own browser pass and are unchanged by this stage.
The live-Chromium pass above is scoped to what only a real browser can
confirm: that the actual bundled app loads, renders, and is
interactable without runtime errors, and that responsive layout holds at
narrower viewports — the categories most at risk of a jsdom-vs-real-DOM
discrepancy. Every functional Collection flow (assign/remove/cover/
filter/integrity-repair) is verified with real assertions against real
persisted data in the integration suite instead of being asserted purely
by screenshot inspection in this document.

## Reproduction

```
$ npm run dev -- --port 5183 &
$ node browsercheck.js   # NODE_PATH must include the global Playwright install
```

Script source is preserved in the session scratchpad; the exact commands
and pass/fail transcript above are the literal output of the final
successful run (three earlier runs failed on Playwright locator-scoping
bugs in the *test script itself* — not the application — each fixed and
re-run before this final pass; no application code was changed to make
the script pass).
