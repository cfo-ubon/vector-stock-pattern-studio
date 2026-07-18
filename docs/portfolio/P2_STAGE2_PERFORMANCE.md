# Portfolio Manager P2 Stage 2 — Performance

Companion to `docs/portfolio/P2_STAGE1_PERFORMANCE.md` (the service-layer
half — bulk assign/remove, integrity scan, all still valid and unchanged
since Stage 2 touched no service code). This document covers the UI
half: what Stage 2 actually added on top of that service layer.

## Method

Same convention as Stage 1: real measurements via `performance.now()`
inside `vitest` component-rendering tests (jsdom + React Testing Library
+ fake-indexeddb where a test needs real IndexedDB round-trips), not
hand-waved estimates. Full test source:
`app/src/components/portfolio/collectionUI.performance.test.tsx` (UI) and
`app/src/catalog/services/collectionService.performance.test.ts` (Stage 1
service layer, re-run here for a complete side-by-side picture).

```
$ npx vitest run src/components/portfolio/collectionUI.performance.test.tsx \
    src/catalog/services/collectionService.performance.test.ts --reporter=verbose
```

## Measured results

| Metric | Target (Section 21) | Measured | Verdict |
|---|---|---|---|
| Collection list initial render (100 collections) | visibly responsive | 154.5ms | Pass |
| Collection search filter (100 collections) | under 100ms | 19.2ms | Pass |
| Open collection detail, first member page rendered (1,000 members) | render first page, bounded | 201.1ms (only 40 cards mounted) | Pass |
| Bulk assign 1,000 assets to 1 collection | under Stage 1's 2s target | 38.4ms | Pass |
| Bulk remove 1,000 assets from 1 collection | under Stage 1's 2s target | 40.8ms | Pass |
| Integrity scan (20,000 assets x 100 collections) | fast, single-pass | 255.8ms | Pass |
| `getAssetsForCollection` at 20,000-asset scale | fast | 202.7ms | Pass |
| Create 100 collections (sequential, via service) | responsive | 62.9ms | Pass |
| `loadCollections()` over 100 records | fast | 1.0ms | Pass |

All numbers are jsdom-in-CI measurements (generous headroom vs. a real
browser on real hardware — see Stage 1's own performance doc for the same
caveat) and are the actual output of the commands above, not estimates.

## UI-specific requirements (Section 21)

- **"Only render paginated/bounded asset cards"**: verified directly —
  `CollectionDetailPanel`'s member grid mounts exactly 40
  `PortfolioThumbnail` components regardless of whether the collection has
  40 or 1,000 members (`MEMBER_PAGE_SIZE = 40`, same value as
  `PortfolioGrid.PAGE_SIZE`). The remaining 960 members in the 1,000-member
  fixture are provably not in the DOM (`collectionUI.performance.test.tsx`
  asserts `queryByText('Member 999')` is null).
- **"No obvious repeated per-card DB query pattern"**: unchanged from
  Stage 1 — `assignAssetsToCollections`/`removeAssetsFromCollections`
  still read `loadPortfolioAssets()`/`loadCollections()` exactly once per
  bulk call regardless of how many assets/collections are involved (see
  `P2_STAGE1_PERFORMANCE.md`'s architecture note); Stage 2's UI layer
  calls these exact functions, adding no new per-card reads.
- **"No unbounded Blob URL accumulation"**: see `P2_STAGE2_UI_ARCHITECTURE.md`'s
  "Object URL / memory safety" section — `useCollectionCoverUrl` follows
  `usePreviewUrl`'s create-on-mount/revoke-on-unmount-or-id-change shape,
  and the bounded member-grid rendering above means at most 40 member
  thumbnails' preview Blob URLs are ever open at once for a given
  collection detail view.

## Known scale limitation (documented, not a defect)

The cover-picker `<select>` in `CollectionDetailPanel` lists every member
asset as a plain `<option>`, uncapped — for a collection with, say, 5,000
members this would mean 5,000 `<option>` elements. This is a real but
low-severity limitation (plain `<option>` text nodes, not Blob-URL-holding
image cards) and is tracked in `TECHNICAL_DEBT_REGISTER.md` (S2-1) rather
than fixed in this stage — the realistic target collection size for this
app (a curated stock-vector portfolio) is nowhere near that scale.
