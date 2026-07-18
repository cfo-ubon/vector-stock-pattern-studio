# Portfolio Manager P2 Stage 2 — Test Report

## New tests: 62 across 12 files (11 new files + 1 extended)

```
$ npx vitest run src/components/portfolio/ src/catalog/domain/search.test.ts
 Test Files  19 passed (19)
      Tests  115 passed (115)
```

(115 = 62 new Stage 2 tests + 53 pre-existing Portfolio Manager UI/domain
tests in the same directories, all still passing unmodified except the
prop additions documented below.)

| File | Tests | Category |
|---|---|---|
| `CreateCollectionDialog.test.tsx` | 5 | UI component |
| `CollectionCard.test.tsx` | 5 | UI component |
| `CollectionList.test.tsx` | 6 | UI component |
| `CollectionDetailPanel.test.tsx` | 8 | UI component |
| `CollectionAssignmentDialog.test.tsx` | 5 | UI component |
| `CollectionIntegrityPanel.test.tsx` | 5 | UI component |
| `BulkActionBar.test.tsx` | 4 | UI component |
| `CollectionsView.test.tsx` | 5 | UI component / integration-lite |
| `useCollectionCoverUrl.test.ts` | 4 | Hook (real IndexedDB via fake-indexeddb) |
| `PortfolioManagerView.collections.test.tsx` | 10 | Integration (real IndexedDB, full user flows) |
| `collectionUI.performance.test.tsx` | 3 | Performance |
| `catalog/domain/search.test.ts` (extended) | +2 | Domain (collection filter fields) |

## Coverage by required category (brief Section 23)

### UI component tests

Collection list (`CollectionList.test.tsx`): loading/empty/error states,
search-filter, real result count, create-button callback.
Collection card (`CollectionCard.test.tsx`): real asset count, cover
fallback (no broken `<img>`), archived badge, integrity-warning badge,
selected state.
Create dialog (`CreateCollectionDialog.test.tsx`): empty-name rejection,
trimmed submit, duplicate-name error with preserved input, disabled
double-submit, Escape-to-cancel.
Rename/edit dialog: covered inline as part of `CollectionDetailPanel.test.tsx`
(rename-on-blur), matching the inline-edit UI pattern actually shipped
(no separate modal — see `P2_STAGE2_UI_ARCHITECTURE.md`).
Archive/unarchive, delete confirmation (`CollectionDetailPanel.test.tsx`):
archive and delete use visually distinct confirmation flows (Section 8),
delete explains assets are not deleted, unarchive restores the archive
button.
Detail view, cover fallback, set/clear cover
(`CollectionDetailPanel.test.tsx`): cover `<select>` only lists member
assets, member selection + bulk-remove-from-collection, empty-member
state.
Bulk action bar (`BulkActionBar.test.tsx`): real selected count, disabled
states (nothing selected / busy), each button's handler.
Assignment dialog (`CollectionAssignmentDialog.test.tsx`): archived
collections excluded from `assign` mode, always shown in `remove` mode,
confirm disabled until a selection exists,
requested/changed/skipped/failed summary rendering, readable (non-raw)
error on rejection.
Integrity panel (`CollectionIntegrityPanel.test.tsx`): read-only until an
explicit scan, no repair buttons on a clean report, repair buttons appear
and call the right handler only when there is real drift to fix — never
automatically.

### Integration tests (real IndexedDB, `PortfolioManagerView.collections.test.tsx`)

create -> reload -> persisted; duplicate-name rejected without creating a
second collection; rename -> reload -> persisted; single-asset assignment
from the detail panel -> reflected -> persisted after reload; bulk assign
then bulk remove with the `BulkMembershipResult` summary visible;
archive -> Active/Archived filter tabs -> unarchive; archived collections
block new assignment but existing members are unaffected (Rule 7); delete
-> membership cleanup reflected (asset survives, `collectionIds` cleared);
asset-library filter by collection (Section 14); integrity scan detects a
deliberately-seeded orphaned `collectionId` and repair clears it only
after an explicit click (never during the scan itself).

### Accessibility

No dedicated automated accessibility-testing library (e.g. axe) exists
anywhere in this repository's `devDependencies` — Stage 2 did not
introduce one, consistent with "no new dependency unless already used or
documented critical need." Accessibility was verified structurally
(semantic roles, `aria-label`/`aria-pressed`/`role="dialog"`/`role="alert"`/`role="status"`
usage, keyboard activation via native `<button>`/`<input>` elements) and
by hand in a real browser — see `P2_STAGE2_ACCESSIBILITY.md` for the full
checklist and findings.

### Regression

Full pre-existing suite (P1 + Stage 1 + every other engine/generator/
workbench module in this repository), run unmodified alongside the new
Stage 2 tests — see `P2_STAGE2_REPORT.md`'s "Full Regression Result"
section for the exact command and totals. `src/collection/collectionGenerator.test.ts`'s
pre-existing 15-second-timeout flake (documented in the P1 and Stage 1
reports, unrelated to any file this stage touched) is the only known
flaky failure; re-verified isolated per that section.

## TypeScript / lint

```
$ npx tsc -b --noEmit
(clean, no output)

$ npm run lint     # oxlint
(clean, no output)
```
