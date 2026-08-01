import { describe, it, expect } from 'vitest';
import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord } from '../domain/types';
import { COMMERCIAL_POLICIES } from './commercialPolicies';

const NOW = 1_700_000_000_000;

function ctx(requestedAction: string | null): DecisionRequestContext {
  return { domain: 'commercial', requestedAction, now: NOW, data: {} };
}

function record(id: string, value: unknown): EvidenceRecord {
  return { id, source: 'commercial', label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.7, missingData: [], value };
}

function bundle(...records: EvidenceRecord[]): EvidenceBundle {
  return { gatheredAt: NOW, records };
}

describe('commercialPolicies', () => {
  it('neverExportBelowReadinessThreshold blocks export when readiness is below the threshold', () => {
    const [policy] = COMMERCIAL_POLICIES;
    const evidence = bundle(record('commercial:readiness', { assetId: 'a1', score: 42, threshold: 95 }));
    const result = policy.evaluate(evidence, ctx('export'));
    expect(result.applies).toBe(true);
    expect(result.blockedReason).toMatch(/42%/);
    expect(result.blockedReason).toMatch(/95%/);
    expect(result.action).toBeNull();
  });

  it('neverExportBelowReadinessThreshold allows export once readiness meets the threshold', () => {
    const [policy] = COMMERCIAL_POLICIES;
    const evidence = bundle(record('commercial:readiness', { assetId: 'a1', score: 96, threshold: 95 }));
    const result = policy.evaluate(evidence, ctx('export'));
    expect(result.blockedReason).toBeNull();
    expect(result.action).toBe('export');
  });

  it('also blocks buildPackage, not just export', () => {
    const [policy] = COMMERCIAL_POLICIES;
    const evidence = bundle(record('commercial:readiness', { assetId: 'a1', score: 10, threshold: 95 }));
    const result = policy.evaluate(evidence, ctx('buildPackage'));
    expect(result.blockedReason).not.toBeNull();
  });

  it('does not apply to unrelated requested actions', () => {
    const [policy] = COMMERCIAL_POLICIES;
    const evidence = bundle(record('commercial:readiness', { assetId: 'a1', score: 10, threshold: 95 }));
    const result = policy.evaluate(evidence, ctx('generate'));
    expect(result.applies).toBe(false);
  });

  it('declares exactly the 1 policy named in the spec', () => {
    expect(COMMERCIAL_POLICIES.map((p) => p.id)).toEqual(['commercial.neverExportBelowReadinessThreshold']);
  });
});
