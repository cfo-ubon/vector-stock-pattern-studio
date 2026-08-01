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

  it('declares the 1 policy named in the original spec plus the 4 Build 031B Hardening cascade policies', () => {
    expect(COMMERCIAL_POLICIES.map((p) => p.id).sort()).toEqual(
      [
        'commercial.neverExportBelowReadinessThreshold',
        'commercial.completeCollectionFirst',
        'commercial.repairBeforeSeo',
        'commercial.finishSeoBeforePackaging',
        'commercial.recommendExportWhenReady',
      ].sort(),
    );
  });

  function policyById(id: string) {
    const p = COMMERCIAL_POLICIES.find((x) => x.id === id);
    if (!p) throw new Error(`policy not found: ${id}`);
    return p;
  }

  it('completeCollectionFirst recommends assigning a Collection when the asset has none', () => {
    const policy = policyById('commercial.completeCollectionFirst');
    const evidence = bundle(record('commercial:collectionAssignment', { assigned: false }));
    const result = policy.evaluate(evidence, ctx(null));
    expect(result.applies).toBe(true);
    expect(result.action).toBe('completeCollection');
  });

  it('completeCollectionFirst does not fire once the asset is assigned', () => {
    const policy = policyById('commercial.completeCollectionFirst');
    const evidence = bundle(record('commercial:collectionAssignment', { assigned: true }));
    const result = policy.evaluate(evidence, ctx(null));
    expect(result.applies).toBe(false);
  });

  it('repairBeforeSeo recommends repair when QA has not passed', () => {
    const policy = policyById('commercial.repairBeforeSeo');
    const evidence: EvidenceBundle = { gatheredAt: NOW, records: [{ id: 'qa:assetQaStatus', source: 'qa', label: 'qa', timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value: { passed: false } }] };
    const result = policy.evaluate(evidence, ctx(null));
    expect(result.applies).toBe(true);
    expect(result.action).toBe('repair');
  });

  it('finishSeoBeforePackaging recommends finishing SEO when missing', () => {
    const policy = policyById('commercial.finishSeoBeforePackaging');
    const evidence = bundle(record('commercial:seoStatus', { hasSeo: false }));
    const result = policy.evaluate(evidence, ctx(null));
    expect(result.applies).toBe(true);
    expect(result.action).toBe('finishSeo');
  });

  it('recommendExportWhenReady fires only once score meets threshold with zero failing checks', () => {
    const policy = policyById('commercial.recommendExportWhenReady');
    const ready = bundle(record('commercial:readiness', { score: 100, threshold: 95, failingChecksCount: 0 }));
    expect(policy.evaluate(ready, ctx(null)).action).toBe('exportReady');
    const notReady = bundle(record('commercial:readiness', { score: 100, threshold: 95, failingChecksCount: 1 }));
    expect(policy.evaluate(notReady, ctx(null)).applies).toBe(false);
  });
});
