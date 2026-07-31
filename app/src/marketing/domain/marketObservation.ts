import { marketObservationId } from './id';
import { isValidEvidenceStatus, isValidEvidenceBand, type EvidenceStatus, type EvidenceBand } from './evidence';
import { isValidResearchSourceType, type ResearchSourceType } from './researchSource';

// Build 028, Module 1 Section 2 (Market Research Workspace) — one captured
// research finding. Deliberately self-contained (every field the brief
// lists lives directly on this record, not split across a join) so a
// single quick manual note is a complete, valid observation on its own;
// `researchSourceId` is an *optional* pointer to a reusable `ResearchSource`
// for when the same source backs several observations over time, never a
// requirement for validity.

export const TREND_DIRECTIONS = ['rising', 'stable', 'declining', 'seasonal-spike', 'unknown'] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];
export function isValidTrendDirection(value: unknown): value is TrendDirection {
  return typeof value === 'string' && (TREND_DIRECTIONS as readonly string[]).includes(value);
}

export const BUYER_INTENT_VALUES = ['browsing', 'considering', 'ready-to-buy', 'repeat-buyer', 'unknown'] as const;
export type BuyerIntent = (typeof BUYER_INTENT_VALUES)[number];
export function isValidBuyerIntent(value: unknown): value is BuyerIntent {
  return typeof value === 'string' && (BUYER_INTENT_VALUES as readonly string[]).includes(value);
}

export const MARKET_OBSERVATION_SCHEMA_VERSION = 1;

export interface MarketObservation {
  id: string;
  researchSourceId: string | null;
  sourceType: ResearchSourceType;
  marketplace: string | null;
  sourceTitle: string;
  searchTerm: string;
  url: string | null;
  observationDate: number;
  region: string | null;
  language: string | null;
  referenceNote: string;
  trendDirection: TrendDirection;
  demandSignal: EvidenceBand;
  competitionSignal: EvidenceBand;
  buyerIntent: BuyerIntent;
  seasonality: string;
  notes: string;
  confidence: EvidenceBand;
  evidenceStatus: EvidenceStatus;
  tags: string[];
  createdAt: number;
  schemaVersion: number;
}

export class InvalidMarketObservationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketObservationInputError';
  }
}

export interface CreateMarketObservationInput {
  sourceType: ResearchSourceType;
  evidenceStatus: EvidenceStatus;
  researchSourceId?: string | null;
  marketplace?: string | null;
  sourceTitle?: string;
  searchTerm?: string;
  url?: string | null;
  observationDate?: number;
  region?: string | null;
  language?: string | null;
  referenceNote?: string;
  trendDirection?: TrendDirection;
  demandSignal?: EvidenceBand;
  competitionSignal?: EvidenceBand;
  buyerIntent?: BuyerIntent;
  seasonality?: string;
  notes?: string;
  confidence?: EvidenceBand;
  tags?: string[];
  now?: number;
}

/** `evidenceStatus` has no default — the non-negotiable rule from
 * BUILD_028_AUDIT.md Section 4 is that no code path may silently guess a
 * provenance, so every caller (UI form, sample-data seeder, import pipeline)
 * must state it explicitly or this factory rejects the input outright. */
export function createMarketObservation(input: CreateMarketObservationInput): MarketObservation {
  if (!isValidResearchSourceType(input.sourceType)) {
    throw new InvalidMarketObservationInputError(`Unknown sourceType "${String(input.sourceType)}".`);
  }
  if (!isValidEvidenceStatus(input.evidenceStatus)) {
    throw new InvalidMarketObservationInputError(`Unknown evidenceStatus "${String(input.evidenceStatus)}".`);
  }
  const now = input.now ?? Date.now();
  return {
    id: marketObservationId.generate(now),
    researchSourceId: input.researchSourceId ?? null,
    sourceType: input.sourceType,
    marketplace: input.marketplace ?? null,
    sourceTitle: input.sourceTitle ?? '',
    searchTerm: input.searchTerm ?? '',
    url: input.url ?? null,
    observationDate: input.observationDate ?? now,
    region: input.region ?? null,
    language: input.language ?? null,
    referenceNote: input.referenceNote ?? '',
    trendDirection: input.trendDirection ?? 'unknown',
    demandSignal: input.demandSignal ?? 'unknown',
    competitionSignal: input.competitionSignal ?? 'unknown',
    buyerIntent: input.buyerIntent ?? 'unknown',
    seasonality: input.seasonality ?? '',
    notes: input.notes ?? '',
    confidence: input.confidence ?? 'unknown',
    evidenceStatus: input.evidenceStatus,
    tags: input.tags ?? [],
    createdAt: now,
    schemaVersion: MARKET_OBSERVATION_SCHEMA_VERSION,
  };
}

export function normalizeMarketObservation(record: MarketObservation): MarketObservation {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? MARKET_OBSERVATION_SCHEMA_VERSION,
    researchSourceId: record.researchSourceId ?? null,
    marketplace: record.marketplace ?? null,
    sourceTitle: record.sourceTitle ?? '',
    searchTerm: record.searchTerm ?? '',
    url: record.url ?? null,
    region: record.region ?? null,
    language: record.language ?? null,
    referenceNote: record.referenceNote ?? '',
    trendDirection: record.trendDirection ?? 'unknown',
    demandSignal: record.demandSignal ?? 'unknown',
    competitionSignal: record.competitionSignal ?? 'unknown',
    buyerIntent: record.buyerIntent ?? 'unknown',
    seasonality: record.seasonality ?? '',
    notes: record.notes ?? '',
    confidence: record.confidence ?? 'unknown',
    tags: record.tags ?? [],
  };
}

export function isValidMarketObservation(value: unknown): value is MarketObservation {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<MarketObservation>;
  return (
    typeof r.id === 'string' &&
    isValidResearchSourceType(r.sourceType) &&
    isValidEvidenceStatus(r.evidenceStatus) &&
    isValidEvidenceBand(r.demandSignal) &&
    isValidEvidenceBand(r.competitionSignal) &&
    isValidEvidenceBand(r.confidence) &&
    typeof r.observationDate === 'number' &&
    typeof r.createdAt === 'number' &&
    Array.isArray(r.tags)
  );
}
