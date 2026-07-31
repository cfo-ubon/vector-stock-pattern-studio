import { marketOpportunityId } from './id';
import type { OpportunityScoreResult } from '../scoring/opportunityScoring';

// Build 028, Module 1 Section 6/9 — a scored opportunity derived from a
// Market Snapshot. The `score` field is the exact, already-computed
// `OpportunityScoreResult` from `opportunityScoring.ts` (components, band,
// confidence, missing dimensions included) rather than just the final
// number, so anything that renders an opportunity can show the full
// "why" without recomputing the score from scratch.

export const OPPORTUNITY_STATUS_VALUES = [
  'RESEARCH',
  'SELECTED',
  'BRIEF_READY',
  'DESIGNING',
  'GENERATED',
  'QA_REVIEW',
  'READY_TO_EXPORT',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'ARCHIVED',
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUS_VALUES)[number];

export function isValidOpportunityStatus(value: unknown): value is OpportunityStatus {
  return typeof value === 'string' && (OPPORTUNITY_STATUS_VALUES as readonly string[]).includes(value);
}

export const MARKET_OPPORTUNITY_SCHEMA_VERSION = 1;

export interface MarketOpportunity {
  id: string;
  snapshotId: string;
  title: string;
  theme: string;
  niche: string;
  marketplace: string;
  score: OpportunityScoreResult;
  status: OpportunityStatus;
  evidenceRefs: string[];
  createdAt: number;
  schemaVersion: number;
}

export class InvalidMarketOpportunityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketOpportunityInputError';
  }
}

export interface CreateMarketOpportunityInput {
  snapshotId: string;
  title: string;
  theme: string;
  niche: string;
  marketplace: string;
  score: OpportunityScoreResult;
  evidenceRefs: string[];
  now?: number;
}

export function createMarketOpportunity(input: CreateMarketOpportunityInput): MarketOpportunity {
  if (!input.snapshotId.trim()) {
    throw new InvalidMarketOpportunityInputError('snapshotId cannot be empty.');
  }
  if (!input.title.trim()) {
    throw new InvalidMarketOpportunityInputError('title cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: marketOpportunityId.generate(now),
    snapshotId: input.snapshotId,
    title: input.title,
    theme: input.theme,
    niche: input.niche,
    marketplace: input.marketplace,
    score: input.score,
    status: 'RESEARCH',
    evidenceRefs: input.evidenceRefs,
    createdAt: now,
    schemaVersion: MARKET_OPPORTUNITY_SCHEMA_VERSION,
  };
}

export function isValidMarketOpportunity(value: unknown): value is MarketOpportunity {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<MarketOpportunity>;
  return (
    typeof r.id === 'string' &&
    typeof r.snapshotId === 'string' &&
    typeof r.title === 'string' &&
    isValidOpportunityStatus(r.status) &&
    !!r.score &&
    Array.isArray(r.evidenceRefs)
  );
}
