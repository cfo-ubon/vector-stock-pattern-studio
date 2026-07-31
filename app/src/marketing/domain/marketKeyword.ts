import { marketKeywordId } from './id';
import { isValidEvidenceStatus, type EvidenceStatus, type EvidenceBand } from './evidence';
import { isValidTrendDirection, type TrendDirection } from './marketObservation';

// Build 028, Module 1 Section 5 (Keyword Intelligence). Competition/
// opportunity/duplicate-risk are all qualitative EvidenceBand values — the
// brief is explicit that this build must never invent a search-volume
// number, so there is deliberately no numeric "searchVolume" field
// anywhere on this record.

export const KEYWORD_CLUSTER_VALUES = [
  'core',
  'subject',
  'style',
  'color',
  'composition',
  'product-use',
  'seasonal',
  'buyer-intent',
] as const;

export type KeywordCluster = (typeof KEYWORD_CLUSTER_VALUES)[number];

export function isValidKeywordCluster(value: unknown): value is KeywordCluster {
  return typeof value === 'string' && (KEYWORD_CLUSTER_VALUES as readonly string[]).includes(value);
}

export const MARKET_KEYWORD_SCHEMA_VERSION = 1;

export interface MarketKeyword {
  id: string;
  keyword: string;
  parentTheme: string;
  relatedKeywords: string[];
  marketplace: string | null;
  language: string | null;
  buyerIntent: string;
  trendDirection: TrendDirection;
  competitionEstimate: EvidenceBand;
  opportunityEstimate: EvidenceBand;
  seasonalRelevance: string;
  productRelevance: string[];
  portfolioCoverage: number;
  lastUsedDate: number | null;
  lastSubmittedDate: number | null;
  duplicateRisk: EvidenceBand;
  evidenceSource: EvidenceStatus;
  confidence: EvidenceBand;
  cluster: KeywordCluster;
  createdAt: number;
  schemaVersion: number;
}

export class InvalidMarketKeywordInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketKeywordInputError';
  }
}

export interface CreateMarketKeywordInput {
  keyword: string;
  cluster: KeywordCluster;
  evidenceSource: EvidenceStatus;
  parentTheme?: string;
  relatedKeywords?: string[];
  marketplace?: string | null;
  language?: string | null;
  buyerIntent?: string;
  trendDirection?: TrendDirection;
  competitionEstimate?: EvidenceBand;
  opportunityEstimate?: EvidenceBand;
  seasonalRelevance?: string;
  productRelevance?: string[];
  portfolioCoverage?: number;
  duplicateRisk?: EvidenceBand;
  confidence?: EvidenceBand;
  now?: number;
}

export function createMarketKeyword(input: CreateMarketKeywordInput): MarketKeyword {
  if (!input.keyword.trim()) {
    throw new InvalidMarketKeywordInputError('keyword cannot be empty.');
  }
  if (!isValidKeywordCluster(input.cluster)) {
    throw new InvalidMarketKeywordInputError(`Unknown cluster "${String(input.cluster)}".`);
  }
  if (!isValidEvidenceStatus(input.evidenceSource)) {
    throw new InvalidMarketKeywordInputError(`Unknown evidenceSource "${String(input.evidenceSource)}".`);
  }
  const now = input.now ?? Date.now();
  return {
    id: marketKeywordId.generate(now),
    keyword: input.keyword,
    parentTheme: input.parentTheme ?? '',
    relatedKeywords: input.relatedKeywords ?? [],
    marketplace: input.marketplace ?? null,
    language: input.language ?? null,
    buyerIntent: input.buyerIntent ?? '',
    trendDirection: input.trendDirection ?? 'unknown',
    competitionEstimate: input.competitionEstimate ?? 'unknown',
    opportunityEstimate: input.opportunityEstimate ?? 'unknown',
    seasonalRelevance: input.seasonalRelevance ?? '',
    productRelevance: input.productRelevance ?? [],
    portfolioCoverage: input.portfolioCoverage ?? 0,
    lastUsedDate: null,
    lastSubmittedDate: null,
    duplicateRisk: input.duplicateRisk ?? 'unknown',
    evidenceSource: input.evidenceSource,
    confidence: input.confidence ?? 'unknown',
    cluster: input.cluster,
    createdAt: now,
    schemaVersion: MARKET_KEYWORD_SCHEMA_VERSION,
  };
}

export function normalizeMarketKeyword(record: MarketKeyword): MarketKeyword {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? MARKET_KEYWORD_SCHEMA_VERSION,
    relatedKeywords: record.relatedKeywords ?? [],
    productRelevance: record.productRelevance ?? [],
    portfolioCoverage: record.portfolioCoverage ?? 0,
    lastUsedDate: record.lastUsedDate ?? null,
    lastSubmittedDate: record.lastSubmittedDate ?? null,
  };
}

export function isValidMarketKeyword(value: unknown): value is MarketKeyword {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<MarketKeyword>;
  return (
    typeof r.id === 'string' &&
    typeof r.keyword === 'string' &&
    isValidKeywordCluster(r.cluster) &&
    isValidEvidenceStatus(r.evidenceSource) &&
    isValidTrendDirection(r.trendDirection) &&
    typeof r.createdAt === 'number'
  );
}
