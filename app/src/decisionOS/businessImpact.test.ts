import { describe, it, expect } from 'vitest';
import type { ConfidenceResult, PolicyDefinition, PolicyEvaluation } from './domain/types';
import { estimateBusinessImpact } from './businessImpact';

function policy(id: string, impact: PolicyDefinition['impactWhenApplies']): PolicyDefinition {
  return {
    id,
    name: id,
    description: 'test',
    domain: 'factory',
    version: 1,
    defaultPriority: 1,
    defaultStatus: 'ENABLED',
    requiredEvidence: [],
    expectedOutcome: 'test',
    impactWhenApplies: impact,
    examples: [],
    evaluate: (): PolicyEvaluation => ({ policyId: id, policyName: id, domain: 'factory', applies: true, action: 'x', blockedReason: null, warning: null, detail: 'fires', evidenceIds: [] }),
  };
}

function confidence(band: ConfidenceResult['band'], score = 80): ConfidenceResult {
  return { score, band, explanation: [], factors: { evidenceCompleteness: 1, policyCoverage: 1, missingInfoPenalty: 0, conflictPenalty: 0, unknownPenalty: 0 } };
}

describe('businessImpact.estimateBusinessImpact', () => {
  it('never estimates revenue — returns only the fixed qualitative enum', () => {
    const result = estimateBusinessImpact([policy('a', 'HIGH')], [], confidence('high'));
    expect(result.impact).toBe('HIGH');
    expect(typeof result.impact).toBe('string');
  });

  it('no firing policy -> UNKNOWN impact, never a guess', () => {
    const result = estimateBusinessImpact([], [], confidence('unknown', 0));
    expect(result.impact).toBe('UNKNOWN');
  });

  it('takes the strongest impact among multiple firing policies', () => {
    const result = estimateBusinessImpact([policy('a', 'LOW'), policy('b', 'VERY_HIGH')], [], confidence('high'));
    expect(result.impact).toBe('VERY_HIGH');
  });

  it('downgrades impact when confidence is not high — never claims full impact on a low-confidence decision', () => {
    const high = estimateBusinessImpact([policy('a', 'VERY_HIGH')], [], confidence('high'));
    const low = estimateBusinessImpact([policy('a', 'VERY_HIGH')], [], confidence('low', 30));
    const unknown = estimateBusinessImpact([policy('a', 'VERY_HIGH')], [], confidence('unknown', 0));
    expect(high.impact).toBe('VERY_HIGH');
    expect(low.impact).not.toBe('VERY_HIGH');
    expect(unknown.impact).toBe('UNKNOWN');
  });

  it('reasons trace back to the specific policy that produced the impact', () => {
    const result = estimateBusinessImpact([policy('completesCollection', 'HIGH')], [], confidence('high'));
    expect(result.reasons.join(' ')).toMatch(/completesCollection/);
  });
});
