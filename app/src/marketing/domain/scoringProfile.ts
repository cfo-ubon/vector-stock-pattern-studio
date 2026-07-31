import { scoringProfileId } from './id';

// Build 028, Module 1 Section 9 (Commercial Opportunity Scoring) — the
// editable weight/band configuration. The brief is explicit that weights
// must be visible and user-editable and that the formula must never be
// hidden, so both `weights` and `bands` are plain, inspectable data on this
// record, not constants buried in the scoring function.

export const OPPORTUNITY_SCORE_DIMENSIONS = [
  'demandSignal',
  'trendMomentum',
  'competitionAdvantage',
  'seasonalTiming',
  'marketplaceFit',
  'portfolioGap',
  'buyerIntent',
  'productVersatility',
  'productionFeasibility',
  'historicalSalesEvidence',
  'rejectionRisk',
  'evidenceQuality',
  'dataFreshness',
] as const;

export type OpportunityScoreDimension = (typeof OPPORTUNITY_SCORE_DIMENSIONS)[number];

export function isValidOpportunityScoreDimension(value: unknown): value is OpportunityScoreDimension {
  return typeof value === 'string' && (OPPORTUNITY_SCORE_DIMENSIONS as readonly string[]).includes(value);
}

export type ScoringWeights = Record<OpportunityScoreDimension, number>;

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

/** Every dimension defaults to equal weight (1) — a deliberate "no opinion
 * baked in" starting point the user is expected to edit once they have
 * real evidence about which signals matter most for their own portfolio,
 * per the brief's "the user must be able to edit scoring weights" rule. */
export function defaultScoringWeights(): ScoringWeights {
  return Object.fromEntries(OPPORTUNITY_SCORE_DIMENSIONS.map((d) => [d, 1])) as ScoringWeights;
}

/** The brief's own documented default bands (85-100 Strong Opportunity ...
 * below 40 Avoid or Reconsider), kept as plain, user-editable data rather
 * than an if/else ladder in the scoring function. */
export function defaultScoreBands(): ScoreBand[] {
  return [
    { min: 85, max: 100, label: 'Strong Opportunity' },
    { min: 70, max: 84, label: 'Promising' },
    { min: 55, max: 69, label: 'Experimental' },
    { min: 40, max: 54, label: 'Weak' },
    { min: 0, max: 39, label: 'Avoid or Reconsider' },
  ];
}

export const SCORING_PROFILE_SCHEMA_VERSION = 1;

export interface ScoringProfile {
  id: string;
  name: string;
  weights: ScoringWeights;
  bands: ScoreBand[];
  isDefault: boolean;
  updatedAt: number;
  schemaVersion: number;
}

export class InvalidScoringProfileInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScoringProfileInputError';
  }
}

export interface CreateScoringProfileInput {
  name: string;
  weights?: Partial<ScoringWeights>;
  bands?: ScoreBand[];
  isDefault?: boolean;
  now?: number;
}

export function createScoringProfile(input: CreateScoringProfileInput): ScoringProfile {
  if (!input.name.trim()) {
    throw new InvalidScoringProfileInputError('name cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    id: scoringProfileId.generate(now),
    name: input.name,
    weights: { ...defaultScoringWeights(), ...input.weights },
    bands: input.bands ?? defaultScoreBands(),
    isDefault: input.isDefault ?? false,
    updatedAt: now,
    schemaVersion: SCORING_PROFILE_SCHEMA_VERSION,
  };
}

export function labelForScore(score: number, bands: ScoreBand[]): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const match = sorted.find((band) => score >= band.min && score <= band.max);
  return match?.label ?? 'Unclassified';
}

export function isValidScoringProfile(value: unknown): value is ScoringProfile {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<ScoringProfile>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    !!r.weights &&
    Array.isArray(r.bands) &&
    typeof r.isDefault === 'boolean' &&
    typeof r.updatedAt === 'number'
  );
}
