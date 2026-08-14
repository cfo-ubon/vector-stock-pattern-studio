# AI-SBOS Version Audit

**Purpose:** determine, from actual Git history and shipped artifacts only
(never from labels alone), what can be proven about a "v1" and "v2"
product-version boundary, ahead of building a Multi-Version Release &
Version Switcher system.

**Method:** every claim below is backed by a `git show`/`git diff`/`git log`
command actually run against `cfo-ubon/vector-stock-pattern-studio`, not
inferred from commit-message prose alone. Where prose and actual shipped
content disagree, the shipped content wins and the disagreement is called
out explicitly.

---

## 1. Tags

```
$ git tag -l
(empty)
```

**No Git tags exist in this repository at all.** There is no
`v1`/`v2`/`ai-sbos-v1-stable`/etc. tag to consult. Every version claim in
this document comes from commit content and commit messages only.

## 2. Branches

```
$ git branch -r
origin/claude/build-022-weak-style-commercial-upgrade
origin/claude/build-023-visual-beauty-engine
origin/claude/build-024-botanical-anatomy-depth-engine
origin/claude/build-025-luxury-floral-composition-stability
origin/claude/build-026-production-commercial-feedback
origin/claude/build-027-offline-pc-ipad
origin/claude/build-028-marketing-design-intelligence
origin/claude/build-029-autonomous-design-autopilot
origin/claude/build-030-ai-ceo-mission-control   <- current dev branch, HEAD = main
origin/claude/vector-pattern-ai-app-x2uvu7
origin/claude/vector-pattern-stock-app-aqimbk
origin/codex/offline-windows-desktop
origin/main                                       <- GitHub Pages source, no build step
```

All feature branches except `claude/build-030-ai-ceo-mission-control` are
either fully merged into `main`'s ancestry or abandoned side-branches from
earlier missions; none of them names a "v1" or "v2" boundary. `main` and
`claude/build-030-ai-ceo-mission-control` are currently identical
(`327c7be`).

## 3. The actual UI-branding history (not inferred from filenames)

The single most important, concrete fact this audit turned up: **the
running application was never branded "AI-SBOS" in its own UI until one
specific commit**, regardless of how many earlier reports used "AI-SBOS"
in their own filenames or prose.

```
$ git show a2f3564~1:app/src/App.tsx | grep '<h1>'
<h1>Vector Stock Pattern Studio</h1>
$ git show a2f3564~1:app/index.html | grep title
<title>Vector Stock Pattern Studio</title>
$ git show a2f3564~1:app/src/appMeta.ts
fatal: path 'app/src/appMeta.ts' exists on disk, but not in 'a2f3564~1'
```

versus, at `a2f3564` itself ("AI-SBOS Mission, Milestone 1: Product
Identity + Consistent Header + Version Center"):

```
$ git show a2f3564:app/index.html | grep title
<title>AI-SBOS — AI Stock Business Operating System</title>
```

`app/src/appMeta.ts` (the single source of truth for product name,
version, build name, and the in-app "About AI-SBOS" Version Center) is
**introduced for the first time at `a2f3564`**, with `APP_VERSION = '2.09'`.

**Important, easy-to-misread earlier evidence**: `AI_SBOS_V1_CERTIFICATION.md`
(commit `ff71276`, "Mission 7.5: ... certify production release") and
`AI_SBOS_RELEASE_CANDIDATE_REPORT.md` (commit `2f94645`, "Build 037
(Mission 7)") both **predate** `a2f3564` and both use "AI-SBOS" in their
own filenames/prose — but at those commits the actual running app was
still titled "Vector Stock Pattern Studio" everywhere in its own UI (same
`git show <commit>:app/index.html` check, confirmed for both). **"AI-SBOS"
was used in those two reports as an internal/aspirational product-suite
name in documentation, not as a shipped UI rebrand.** Treating those
reports as proof of a real "AI-SBOS v1" release would be exactly the
label-inference the task explicitly warned against — so this audit does
not do that.

## 4. The real, self-declared semantic-version lineage: Hotfix v1.0.1 / v1.0.2

Separately from the "AI-SBOS" naming confusion above, there **is** a real,
self-declared `v1.0.x` semantic release line in the commit history —
independent of the "Application Version" counter USER_GUIDE.md tracks
(which calls the same commits "v2.02"/"v2.03", see §6 below):

```
b6272ec Hotfix v1.0.1: Commercial Export UX (Preview, Marketplace selection, bulk export, Download Center)
95c79f6 Hotfix v1.0.2: fix every verified bug from the full UI/UX production audit
43e8cbe Hotfix v1.0.2, Part 9: add offline re-verification script
36f1461 Hotfix v1.0.2: final report — regression twice, offline/responsive re-verification
```

This lineage sits immediately after a real, evidence-driven certification
chain:

```
2f94645 Build 037 (Mission 7): Production Hardening — Release Candidate audit
ff71276 Mission 7.5: resolve zero-backlog session dead-end + certify production release
230be5f Mission 7.5B: fix cold offline boot (root cause: no service worker)
ae4aafc Mission 7.5B: fix full offline workflow test harness (drop unsafe IDB wipe)
2fb480f Mission 7.5B: add offline performance + browser verification evidence scripts
67eedbe Mission 7.5B: write offline-boot certification addendum + user guide update
7647c6a Mission 8: add in-progress certification evidence scripts (WIP)
cc70f81 Mission 8: fix submission cache staleness after backup restore
f4d22f6 Mission 8: add in-progress certification evidence (WIP, part 2)
e7dd3aa Mission 8: consolidate PRODUCTION_CERTIFICATION.md (evidence consolidation)
b6272ec Hotfix v1.0.1: Commercial Export UX ...
95c79f6 Hotfix v1.0.2: fix every verified bug ...
43e8cbe Hotfix v1.0.2, Part 9: add offline re-verification script
36f1461 Hotfix v1.0.2: final report — regression twice, offline/responsive re-verification
```

`36f1461`'s own report title is literally "final report — regression
twice, offline/responsive re-verification" — i.e. this commit is a real,
self-certified, regression-tested-twice release point, by the same bar
this repository's own missions have consistently used to call something
"done."

**At `36f1461`, the UI still says "Vector Stock Pattern Studio"** (§3
above) — this v1.0.x release line never renamed the product.

## 5. What happened after Hotfix v1.0.2

Two more missions ran before any UI rebrand:

**Design Refinement Studio Pro (M1–M6)** — `503808c` .. `6f4c048`, 6
commits, added Design Edit Mode / AI Design Coach / Version Control &
Compare Center / Batch Refinement / Pattern Safety. **Did not rename the
product** — confirmed identical header/title at `6f4c048` as at `36f1461`
(`git show 6f4c048:app/index.html` still says "Vector Stock Pattern
Studio").

**AI-SBOS Mission (M1–M5)** — `a2f3564` .. `5dff015` (+ merge `1a89117` +
deploy-verification `327c7be`), 7 commits total, is the commit range that
**actually** introduced: the "AI-SBOS" product name in the UI, the
`appMeta.ts` single source of truth, the Version Center, the What's New
dialog, the consolidated Today's Production Workspace, and Portfolio's
role repositioning. This is a genuine architecture/identity change, not a
label change — new components, new localStorage keys, new build-time
commit-hash injection, a consolidated daily workflow screen.

## 6. "Application Version" vs. product version (the exact confusion Part 2 warns about)

`docs/USER_GUIDE.md`'s own "Version and Build Numbering" section already
documents, in its own words, that these are two different, deliberately
uncoupled numbers:

> "Application Version... increments every time a user-visible change
> ships... Development Build... identifies one scoped internal
> development milestone... The numbers do not need to match."

Concretely: `36f1461` (Hotfix v1.0.2, a real self-declared `v1.0.x`
release) is tracked in that same table as **"Application Version v2.03"**.
`5dff015`/`6723af5` (AI-SBOS Mission M5, the actual close of the AI-SBOS
rebrand) is tracked as **"Application Version v2.13"**. The "Application
Version" counter is a continuous internal build-tracking sequence — it
has never reset at any product boundary and was never intended as a
customer-facing semantic version. **`v2.13` must not become the public
product version 2.13.0 just because that's the internal counter's current
value** — this is the exact trap Part 2 named.

Other version-like fields checked and found **not** to be reliable
per-release trackers (all static, confirmed via `git diff` across every
commit boundary in this audit):

| Field | Value | Status |
|---|---|---|
| `app/package.json` `"version"` | `"1.0.0"` | Static since before this audit's window; code's own comments (`appBackupFormat.ts`) call this an "honest placeholder", never bumped per release |
| `app/electron/main.ts` `APP_VERSION` | `'1.0.0'` | Same — static, unrelated to Application Version counter |

## 7. Database schema — identical across every candidate boundary

`app/src/storage/db.ts` (`DB_NAME = 'vsp-db'`, single shared IndexedDB
database, one `DB_VERSION` for all stores):

```
$ git show 36f1461:app/src/storage/db.ts | grep 'DB_VERSION ='
export const DB_VERSION = 19;
$ git show 6f4c048:app/src/storage/db.ts | grep 'DB_VERSION ='
export const DB_VERSION = 19;
$ grep 'DB_VERSION =' app/src/storage/db.ts   # current main HEAD, 327c7be
export const DB_VERSION = 19;

$ git diff 36f1461 6f4c048 -- app/src/storage/db.ts   # → empty
$ git diff 6f4c048 main    -- app/src/storage/db.ts   # → empty
```

**`db.ts` is byte-identical at all three candidate points.** Neither
Design Refinement Studio Pro nor the AI-SBOS Mission added, removed, or
reshaped a single IndexedDB object store. The last real schema change
(`v18 -> v19`) happened in "Mission 5, Factory Orchestrator" —
`6fbecb3`, well before Hotfix v1.0.2 even shipped.

## 8. Backup (`.vspsb`) format — also identical

`app/src/backup/appBackupFormat.ts` (`APP_BACKUP_SCHEMA_VERSION = 1`,
`APP_BACKUP_STORE_NAMES`, manifest shape):

```
$ git diff 36f1461 main -- app/src/backup/appBackupFormat.ts   # → empty
$ git diff 6f4c048 main -- app/src/backup/appBackupFormat.ts   # → empty
```

Also byte-identical. See §9 and Part 8/11 of the mission report for what
this means for data safety and backup compatibility.

## 9. Deployment path — never changed

```
$ git show 36f1461:app/vite.config.ts | grep 'base:'
base: '/vector-stock-pattern-studio/studio/',
$ grep 'base:' app/vite.config.ts   # current main HEAD
base: '/vector-stock-pattern-studio/studio/',
```

The GitHub Pages base path has always been
`/vector-stock-pattern-studio/studio/`; nothing here constrains the v1/v2
boundary decision.

## 10. Scale of change, for context

```
$ git diff --stat 36f1461 main   # Hotfix v1.0.2 -> current main
93 files changed, 7204 insertions(+), 162 deletions(-)

$ git diff --stat 6f4c048 main   # Design Refinement Studio Pro M6 -> current main
56 files changed, 3402 insertions(+), 158 deletions(-)
```

---

## Two candidate v1 baselines — both real, neither fabricated

This audit found **no single, unambiguous, self-declared "v1 ends here,
v2 begins here" commit**. It found two different, both-defensible,
both-real candidates, differing only in whether Design Refinement Studio
Pro (a real, certified, non-rebranding feature mission) counts as part of
"v1" or as an early, still-unbranded slice of "v2" work:

### Candidate A — Conservative: `36f1461` ("Hotfix v1.0.2: final report")

- Last commit of the last **explicitly semver-labeled** release line
  (`Hotfix v1.0.1` → `Hotfix v1.0.2`), itself sitting on top of a real,
  multi-mission certification chain (Mission 7 RC → 7.5 → 7.5B → 8).
- Pro: strongest possible textual evidence — these commits *called
  themselves* `v1.0.x` in their own messages, the only place in the whole
  history that happened.
- Con: excludes Design Refinement Studio Pro (Design Edit Mode, AI Coach,
  Version Control/Compare, Batch Refinement, Pattern Safety) from the
  "stable/legacy" baseline, even though that mission never touched
  product branding or architecture and was itself fully regression-tested
  and certified (Milestone 6's own "Offline / Regression / Production
  Verification / Final Report").

### Candidate B — Comprehensive: `6f4c048` ("Design Refinement Studio Pro, Milestone 6")

- Last commit **before the actual UI rebrand** to "AI-SBOS" — the cleanest
  possible architecture/product-generation boundary, matching Part 2's own
  definition of a MAJOR version change ("architecture/product-generation
  change").
- Pro: everything still branded "Vector Stock Pattern Studio" belongs to
  one product generation; everything branded "AI-SBOS" belongs to the
  next. This is not a label read — it's the actual, verified UI content
  at each commit (§3).
- Con: `6f4c048` never called itself `v1.anything` in its own commit
  message or report — the semver label for this boundary would be this
  audit's own retroactive assignment (per Part 2's policy: Design
  Refinement Studio Pro's 5 capability milestones as MINOR bumps on top
  of the `v1.0.2` hotfix baseline, e.g. `v1.1.0` .. `v1.5.0`), not
  something the repository already claims for itself.

**This audit's recommendation: Candidate B (`6f4c048`).** It is the
cleaner, more defensible MAJOR-version boundary because it tracks the one
thing that actually, verifiably changed in the running application
(product identity/branding/architecture), not just which commit happened
to use the string "v1.0.x" in its own message. Candidate A would put a
real, certified, non-branding-related feature mission (Design Refinement
Studio Pro) on the "v2" side purely because it shipped after a
differently-labeled hotfix — which is closer to the "infer from history
form, not from actual product shape" mistake this audit is trying to
avoid.

**Both candidates share, byte-for-byte, the same `db.ts` (§7) and same
`appBackupFormat.ts` (§8) as current main.** Whichever candidate is
chosen, the Data Safety Audit conclusion (Part 8 of the mission) is the
same: no destructive IndexedDB schema change exists between any of these
points.

## Proposed v2 baseline (not in dispute)

**Current `main` HEAD, `327c7be`** ("Deployment verification: AI-SBOS live
on main, evidence + scripts") — the tip of the branch GitHub Pages
actually serves right now, containing the complete AI-SBOS Mission (M1–M5)
plus its already-verified deployment. There is no ambiguity here: this is
simply "whatever is in production today."

## What this audit is asking the owner to decide

Per the mission's own CRITICAL RULE ("If an exact historical v1 release
cannot be proven, stop and report the candidate commits with evidence
before creating the release"): **the exact v1 commit is not something
this audit can prove to a single certain answer from Git history alone —
it depends on a product-scope judgment call (does "v1" mean "the last
explicitly-hotfixed release" or "everything before the AI-SBOS rebrand"),
not a fact recoverable from the repository.** Both candidates are real,
non-fabricated, already-shipped, already-tested commits — nothing below
this line is invented. This audit is not proceeding to tag creation until
the owner confirms which candidate should become the frozen `v1` release.
