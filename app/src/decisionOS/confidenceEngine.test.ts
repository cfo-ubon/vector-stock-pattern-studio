import { describe, it, expect } from 'vitest';
import type { EvidenceBundle, EvidenceRecord, PolicyEvaluation } from './domain/types';
import { computeConfidence } from './confidenceEngine';

const NOW = 1_700_000_000_000;

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return { id: 'e1', source: 'portfolio', label: 'e1', timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value: null, ...overrides };
}

function evaluation(overrides: Partial<PolicyEvaluation> = {}): PolicyEvaluation {
  return { policyId: 'p1', policyName: 'p1', domain: 'factory', applies: true, action: 'doThing', blockedReason: null, warning: null, detail: 'detail', evidenceIds: ['e1'], ...overrides };
}

describe('confidenceEngine', () => {
  it('never fabricates confidence: zero evidence always produces score 0, band unknown', () => {
    const result = computeConfidence({ gatheredAt: NOW, records: [] }, []);
    expect(result.score).toBe(0);
    expect(result.band).toBe('unknown');
  });

  it('full completeness + full policy coverage + no missing data produces a high-band score', () => {
    const bundle: EvidenceBundle = { gatheredAt: NOW, records: [record()] };
    const result = computeConfidence(bundle, [evaluation()]);
    expect(result.band).toBe('high');
    expect(result.score).toBeGreaterThan(70);
  });

  it('missing data on evidence records lowers the score relative to a clean bundle', () => {
    const clean = computeConfidence({ gatheredAt: NOW, records: [record()] }, [evaluation()]);
    const dirty = computeConfidence({ gatheredAt: NOW, records: [record({ missingData: ['a', 'b', 'c'] })] }, [evaluation()]);
    expect(dirty.score).toBeLessThan(clean.score);
  });

  it('conflicting candidate actions from different policies lower the score', () => {
    const bundle: EvidenceBundle = { gatheredAt: NOW, records: [record()] };
    const agree = computeConfidence(bundle, [evaluation({ policyId: 'p1', action: 'x' }), evaluation({ policyId: 'p2', action: 'x' })]);
    const conflict = computeConfidence(bundle, [evaluation({ policyId: 'p1', action: 'x' }), evaluation({ policyId: 'p2', action: 'y' })]);
    expect(conflict.score).toBeLessThan(agree.score);
  });

  it('unknown-freshness evidence lowers the score', () => {
    const known = computeConfidence({ gatheredAt: NOW, records: [record({ freshness: 'LIVE' })] }, [evaluation()]);
    const unknown = computeConfidence({ gatheredAt: NOW, records: [record({ freshness: 'UNKNOWN' })] }, [evaluation()]);
    expect(unknown.score).toBeLessThan(known.score);
  });

  it('explanation always documents how the score was reached', () => {
    const result = computeConfidence({ gatheredAt: NOW, records: [record()] }, [evaluation()]);
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation.join(' ')).toMatch(/completeness/i);
  });
});
