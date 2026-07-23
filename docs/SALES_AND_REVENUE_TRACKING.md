# Sales & Revenue Tracking — Build 026

`app/src/catalog/submission/salesRevenue.ts` (domain model + pure
aggregation) and `salesRevenueStore.ts` (IndexedDB persistence,
`salesEvents` store).

## Why this exists

No revenue or download tracking of any kind existed anywhere in this
codebase before Build 026. Marketplaces don't offer a live sales API a
personal contributor can call without paid access — per the brief's
explicit non-negotiable rules ("do not use paid APIs," "do not require
marketplace API keys"), this is a **manual entry / CSV import** model,
not a live integration.

## `SalesEvent`

One row = one reporting period's recorded outcome for one production
asset on one marketplace (e.g. "this pattern's numbers for October on
Shutterstock"):

```ts
interface SalesEvent {
  eventId: string;
  productionAssetId: string;   // joins to PortfolioAsset.productionAssetId
  marketplaceId: string;
  date: number;                // epoch ms of the reporting PERIOD, not "now"
  downloads: number;
  licenses: number;
  grossRevenue: number;
  fees: number;
  netRevenue: number;          // always grossRevenue - fees, computed once at creation
  currency: string;            // ISO code, e.g. 'USD'
  thbEquivalent: number | null;// optional, manually entered — see below
  sourceImportId: string | null;
  notes: string;
}
```

`netRevenue` is computed exactly once, at creation time
(`createSalesEvent`), never re-derived ad hoc elsewhere — every reader
agrees on what "net" means without recomputing it.

## No live currency conversion

The brief explicitly forbids live currency conversion. `thbEquivalent`
is an optional, manually-entered, clearly-secondary figure a Thai user
can fill in by hand from whatever rate they looked up — it is never
computed by this codebase, and nothing here calls any exchange-rate API.

## Aggregation functions (pure, over already-loaded events)

- `aggregateByMonth(events)` — groups by UTC year-month, chronologically
  sorted. The brief's "downloads by month" / "revenue by month."
- `aggregateByMarketplace(events)` / `aggregateByProductionAsset(events)`
  — grouped totals, sorted by net revenue descending.
- `topPerformers(events, limit)` — top-earning patterns.
- `underperformingApproved(approvedProductionAssetIds, events, revenueThreshold)`
  — approved production assets with zero or near-zero recorded sales.
  Takes the caller's own list of approved ids explicitly rather than
  re-deriving "approved" from submission records itself — that
  classification belongs to `submissionStatus.ts`, not this module.

## How revenue joins to the rest of the system

Every join is through `productionAssetId` (see
`docs/PRODUCTION_ASSET_ID.md`), never `assetId` — this is deliberate:
the same sellable design might exist under multiple catalog rows (a
re-import after a folder move), and sales data recorded against the
underlying content should still be found regardless of which row a
caller is looking at. `commercialFeedbackEngine.ts` uses exactly this
join to attribute `netRevenue`/`downloads` to a preset/Style DNA/
composition-type/pattern-type dimension.

## Storage

A plain IndexedDB store (`salesEvents`, keyPath `eventId`, indexed by
`productionAssetId` and `marketplaceId`) — no legacy data to migrate.
