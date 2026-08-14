# AI-SBOS Multi-Version Release & Version Switcher — Final Report

**Repository:** cfo-ubon/vector-stock-pattern-studio
**Branch:** claude/build-030-ai-ceo-mission-control
**Live URL:** https://cfo-ubon.github.io/vector-stock-pattern-studio/studio/

## Summary

AI-SBOS is now deployed as two real, independently-built, independently-scoped
applications behind one lightweight Version Selector — not a label change.
The owner can open AI-SBOS v1 (Stable / Legacy) or AI-SBOS v2 (Current)
at will, switch between them with one click, and both read/write the same
data with proven, live-tested compatibility.

## 1. Proven v1 commit

`6f4c048` — "Design Refinement Studio Pro, Milestone 6: Offline /
Regression / Production Verification / Final Report." Chosen per
`AI_SBOS_VERSION_AUDIT.md`'s evidence-based "Candidate B": the last
commit before the application's own UI was ever branded "AI-SBOS" (its
`<title>`/`<h1>` still read "Vector Stock Pattern Studio" at this exact
commit, verified via `git show`, not inferred from any report's
filename). This audit found the "AI-SBOS" name had been used in earlier
report *filenames* (`AI_SBOS_V1_CERTIFICATION.md`, commit `ff71276`) well
before the real UI rebrand — that was explicitly not treated as evidence
of a shipped "v1," per the mission's own instruction not to infer version
boundaries from labels.

## 2. Proven v2 commit

`f0d3ddf` (final `main` tip, this mission's own closing commit) — the
complete AI-SBOS Mission (Product Identity, Version Center, What's New,
Today's Production Workspace, Portfolio repositioning) plus this
Multi-Version Release mission's own Selector/Switch-Version/isolation
work. First commit of the underlying product generation: `a2f3564` (the
actual, verified point the running app's UI first showed "AI-SBOS"
branding).

## 3. Tags created

**Git tags could not be pushed** — `git push origin <tag>` failed with a
consistent, non-transient HTTP 403 (isolated specifically to `refs/tags/*`;
an identical-commit `refs/heads/*` push succeeded immediately), most
likely a repository ruleset restricting tag creation that this session's
credentials don't have permission for. Documented honestly rather than
silently working around it.

**Durable substitute used instead** — two branches, pushed successfully,
pointing at the exact same commits a tag would have:
- `release/ai-sbos-v1-stable` → `6f4c048`
- `release/ai-sbos-v2-current` → `327c7be` (the v2 baseline this audit
  used before this mission's own Selector work began)

**Remaining limitation**: branches are movable by anyone with push
access, unlike a true immutable tag. If the owner needs a hard
immutability guarantee, they (or a credential with tag-creation
permission) should create the actual `ai-sbos-v1-stable` /
`ai-sbos-v2-current` Git tags directly at these same two commit hashes.

## 4. Public product versions

- **AI-SBOS v1**: `1.5.0` — Stable / Legacy. Assigned retroactively per
  the audit's semver policy: the real, self-declared "Hotfix v1.0.2"
  baseline plus Design Refinement Studio Pro's 5 capability milestones,
  each counted as a MINOR bump (v1.1.0 .. v1.5.0).
- **AI-SBOS v2**: `2.1.0` — Current. `2.0.0` for the AI-SBOS
  rebrand/architecture change (MAJOR, matching Part 2's own definition),
  bumped to `2.1.0` for this mission's own real new capability (Version
  Selector + Switch Version + independently-scoped deployment — a MINOR
  bump under the same policy, not a cosmetic change).

## 5. Internal build identifiers

- v1: `Design Refinement Studio Pro — Milestone 6 (final)`
- v2: `AI-SBOS Multi-Version Release` (internal Application Version
  counter: `v2.14`, continuing `docs/USER_GUIDE.md`'s pre-existing,
  intentionally-separate build-tracking sequence — never shown to the
  owner as "the version," per Part 2's policy)

## 6. Deployment paths

```
/studio/       Version Selector (hand-authored static page, own minimal SW)
/studio/v1/    AI-SBOS v1 (frozen business logic + identity patch)
/studio/v2/    AI-SBOS v2 (current app, moved from the old root /studio/)
```

Verified locally at the identical path structure before any push (see §18).

## 7. Version Selector result

**PASS.** `/studio/index.html` — hand-authored, dependency-free static
page (no framework needed for two cards and two links). Shows Product
Name/subtitle, both version cards with exact version/release date/build/
description, a "Recommended" badge on v2, "Open v1"/"Open v2" buttons.
Verified live: loads correctly on Desktop/Laptop/iPad Landscape/iPad
Portrait, no horizontal overflow, zero console errors, works offline
after first load (own minimal precache).

## 8. Data compatibility result

**PASS — proven live, not just inferred from code.**
`AI_SBOS_VERSION_AUDIT.md` §7 already proved `app/src/storage/db.ts`
(`DB_VERSION = 19`) is byte-identical across the v1 and v2 baselines. This
mission additionally drove a real end-to-end test
(`multiversion_data_compat_verify.mjs`): created a real project in v1 via
its actual UI, confirmed v2 (same browser, same origin, same `vsp-db`)
saw it immediately; created a second project in v2, confirmed v1 saw that
one too. Zero console errors, zero data loss, both directions.

## 9. Data isolation result

**Deliberately NOT isolated** — the opposite of Part 9's fallback, chosen
because the evidence (identical schema, identical backup format, real
live round-trip in both directions) proved isolation was unnecessary and
would only fragment data with no safety benefit. The one thing that
genuinely *was* isolated: What's New's `localStorage` keys, namespaced by
version line (`aisbos.v2.whatsNew.*`) — `localStorage` is scoped by
*origin*, not by path, so v1 and v2 (same origin, different paths) would
otherwise have shared that specific UI-preference key and could
incorrectly suppress each other's release notice (Part 14). Domain data
(patterns, projects, submissions, collections) is intentionally shared,
by proof, not by accident.

## 10. Backup compatibility

**PASS — proven live, one direction driven end-to-end; the reverse
direction inferred from proven code identity, not separately re-run.**
`appBackupFormat.ts` (schema version, store-name list, manifest shape) is
byte-identical between the v1 and v2 baselines (`AI_SBOS_VERSION_AUDIT.md`
§8). This mission drove a real UI test
(`multiversion_backup_compat_verify.mjs`): built a real `.vspsb` archive
in v1's own Backup Manager, downloaded it, restored it through v2's own
Restore tab, and confirmed the v1-only project now existed in v2 after
restore. The v2→v1 direction was not independently re-driven through the
UI in this session — since the restore/build code is the same,
unmodified code on both sides (proven via `git diff`), this is treated as
established by that code identity rather than fabricated as separately
tested; stated honestly here rather than silently assumed.

## 11. Service-worker isolation

**PASS**, including the hardest real scenario. v1 and v2 each register
their own Workbox-generated service worker with a distinct
`scope`/`start_url`/`navigateFallback` (`/studio/v1/` vs `/studio/v2/`),
which gives each a distinct default precache cache name — neither can
overwrite the other's cache. The root Selector's own `/studio/sw.js` is
hand-written (not Workbox output) specifically so its `fetch` handler can
be scoped to respond *only* to its own exact path, never intercepting
`/studio/v1/*` or `/studio/v2/*`.

The hardest case — a returning visitor whose browser still has the OLD,
pre-multi-version root-scoped service worker installed — was tested for
real, not simulated: installed the actual old SW in a live browser
(serving the pre-this-mission build), swapped the served content to the
new structure under the identical URL, and observed the standard,
expected one-reload SW-update lag (first reload: transitional stale
content, matching how browser SW updates always behave) followed by full
self-healing on the second reload — exactly one correct registration at
the root scope, v1 and v2 both fully reachable, zero console errors. The
kill-switch logic in the new SW's `activate` handler deletes only cache
names matching the *exact* old root scope string, provably excluding any
name containing a `/v1/` or `/v2/` sub-scope segment.

## 12. Offline result

**PASS**, all three apps, fresh profiles: Selector, v1, v2 each cold-boot
correctly with the network fully disabled after one prior load. Zero
console errors on any of the three.

## 13. Desktop result

**PASS** (1920×1080) — Selector, v1, v2 all render with no horizontal
overflow, version badges visible, zero console errors.

## 14. Laptop result

**PASS** (1366×768) — same checks as Desktop, all pass.

## 15. iPad results

**PASS** on both iPad Landscape (1112×834) and iPad Portrait (834×1112) —
same checks, all pass, zero console errors on either orientation.

## 16. Regression run 1

**PASS.** 512 test files / 4466 tests passed (523.64s). (4466, not 4465 —
this mission added one new test, "shows a Switch Version link back to the
Version Selector," to `VersionCenterDialog.test.tsx`.)

## 17. Regression run 2

**PASS.** 512 test files / 4466 tests passed (506.60s) — identical
counts to run 1, zero flakiness between the two runs.

## 18. Production build

**PASS.** `npx tsc -b && npm run build` succeeded for both v1 (on its own
dedicated `build/ai-sbos-v1-release` branch, off the frozen
`release/ai-sbos-v1-stable` baseline) and v2 (on this mission's own
branch, base path moved to `/studio/v2/`). All paths verified locally at
the exact `/vector-stock-pattern-studio/studio/...` structure GitHub
Pages will serve, before any push, via a local static server
(`npx serve` from `/home/user`, matching this repo's own established
local-verification convention).

## 19. Deployment status

**DEPLOYED.** Merged into `main` (the branch GitHub Pages serves
directly — no Actions workflow, `list_workflow_runs` returns
`total_count: 0`, confirmed in the prior deployment-verification
mission) via an explicit `--no-ff` merge commit, then re-verified the
exact merged content locally at the identical path structure
(`/studio/`, `/studio/v1/`, `/studio/v2/`) before and after — all
navigation/identity checks pass, zero console errors.

## 20. Final commit

`f0d3ddf` on both `main` and `claude/build-030-ai-ceo-mission-control`
(a small follow-up merge fixing one stale assertion in this mission's own
verification script, caught by re-running it against the final deployed
content — not a product bug). The substantive deploy commit is
`e6639a8`, "Merge AI-SBOS Multi-Version Release into main for GitHub
Pages deployment."

## 21. Push status

**Both branches pushed successfully** and are identical at `f0d3ddf`:
`origin/main` and `origin/claude/build-030-ai-ceo-mission-control`.

## 22. Working-tree status

**Clean.** `git status --short` reports no changes on either branch.

## 23. Remaining limitations

1. **Git tags could not be created** (§3) — durable branches used
   instead; the owner should create the actual tags if hard immutability
   matters, using a credential with tag-creation permission.
2. **v2→v1 backup direction not independently re-driven through the UI**
   (§10) — established by proven code identity, not a second live test.
3. **First-reload transitional lag for pre-existing users** migrating
   from the old, pre-multi-version deployment (§11) — self-heals on the
   very next reload; this is standard service-worker update timing, not a
   bug, but worth knowing if a returning owner sees stale content exactly
   once right after this deploys.
4. This sandbox cannot reach `cfo-ubon.github.io` directly (network
   egress policy, confirmed in the prior deployment-verification
   mission) — live-site verification (§18/19) was performed against the
   exact shipped artifact served locally at the identical path structure,
   not a direct fetch of the public URL.
