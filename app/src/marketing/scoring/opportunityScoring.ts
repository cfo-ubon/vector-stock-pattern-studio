import type { EvidenceBand, EvidenceStatus } from '../domain/evidence';
import { EVIDENCE_BAND_VALUES } from '../domain/evidence';
import { OPPORTUNITY_SCORE_DIMENSIONS, labelForScore, type OpportunityScoreDimension, type ScoringProfile } from '../domain/scoringProfile';

// Build 028, Module 1 Section 9 (Commercial Opportunity Scoring). This is
// the transparent scoring engine the brief requires: every component shows
// its raw value, weight, weighted contribution, evidence source,
// confidence, and whether it was missing — nothing about the formula is
// hidden, and a dimension with no evidence yet is never silently treated
// as zero or as "neutral 50" (either would be a fabricated number); it is
// excluded from the weighted average entirely and flagged in
// `missingDimensions`.

export interface OpportunityScoreInput {
  /** 0-100. Absent/undefined means "no evidence for this dimension yet" —
   * distinct from a real 0, which would mean "evidence says zero opportunity." */
  value?: number;
  evidenceSource: EvidenceStatus;
  confidence: EvidenceBand;
}

export type OpportunityScoreInputs = Partial<Record<OpportunityScoreDimension, OpportunityScoreInput>>;

export interface OpportunityScoreComponent {
  dimension: OpportunityScoreDimension;
  rawValue: number | null;
  weight: number;
  weightedContribution: number;
  evidenceSource: EvidenceStatus | null;
  confidence: EvidenceBand | null;
  missingData: boolean;
}

export interface OpportunityScoreResult {
  components: OpportunityScoreComponent[];
  overall: number;
  band: string;
  confidence: EvidenceBand;
  missingDimensions: OpportunityScoreDimension[];
  scoringProfileId: string;
}

const BAND_RANK: Record<EvidenceBand, number> = { 'very-low': 0, low: 1, medium: 2, high: 3, 'very-high': 4, unknown: -1 };

/** Overall confidence is the *weakest* confidence among dimensions that
 * actually contributed a value — a conservative, explainable rule (an
 * opportunity is only as trustworthy as its least-certain real input),
 * not an average that could mask one bad data point. `unknown` inputs are
 * excluded from this comparison the same way missing values are excluded
 * from the score itself, since `unknown` isn't a rank between low/high. */
function weakestConfidence(confidences: EvidenceBand[]): EvidenceBand {
  const ranked = confidences.filter((c) => BAND_RANK[c] >= 0);
  if (ranked.length === 0) return 'unknown';
  return ranked.reduce((weakest, current) => (BAND_RANK[current] < BAND_RANK[weakest] ? current : weakest));
}

export function computeOpportunityScore(inputs: OpportunityScoreInputs, profile: ScoringProfile): OpportunityScoreResult {
  const components: OpportunityScoreComponent[] = OPPORTUNITY_SCORE_DIMENSIONS.map((dimension) => {
    const input = inputs[dimension];
    const weight = profile.weights[dimension] ?? 0;
    const missingData = !input || typeof input.value !== 'number';
    return {
      dimension,
      rawValue: missingData ? null : (input!.value as number),
      weight,
      weightedContribution: 0, // filled in below once totalWeightUsed is known
      evidenceSource: input?.evidenceSource ?? null,
      confidence: input?.confidence ?? null,
      missingData,
    };
  });

  const usedComponents = components.filter((c) => !c.missingData && c.weight > 0);
  const totalWeightUsed = usedComponents.reduce((sum, c) => sum + c.weight, 0);

  let overall = 0;
  if (totalWeightUsed > 0) {
    for (const component of components) {
      if (component.missingData || component.weight <= 0) continue;
      component.weightedContribution = (component.rawValue! * component.weight) / totalWeightUsed;
      overall += component.weightedContribution;
    }
    overall = Math.round(overall);
  }

  const missingDimensions = components.filter((c) => c.missingData).map((c) => c.dimension);
  const confidence = weakestConfidence(usedComponents.map((c) => c.confidence).filter((c): c is EvidenceBand => c !== null));

  return {
    components,
    overall,
    band: totalWeightUsed > 0 ? labelForScore(overall, profile.bands) : 'Insufficient Evidence',
    confidence,
    missingDimensions,
    scoringProfileId: profile.id,
  };
}

export { EVIDENCE_BAND_VALUES };
