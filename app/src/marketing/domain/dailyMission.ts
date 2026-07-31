import { dailyMissionId } from './id';
import { isValidOpportunityStatus, type OpportunityStatus } from './marketOpportunity';
import type { EvidenceBand } from './evidence';

// Build 028, Module 1 Sections 1 & 10 — Today's Market Mission / Daily
// Production Plan item. Every field the brief's example dashboard shows
// (theme, marketplace, hero motif, composition, color direction, output
// counts, opportunity score, confidence, evidence freshness, risks) is a
// real field here, populated from a real MarketOpportunity + MarketSnapshot
// by `mission/dailyMissionGenerator.ts` — this record itself carries no
// generation logic, only the resulting recommendation plus the user's own
// accept/reject/postpone/edit decision trail via `status`.

export const DAILY_MISSION_SCHEMA_VERSION = 1;

export interface DailyMission {
  id: string;
  date: number;
  opportunityId: string;
  primaryMarketplace: string;
  secondaryMarketplace: string | null;
  niche: string;
  theme: string;
  category: string;
  heroMotif: string;
  secondaryMotifs: string[];
  composition: string;
  colorDirection: string[];
  density: string;
  buyerGroup: string;
  productUseCases: string[];
  designCount: number;
  colorwayCount: number;
  submissionTiming: string;
  opportunityScore: number;
  confidence: EvidenceBand;
  evidenceFreshness: string;
  risks: string[];
  status: OpportunityStatus;
  createdAt: number;
  schemaVersion: number;
}

export class InvalidDailyMissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDailyMissionInputError';
  }
}

export interface CreateDailyMissionInput {
  date: number;
  opportunityId: string;
  primaryMarketplace: string;
  niche: string;
  theme: string;
  category: string;
  heroMotif: string;
  opportunityScore: number;
  confidence: EvidenceBand;
  evidenceFreshness: string;
  secondaryMarketplace?: string | null;
  secondaryMotifs?: string[];
  composition?: string;
  colorDirection?: string[];
  density?: string;
  buyerGroup?: string;
  productUseCases?: string[];
  designCount?: number;
  colorwayCount?: number;
  submissionTiming?: string;
  risks?: string[];
  now?: number;
}

export function createDailyMission(input: CreateDailyMissionInput): DailyMission {
  if (!input.opportunityId.trim()) {
    throw new InvalidDailyMissionInputError('opportunityId cannot be empty.');
  }
  if (!input.theme.trim()) {
    throw new InvalidDailyMissionInputError('theme cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: dailyMissionId.generate(now),
    date: input.date,
    opportunityId: input.opportunityId,
    primaryMarketplace: input.primaryMarketplace,
    secondaryMarketplace: input.secondaryMarketplace ?? null,
    niche: input.niche,
    theme: input.theme,
    category: input.category,
    heroMotif: input.heroMotif,
    secondaryMotifs: input.secondaryMotifs ?? [],
    composition: input.composition ?? '',
    colorDirection: input.colorDirection ?? [],
    density: input.density ?? '',
    buyerGroup: input.buyerGroup ?? '',
    productUseCases: input.productUseCases ?? [],
    designCount: input.designCount ?? 10,
    colorwayCount: input.colorwayCount ?? 3,
    submissionTiming: input.submissionTiming ?? '',
    opportunityScore: input.opportunityScore,
    confidence: input.confidence,
    evidenceFreshness: input.evidenceFreshness,
    risks: input.risks ?? [],
    status: 'RESEARCH',
    createdAt: now,
    schemaVersion: DAILY_MISSION_SCHEMA_VERSION,
  };
}

/** Section 10's "accept, reject, postpone, or edit" — a plain status
 * transition, appended to no separate history store since `status` on
 * this record IS the current decision (consistent with this codebase's
 * "in-record status" convention, e.g. SubmissionRecord.statusHistory). */
export function transitionDailyMissionStatus(mission: DailyMission, status: OpportunityStatus): DailyMission {
  if (!isValidOpportunityStatus(status)) {
    throw new InvalidDailyMissionInputError(`Unknown status "${String(status)}".`);
  }
  return { ...mission, status };
}

export function isValidDailyMission(value: unknown): value is DailyMission {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<DailyMission>;
  return (
    typeof r.id === 'string' &&
    typeof r.date === 'number' &&
    typeof r.opportunityId === 'string' &&
    typeof r.theme === 'string' &&
    typeof r.opportunityScore === 'number' &&
    isValidOpportunityStatus(r.status)
  );
}
