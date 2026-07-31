import { marketSnapshotId } from './id';
import { isValidEvidenceBand, type EvidenceBand } from './evidence';

// Build 028, Module 1 Section 3 (Market Snapshot) — a portable, point-in-time
// aggregate of research: what was researched, over what date range, and
// what it currently implies. This is the one object the app is allowed to
// treat as "today's live-ish picture" when actually offline (Module: Offline
// and Online Behavior) — `dataFreshness` plus `createdAt` are what the UI
// reads to decide whether to say "based on the saved snapshot dated [date]"
// instead of presenting stale data as live.

export const MARKET_SNAPSHOT_SCHEMA_VERSION = 1;

export interface MarketSnapshotDateRange {
  from: number;
  to: number;
}

export interface MarketSnapshot {
  id: string;
  createdAt: number;
  researchDateRange: MarketSnapshotDateRange;
  marketplaces: string[];
  regions: string[];
  sourceCount: number;
  keywords: string[];
  themes: string[];
  niches: string[];
  motifs: string[];
  styles: string[];
  colors: string[];
  seasons: string[];
  productUseCases: string[];
  observedCompetition: EvidenceBand;
  observedDemand: EvidenceBand;
  /** Opportunity record ids computed from this snapshot — the scoring
   * engine (Phase 3) writes into `marketOpportunities` and links back here
   * rather than embedding scores directly, so re-scoring with a new
   * `ScoringProfile` never requires mutating the frozen snapshot. */
  opportunityIds: string[];
  recommendations: string[];
  confidence: EvidenceBand;
  /** Free-text freshness label the UI shows verbatim, e.g. "3 days old" or
   * "Same day" — computed at read time from `createdAt`, not stored as a
   * stale string; kept here only as the last-computed value for display
   * without recomputation when listing many snapshots. */
  dataFreshness: string;
  /** Observation/source ids this snapshot was built from — required so
   * every downstream recommendation the snapshot feeds (Daily Mission,
   * Design Brief) can be traced back to real evidence records, not just a
   * snapshot's own summary text. */
  evidenceRefs: string[];
  archived: boolean;
  schemaVersion: number;
}

export class InvalidMarketSnapshotInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketSnapshotInputError';
  }
}

export interface CreateMarketSnapshotInput {
  researchDateRange: MarketSnapshotDateRange;
  evidenceRefs: string[];
  marketplaces?: string[];
  regions?: string[];
  keywords?: string[];
  themes?: string[];
  niches?: string[];
  motifs?: string[];
  styles?: string[];
  colors?: string[];
  seasons?: string[];
  productUseCases?: string[];
  observedCompetition?: EvidenceBand;
  observedDemand?: EvidenceBand;
  recommendations?: string[];
  confidence?: EvidenceBand;
  now?: number;
}

export function createMarketSnapshot(input: CreateMarketSnapshotInput): MarketSnapshot {
  if (input.evidenceRefs.length === 0) {
    throw new InvalidMarketSnapshotInputError(
      'A Market Snapshot must reference at least one real observation/source — an empty evidenceRefs list would be an unsupported, undocumented snapshot.',
    );
  }
  const now = input.now ?? Date.now();
  return {
    id: marketSnapshotId.generate(now),
    createdAt: now,
    researchDateRange: input.researchDateRange,
    marketplaces: input.marketplaces ?? [],
    regions: input.regions ?? [],
    sourceCount: input.evidenceRefs.length,
    keywords: input.keywords ?? [],
    themes: input.themes ?? [],
    niches: input.niches ?? [],
    motifs: input.motifs ?? [],
    styles: input.styles ?? [],
    colors: input.colors ?? [],
    seasons: input.seasons ?? [],
    productUseCases: input.productUseCases ?? [],
    observedCompetition: input.observedCompetition ?? 'unknown',
    observedDemand: input.observedDemand ?? 'unknown',
    opportunityIds: [],
    recommendations: input.recommendations ?? [],
    confidence: input.confidence ?? 'unknown',
    dataFreshness: describeSnapshotFreshness(now, now),
    evidenceRefs: input.evidenceRefs,
    archived: false,
    schemaVersion: MARKET_SNAPSHOT_SCHEMA_VERSION,
  };
}

/** Pure function so tests (and the offline UI banner) can compute freshness
 * deterministically from an injected "now" rather than the wall clock —
 * matches the "never disguise stale data as today's live data" rule with
 * exact, testable thresholds instead of a vague "recently" label. */
export function describeSnapshotFreshness(snapshotCreatedAt: number, now: number): string {
  const ageMs = Math.max(0, now - snapshotCreatedAt);
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (ageDays === 0) return 'Same day';
  if (ageDays === 1) return '1 day old';
  if (ageDays < 7) return `${ageDays} days old`;
  if (ageDays < 14) return '1 week old';
  if (ageDays < 30) return `${Math.floor(ageDays / 7)} weeks old`;
  return `${Math.floor(ageDays / 30)} months old`;
}

export function normalizeMarketSnapshot(record: MarketSnapshot): MarketSnapshot {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? MARKET_SNAPSHOT_SCHEMA_VERSION,
    marketplaces: record.marketplaces ?? [],
    regions: record.regions ?? [],
    keywords: record.keywords ?? [],
    themes: record.themes ?? [],
    niches: record.niches ?? [],
    motifs: record.motifs ?? [],
    styles: record.styles ?? [],
    colors: record.colors ?? [],
    seasons: record.seasons ?? [],
    productUseCases: record.productUseCases ?? [],
    opportunityIds: record.opportunityIds ?? [],
    recommendations: record.recommendations ?? [],
    evidenceRefs: record.evidenceRefs ?? [],
    archived: record.archived ?? false,
  };
}

export function isValidMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<MarketSnapshot>;
  return (
    typeof r.id === 'string' &&
    typeof r.createdAt === 'number' &&
    !!r.researchDateRange &&
    typeof r.researchDateRange.from === 'number' &&
    typeof r.researchDateRange.to === 'number' &&
    Array.isArray(r.evidenceRefs) &&
    isValidEvidenceBand(r.confidence) &&
    typeof r.archived === 'boolean'
  );
}

/** Duplicate a snapshot as a new, independent record (Section 3's "Duplicate
 * snapshot") — a fresh id/createdAt, everything else copied verbatim so the
 * user can branch a snapshot before editing without mutating the original. */
export function duplicateMarketSnapshot(source: MarketSnapshot, now: number = Date.now()): MarketSnapshot {
  return {
    ...source,
    id: marketSnapshotId.generate(now),
    createdAt: now,
    archived: false,
    dataFreshness: describeSnapshotFreshness(now, now),
  };
}
