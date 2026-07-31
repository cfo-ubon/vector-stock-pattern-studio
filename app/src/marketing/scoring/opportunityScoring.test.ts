import { describe, it, expect } from 'vitest';
import { computeOpportunityScore, type OpportunityScoreInputs } from './opportunityScoring';
import { createScoringProfile } from '../domain/scoringProfile';

describe('computeOpportunityScore', () => {
  it('computes a plain weighted average when every dimension has evidence, matching a hand-calculated value', () => {
    const profile = createScoringProfile({ name: 'Equal', now: 1000 });
    const inputs: OpportunityScoreInputs = {
      demandSignal: { value: 100, evidenceSource: 'VERIFIED_SOURCE', confidence: 'high' },
      trendMomentum: { value: 0, evidenceSource: 'VERIFIED_SOURCE', confidence: 'high' },
    };
    // Only 2 of 13 dimensions have weight+value; every other dimension has
    // weight 1 but no value, so it's excluded entirely, not treated as 0.
    // Weighted average over the 2 used dimensions: (100*1 + 0*1) / 2 = 50.
    const result = computeOpportunityScore(inputs, profile);
    expect(result.overall).toBe(50);
    expect(result.missingDimensions.length).toBe(11);
  });

  it('never treats a missing dimension as a fabricated zero — full marks with only one dimension present', () => {
    const profile = createScoringProfile({ name: 'Equal', now: 1000 });
    const inputs: OpportunityScoreInputs = {
      demandSignal: { value: 90, evidenceSource: 'USER_OBSERVATION', confidence: 'medium' },
    };
    const result = computeOpportunityScore(inputs, profile);
    expect(result.overall).toBe(90);
  });

  it('reports "Insufficient Evidence" rather than a fabricated score when nothing has data', () => {
    const profile = createScoringProfile({ name: 'Equal', now: 1000 });
    const result = computeOpportunityScore({}, profile);
    expect(result.overall).toBe(0);
    expect(result.band).toBe('Insufficient Evidence');
    expect(result.confidence).toBe('unknown');
  });

  it('respects user-edited weights — a heavier weight dominates the average', () => {
    const profile = createScoringProfile({ name: 'Weighted', weights: { demandSignal: 9, trendMomentum: 1 }, now: 1000 });
    const inputs: OpportunityScoreInputs = {
      demandSignal: { value: 100, evidenceSource: 'VERIFIED_SOURCE', confidence: 'high' },
      trendMomentum: { value: 0, evidenceSource: 'VERIFIED_SOURCE', confidence: 'high' },
    };
    const result = computeOpportunityScore(inputs, profile);
    // (100*9 + 0*1) / 10 = 90
    expect(result.overall).toBe(90);
  });

  it('overall confidence is the weakest confidence among dimensions that actually contributed', () => {
    const profile = createScoringProfile({ name: 'Equal', now: 1000 });
    const inputs: OpportunityScoreInputs = {
      demandSignal: { value: 80, evidenceSource: 'VERIFIED_SOURCE', confidence: 'high' },
      trendMomentum: { value: 60, evidenceSource: 'AI_INFERENCE', confidence: 'low' },
    };
    const result = computeOpportunityScore(inputs, profile);
    expect(result.confidence).toBe('low');
  });

  it('every component reports its raw value, weight, evidence source, and confidence for full explainability', () => {
    const profile = createScoringProfile({ name: 'Equal', now: 1000 });
    const inputs: OpportunityScoreInputs = {
      demandSignal: { value: 70, evidenceSource: 'SAMPLE_DATA', confidence: 'unknown' },
    };
    const result = computeOpportunityScore(inputs, profile);
    const demand = result.components.find((c) => c.dimension === 'demandSignal')!;
    expect(demand.rawValue).toBe(70);
    expect(demand.weight).toBe(1);
    expect(demand.evidenceSource).toBe('SAMPLE_DATA');
    expect(demand.missingData).toBe(false);

    const trend = result.components.find((c) => c.dimension === 'trendMomentum')!;
    expect(trend.missingData).toBe(true);
    expect(trend.rawValue).toBeNull();
  });
});
