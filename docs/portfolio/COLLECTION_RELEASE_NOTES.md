# Collection Module — Release Notes (P2.5 Sprint 4)

## Recommended release tag: `portfolio-collections-v1.0.0`

The repository has no existing git tags (`git tag -l` is empty), so this
sprint is not bound to an established tagging convention — this is a
recommendation for the user/maintainer to review and create, **not**
something this sprint creates or pushes itself.

**Rationale**:

- `portfolio-collections-` prefix scopes the tag to this one module,
  distinct from the pattern-generator engine's own `v1.x` Thai changelog
  numbering (`docs/USER_GUIDE.md`) and its `Build NNN` internal numbering
  (`docs/CHANGELOG.md`) — neither of which this module shares a
  version space with, and conflating them would misrepresent what
  changed.
- `v1.0.0` (not `v0.x`) because the module has now passed a genuine
  production certification (`COLLECTION_PRODUCTION_CERTIFICATION.md`)
  with a frozen public API (`COLLECTION_API_FREEZE.md`) — the two
  preconditions that justify calling something "1.0" rather than
  "still stabilizing."
- Semver going forward: a breaking change to the frozen API surface
  (`COLLECTION_API_FREEZE.md`) requires a major bump (`v2.0.0`); an
  additive change (new export, new optional parameter) is a minor bump
  (`v1.1.0`); a bug fix with no API surface change (like Sprint 3's
  atomicity fix, which predates this tag) is a patch bump (`v1.0.1`).

**What this tag would point at**: commit `04b59e3` (Sprint 3's final
commit) plus Sprint 4's own commit (API freeze + certification docs) —
i.e., the tag should be created after Sprint 4's commit lands, not
before.

## What's in this release

Everything shipped across Portfolio Manager P1, P2 Stage 1, P2 Stage 2,
and P2.5 Sprints 1-4:

- **P1**: offline asset catalog (import, browse, search, Health Check,
  ZIP export).
- **P2 Stage 1**: the `Collection` domain model, storage, and service
  layer (this release's frozen API surface).
- **P2 Stage 2**: the Collections UI (create/rename/archive/delete,
  cover, bulk assignment, integrity panel).
- **P2.5 Sprints 1-3**: validation infrastructure, real stress/soak
  evidence, real crash-recovery certification — dev-only, never shipped
  to the production bundle, but the evidence base this release's
  certification rests on.
- **P2.5 Sprint 4**: the public API freeze and this production
  certification.

## What's explicitly NOT in this release

Backup & Restore (P3, not started), CI-wired performance gating (P2.5-3,
still open), any SEO/marketplace/analytics/cloud-sync/AI feature (never
in scope for any Portfolio Manager sprint so far).

## Upgrade / compatibility notes

Nothing to migrate — `DB_VERSION` has been 5 since P2 Stage 1 and has
not changed across any sprint through Sprint 4. Any code already calling
the documented `services/collectionService.ts` API continues to work
unchanged; that API is now formally frozen (`COLLECTION_API_FREEZE.md`)
rather than merely stable-by-convention.

## Next steps (per the Sprint 4 brief, not automated here)

1. User/maintainer reviews and approves this certification.
2. PR prepared from the certified state (branch
   `claude/vector-pattern-stock-app-aqimbk`), reviewed, merged.
3. The recommended tag above created against the merged commit.
4. Only then: P3 (Backup & Restore) begins, as a new, separate sprint.

None of steps 2-4 are performed by Sprint 4 itself — this sprint stops
after committing and pushing the certification artifacts.
