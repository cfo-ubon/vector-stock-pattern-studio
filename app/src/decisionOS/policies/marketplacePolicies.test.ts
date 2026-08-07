import { describe, it, expect } from 'vitest';
import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord } from '../domain/types';
import { MARKETPLACE_POLICIES } from './marketplacePolicies';

const NOW = 1_700_000_000_000;

function ctx(): DecisionRequestContext {
  return { domain: 'marketplace', requestedAction: null, now: NOW, data: {} };
}

function record(id: string, value: unknown): EvidenceRecord {
  return { id, source: 'marketplace', label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value };
}

function bundle(...records: EvidenceRecord[]): EvidenceBundle {
  return { gatheredAt: NOW, records };
}

function policyById(id: string) {
  const p = MARKETPLACE_POLICIES.find((x) => x.id === id);
  if (!p) throw new Error(`policy not found: ${id}`);
  return p;
}

describe('marketplacePolicies', () => {
  it('useVerifiedProfilesOnly warns (never blocks) on an unverified profile', () => {
    const policy = policyById('marketplace.useVerifiedProfilesOnly');
    const evidence = bundle(record('marketplace:profileVerification', { marketplaceId: 'newSite', future: true, contributorUrlVerified: false }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.blockedReason).toBeNull();
    expect(result.warning).toMatch(/newSite/);
  });

  it('useVerifiedProfilesOnly does not fire for a verified profile', () => {
    const policy = policyById('marketplace.useVerifiedProfilesOnly');
    const evidence = bundle(record('marketplace:profileVerification', { marketplaceId: 'shutterstock', future: false, contributorUrlVerified: true }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(false);
  });

  it('preferLiveMarketEvidence wins when live evidence exists', () => {
    const policy = policyById('marketplace.preferLiveMarketEvidence');
    const evidence = bundle(record('mission:evidenceAvailable', { hasLiveEvidence: true, note: 'Scored opportunity exists', confidenceBand: 'high' }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('targetMarketEvidence');
  });

  it('preferPortfolioGap fires only when live evidence is absent but a Portfolio exists', () => {
    const policy = policyById('marketplace.preferPortfolioGap');
    const evidence = bundle(
      record('mission:evidenceAvailable', { hasLiveEvidence: false, note: 'none', confidenceBand: 'unknown' }),
      record('portfolio:hasAnyAssets', { hasPortfolio: true }),
    );
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('targetPortfolioGap');
  });

  it('preferPortfolioGap does not fire when live evidence exists', () => {
    const policy = policyById('marketplace.preferPortfolioGap');
    const evidence = bundle(
      record('mission:evidenceAvailable', { hasLiveEvidence: true, note: 'x', confidenceBand: 'high' }),
      record('portfolio:hasAnyAssets', { hasPortfolio: true }),
    );
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(false);
  });

  it('preferEvergreenWhenDemandUnknown is the last-resort fallback when neither live evidence nor a Portfolio exists', () => {
    const policy = policyById('marketplace.preferEvergreenWhenDemandUnknown');
    const evidence = bundle(
      record('mission:evidenceAvailable', { hasLiveEvidence: false, note: 'none', confidenceBand: 'unknown' }),
      record('portfolio:hasAnyAssets', { hasPortfolio: false }),
    );
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('targetEvergreen');
  });

  it('the 3-way fallback is mutually exclusive: exactly one of preferLiveMarketEvidence/preferPortfolioGap/preferEvergreen fires per evidence state', () => {
    const scenarios: [string, EvidenceBundle][] = [
      ['live evidence', bundle(record('mission:evidenceAvailable', { hasLiveEvidence: true, note: 'x', confidenceBand: 'high' }), record('portfolio:hasAnyAssets', { hasPortfolio: true }))],
      ['portfolio gap', bundle(record('mission:evidenceAvailable', { hasLiveEvidence: false, note: 'x', confidenceBand: 'unknown' }), record('portfolio:hasAnyAssets', { hasPortfolio: true }))],
      ['evergreen fallback', bundle(record('mission:evidenceAvailable', { hasLiveEvidence: false, note: 'x', confidenceBand: 'unknown' }), record('portfolio:hasAnyAssets', { hasPortfolio: false }))],
    ];
    for (const [, evidence] of scenarios) {
      const applying = [policyById('marketplace.preferLiveMarketEvidence'), policyById('marketplace.preferPortfolioGap'), policyById('marketplace.preferEvergreenWhenDemandUnknown')].filter(
        (p) => p.evaluate(evidence, ctx()).applies,
      );
      expect(applying).toHaveLength(1);
    }
  });

  it('declares the 4 policies named in the spec', () => {
    expect(MARKETPLACE_POLICIES.map((p) => p.id).sort()).toEqual(
      ['marketplace.useVerifiedProfilesOnly', 'marketplace.preferLiveMarketEvidence', 'marketplace.preferPortfolioGap', 'marketplace.preferEvergreenWhenDemandUnknown'].sort(),
    );
  });
});
