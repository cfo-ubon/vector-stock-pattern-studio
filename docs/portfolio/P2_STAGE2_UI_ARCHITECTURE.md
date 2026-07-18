# Collection UI Architecture — Portfolio Manager P2 Stage 2

Companion to `docs/portfolio/COLLECTION_ARCHITECTURE.md` (Stage 1, the
domain/storage/service layer). This document covers only what Stage 2
added: the Collection UI layer built on top of that foundation.

## What this is

The UI layer that lets a user actually see, create, rename, archive,
delete, and assign assets to Collections — everything Stage 1 explicitly
deferred ("no UI additions"). No domain, storage, or service code was
rewritten; Stage 2 is additive UI plus two small, additive service-adjacent
extensions (see "Extensions to existing modules" below).

## Layer map (extends P1/Stage 1's `domain -> storage -> services -> UI` layers)

```
app/src/catalog/
  domain/
    search.ts                    EXTENDED — collectionId / collectionMembership filters (Section 14)
  services/
    collectionService.ts         UNCHANGED — every Stage 2 mutation calls this directly

app/src/components/portfolio/
  PortfolioManagerView.tsx       EXTENDED — Assets/Collections tab, owns collections state + every mutation handler
  PortfolioSidebar.tsx           EXTENDED — Collections filter group
  PortfolioGrid.tsx              EXTENDED — multi-select props + BulkActionBar
  PortfolioThumbnail.tsx         EXTENDED — optional multi-select checkbox
  PortfolioDetailPanel.tsx       EXTENDED — "คอลเลกชัน" section (view/assign/remove)

  CollectionsView.tsx            NEW — Collections tab container (All/Active/Archived/Integrity sub-nav)
  CollectionList.tsx             NEW — search/sort/grid of CollectionCard
  CollectionCard.tsx             NEW — one collection's list-item
  CollectionDetailPanel.tsx      NEW — full detail: rename/description/cover/archive/delete/members
  CreateCollectionDialog.tsx     NEW — create-collection modal
  CollectionAssignmentDialog.tsx NEW — single dialog, reused for single- and bulk-assign/remove
  CollectionIntegrityPanel.tsx   NEW — scan + explicit repair (orphans, stale covers)
  BulkActionBar.tsx              NEW — appears above the asset grid when assets are multi-selected
  useCollectionCoverUrl.ts       NEW — Blob-URL hook for collection covers (mirrors usePreviewUrl.ts)
```

## Architecture lock — how it was honored

- **UI never touches IndexedDB.** Every Collection mutation in
  `PortfolioManagerView.tsx` calls a `catalog/services/collectionService.ts`
  function (`createCollectionService`, `renameCollection`,
  `archiveCollection`, `assignAssetsToCollections`,
  `repairOrphanedCollectionIds`, etc.) — never `storage/collectionStore.ts`
  or `storage/portfolioStore.ts` directly, except for the two read-only
  loaders (`loadCollections`, and the existing `loadPortfolioAssets`) that
  Stage 1 already exposed as the sanctioned read path.
- **No storage rewrite, no DB_VERSION bump.** `storage/db.ts`,
  `storage/collectionStore.ts`, and `storage/portfolioStore.ts` are
  byte-for-byte unchanged from Stage 1. `DB_VERSION` stays at 5.
- **No public Stage 1 API signature changed.** `collectionService.ts`'s
  exported functions are called exactly as Stage 1 defined them.
- **One additive domain extension**: `domain/search.ts` gained two new
  optional `PortfolioFilterQuery` fields (`collectionId`,
  `collectionMembership`) and two new `.filter()` clauses — required by
  Section 14 ("integrate into existing search/filter system"), and the
  only way to satisfy that requirement without introducing a second,
  parallel filtering system. Every existing field and behavior is
  unchanged; `search.test.ts`'s pre-existing assertions all still pass
  unmodified.
- **No new state-management library.** Every new component follows the
  existing "container owns state, presentational children call back up"
  shape already used by `PortfolioManagerView.tsx`/`PortfolioGrid.tsx`.

## Collection navigation (Section 3)

Stage 2 adds a lightweight **"ชิ้นงาน" (Assets) / "คอลเลกชัน" (Collections)**
tab inside `PortfolioManagerView.tsx`'s header — not a new top-level
`App.tsx` view. `App.tsx`'s `view` state and `ProjectBar.tsx` are
completely untouched.

A separate "Dashboard" tab, as literally named in the brief, was not
added: the Dashboard summary (`ภาพรวมคลัง`) already lives in
`PortfolioSidebar.tsx` and stays visible on the Assets tab exactly as it
did in P1 — duplicating it as a third tab would only fragment a view that
already works. The Collections tab itself has its own **All / Active /
Archived / Integrity** sub-navigation (`CollectionsView.tsx`), which is
what the brief's "Collections area must support All/Active/Archived/Integrity
views" actually asks for.

`selectedCollectionId` is owned by `PortfolioManagerView.tsx` (not local
to `CollectionsView`), the same way `selectedAssetId` already was —
`CollectionsView` fully unmounts when the user switches to the Assets tab
(a different JSX branch), so any state kept there would be lost on tab
switch. Lifting it up means a selected collection survives switching to
Assets and back, matching the existing asset-panel behavior.

## Reused patterns (per the architecture lock's "reuse first")

| Need | Reused from | Where |
|---|---|---|
| Modal shell (`role="dialog"`, `aria-modal`) | `PortfolioImportPanel.tsx` / `PortfolioHealthCheckPanel.tsx` | `CreateCollectionDialog`, `CollectionAssignmentDialog` |
| Blob-URL lazy-load-with-cleanup hook | `usePreviewUrl.ts` | `useCollectionCoverUrl.ts` (asset-id -> preview-file indirection added, see below) |
| Two-step destructive confirmation | `PortfolioDetailPanel.tsx`'s asset-delete flow | `CollectionDetailPanel`'s collection-delete flow |
| "Show more" bounded pagination (`PAGE_SIZE`) | `PortfolioGrid.tsx` | `CollectionDetailPanel`'s member grid (`MEMBER_PAGE_SIZE`) |
| Accessible selectable card (`aria-pressed`) | `PortfolioThumbnail.tsx` | `CollectionCard.tsx` |
| Inline-edit-on-blur controlled input | `PortfolioDetailPanel.tsx`'s notes textarea | `CollectionDetailPanel`'s name/description fields |
| CSS design tokens (`--panel`, `--accent`, etc.) | `portfolio.css` | every new class, no new design language |

`useCollectionCoverUrl` cannot literally call `usePreviewUrl` because a
collection's `coverAssetId` is an *asset* id, not a *file* id — it
resolves `coverAssetId -> getPortfolioAsset -> previewReference ->
getPortfolioFile`, then follows the exact same
create-object-URL/revoke-on-cleanup shape as `usePreviewUrl`. A missing
asset (Rule 13 staleness) or an asset with no preview file both resolve to
`broken: true`, never a thrown exception or a broken `<img>`.

## Asset multi-selection (Section 11)

`PortfolioThumbnail.tsx` gained optional `multiSelectable` /
`multiChecked` / `onToggleMultiSelect` props — a checkbox overlay in the
preview corner, `stopPropagation`-guarded so toggling it never also opens
the detail panel via the card's own click handler. `PortfolioGrid.tsx`
wires this plus a `BulkActionBar` that appears once at least one asset is
selected, with:

- **"เลือกที่แสดงอยู่ทั้งหมด"** (select all *visible*) — selects only the
  currently-*rendered* (paginated) page, never assets hidden by
  pagination or the active filter (Section 11's explicit "avoid
  accidentally selecting hidden assets" requirement).
- **Selection-clearing policy**: `PortfolioManagerView.tsx` clears
  `multiSelectedIds` in a `useEffect` keyed on the `query` object, so a
  selection can never silently carry over to a different, unrelated
  filtered/searched result set. Selection also does not persist across a
  full reload (new component instance, fresh state) — documented, not an
  oversight.

## Single/bulk assignment (Sections 12-13)

One component, `CollectionAssignmentDialog.tsx`, handles both:

- **Single-asset assign** — opened from `PortfolioDetailPanel`'s new
  "คอลเลกชัน" section, `assetIds={[asset.assetId]}`,
  `currentMembership` marks already-member checkboxes checked/disabled
  (no duplicate-membership UI path).
- **Bulk assign/remove** — opened from `BulkActionBar`,
  `assetIds={[...multiSelectedIds]}`.

Both paths render the same `BulkMembershipResult` summary (requested /
changed / skipped / failed counts, plus readable per-pair failure
reasons — never a raw exception or stack trace). Archived collections are
excluded from the pickable list in `assign` mode (Rule 7) but always
shown in `remove` mode (removal is always allowed). Target workflow
(select assets -> "เพิ่มเข้าคอลเลกชัน" -> pick collection(s) -> "ยืนยัน") is
2 actions after selection, within the brief's "<=3 primary actions"
budget.

## Object URL / memory safety (Section 22)

- `useCollectionCoverUrl` follows `usePreviewUrl`'s exact
  create-on-mount/revoke-on-cleanup-or-id-change shape — no cover Blob
  URL outlives its owning `<CollectionCard>`/`<CollectionDetailPanel>`.
- `CollectionDetailPanel`'s member grid is paginated (`MEMBER_PAGE_SIZE =
  40`, same constant value as `PortfolioGrid.PAGE_SIZE`), so opening a
  collection with hundreds/thousands of members never mounts every
  `PortfolioThumbnail` — and therefore never opens every member's preview
  Blob URL — at once. Verified at 1,000 synthetic members in
  `collectionUI.performance.test.tsx`.
- The cover-picker `<select>` in `CollectionDetailPanel` does list every
  member as a plain `<option>` (not paginated) — see
  `TECHNICAL_DEBT_REGISTER.md` S2-1 for why this is an accepted,
  documented minor scale limitation rather than a resource leak (plain
  `<option>` text nodes hold no Blob URLs or images).

## Known deviations from a literal reading of the brief

1. No separate "Dashboard" tab — see "Collection navigation" above.
2. The cover-picker dropdown is not itself paginated at very large member
   counts (documented technical debt, not a defect).

Everything else in Sections 3-22 of the Stage 2 brief was implemented as
specified.
