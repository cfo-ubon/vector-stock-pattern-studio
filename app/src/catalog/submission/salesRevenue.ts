// Build 026, Phase 11 — Sales and Revenue Tracking. No revenue/download
// tracking of any kind exists anywhere in this codebase today
// (BUILD_026_AUDIT.md Section 4, item 4 — confirmed by grep). This module
// is the domain model + pure aggregation logic; `salesRevenueStore.ts`
// (IndexedDB `salesEvents` store) is the persistence layer.

export const SALES_EVENT_SCHEMA_VERSION = 1;

export interface SalesEvent {
  eventId: string;
  productionAssetId: string;
  marketplaceId: string;
  /** Epoch ms of the reporting period this event covers (e.g. the first
   * of the month for a monthly CSV import) — not necessarily "now". */
  date: number;
  downloads: number;
  licenses: number;
  grossRevenue: number;
  fees: number;
  /** Always `grossRevenue - fees`, computed once at creation time (never
   * re-derived ad hoc) so every reader agrees on what "net" means. */
  netRevenue: number;
  currency: string;
  /** Optional user-entered THB equivalent — the brief explicitly forbids
   * live currency conversion ("Do not require live currency conversion");
   * this is a manually-entered, clearly-secondary figure, never computed. */
  thbEquivalent: number | null;
  sourceImportId: string | null;
  notes: string;
  createdAt: number;
  schemaVersion: number;
}

export interface CreateSalesEventInput {
  productionAssetId: string;
  marketplaceId: string;
  date: number;
  downloads?: number;
  licenses?: number;
  grossRevenue?: number;
  fees?: number;
  currency?: string;
  thbEquivalent?: number | null;
  sourceImportId?: string | null;
  notes?: string;
  now?: number;
}

function generateEventId(now: number): string {
  return `SALE-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSalesEvent(input: CreateSalesEventInput): SalesEvent {
  const now = input.now ?? Date.now();
  const grossRevenue = input.grossRevenue ?? 0;
  const fees = input.fees ?? 0;
  return {
    eventId: generateEventId(now),
    productionAssetId: input.productionAssetId,
    marketplaceId: input.marketplaceId,
    date: input.date,
    downloads: input.downloads ?? 0,
    licenses: input.licenses ?? 0,
    grossRevenue,
    fees,
    netRevenue: grossRevenue - fees,
    currency: input.currency ?? 'USD',
    thbEquivalent: input.thbEquivalent ?? null,
    sourceImportId: input.sourceImportId ?? null,
    notes: input.notes ?? '',
    createdAt: now,
    schemaVersion: SALES_EVENT_SCHEMA_VERSION,
  };
}

export function normalizeSalesEvent(event: SalesEvent): SalesEvent {
  return {
    ...event,
    schemaVersion: event.schemaVersion ?? SALES_EVENT_SCHEMA_VERSION,
    downloads: event.downloads ?? 0,
    licenses: event.licenses ?? 0,
    grossRevenue: event.grossRevenue ?? 0,
    fees: event.fees ?? 0,
    netRevenue: event.netRevenue ?? (event.grossRevenue ?? 0) - (event.fees ?? 0),
    currency: event.currency ?? 'USD',
    thbEquivalent: event.thbEquivalent ?? null,
    sourceImportId: event.sourceImportId ?? null,
    notes: event.notes ?? '',
  };
}

export function isValidSalesEvent(value: unknown): value is SalesEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<SalesEvent>;
  return (
    typeof e.eventId === 'string' &&
    typeof e.productionAssetId === 'string' &&
    typeof e.marketplaceId === 'string' &&
    typeof e.date === 'number'
  );
}

// --- Aggregation (pure functions over already-loaded events) ---

function monthKey(date: number): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface MonthlyAggregate {
  month: string;
  downloads: number;
  netRevenue: number;
}

/** Groups by UTC year-month, sorted chronologically — the brief's
 * "downloads by month" / "revenue by month" summaries. */
export function aggregateByMonth(events: SalesEvent[]): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();
  for (const e of events) {
    const key = monthKey(e.date);
    const existing = map.get(key) ?? { month: key, downloads: 0, netRevenue: 0 };
    existing.downloads += e.downloads;
    existing.netRevenue += e.netRevenue;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface GroupedAggregate {
  key: string;
  downloads: number;
  netRevenue: number;
}

function aggregateByKey(events: SalesEvent[], keyOf: (e: SalesEvent) => string): GroupedAggregate[] {
  const map = new Map<string, GroupedAggregate>();
  for (const e of events) {
    const key = keyOf(e);
    const existing = map.get(key) ?? { key, downloads: 0, netRevenue: 0 };
    existing.downloads += e.downloads;
    existing.netRevenue += e.netRevenue;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.netRevenue - a.netRevenue);
}

export function aggregateByMarketplace(events: SalesEvent[]): GroupedAggregate[] {
  return aggregateByKey(events, (e) => e.marketplaceId);
}

export function aggregateByProductionAsset(events: SalesEvent[]): GroupedAggregate[] {
  return aggregateByKey(events, (e) => e.productionAssetId);
}

export interface TopPerformer {
  productionAssetId: string;
  netRevenue: number;
  downloads: number;
}

/** Sorted descending by net revenue — "top-performing patterns" per the
 * brief; `limit` bounds the result so a caller doesn't need to slice a
 * potentially-large array itself. */
export function topPerformers(events: SalesEvent[], limit: number): TopPerformer[] {
  return aggregateByProductionAsset(events)
    .map((g) => ({ productionAssetId: g.key, netRevenue: g.netRevenue, downloads: g.downloads }))
    .slice(0, limit);
}

/** "Underperforming approved patterns" — approved production assets (by
 * id) with zero or near-zero recorded sales activity. Takes the full set
 * of approved ids explicitly rather than re-deriving "approved" from
 * submission records itself, since that classification belongs to
 * `submissionStatus.ts`, not this module. */
export function underperformingApproved(approvedProductionAssetIds: string[], events: SalesEvent[], revenueThreshold: number): string[] {
  const revenueByAsset = new Map(aggregateByProductionAsset(events).map((g) => [g.key, g.netRevenue]));
  return approvedProductionAssetIds.filter((id) => (revenueByAsset.get(id) ?? 0) <= revenueThreshold);
}
