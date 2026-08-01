import { describe, it, expect } from 'vitest';
import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord } from '../domain/types';
import { PORTFOLIO_POLICIES } from './portfolioPolicies';

const NOW = 1_700_000_000_000;

function ctx(): DecisionRequestContext {
  return { domain: 'portfolio', requestedAction: null, now: NOW, data: {} };
}

function record(id: string, value: unknown): EvidenceRecord {
  return { id, source: 'portfolio', label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value };
}

function bundle(...records: EvidenceRecord[]): EvidenceBundle {
  return { gatheredAt: NOW, records };
}

function policyById(id: string) {
  const p = PORTFOLIO_POLICIES.find((x) => x.id === id);
  if (!p) throw new Error(`policy not found: ${id}`);
  return p;
}

describe('portfolioPolicies', () => {
  it('avoidOversaturation fires and warns once a category reaches the oversupply threshold', () => {
    const policy = policyById('portfolio.avoidOversaturation');
    const evidence = bundle(record('portfolio:categoryConcentration', { maxCategoryId: 'botanical', maxCount: 45, share: 0.45, total: 100, oversupplyShare: 0.4 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('diversifyPortfolio');
    expect(result.warning).toMatch(/botanical/);
  });

  it('avoidOversaturation does not fire below the oversupply threshold', () => {
    const policy = policyById('portfolio.avoidOversaturation');
    const evidence = bundle(record('portfolio:categoryConcentration', { maxCategoryId: 'botanical', maxCount: 20, share: 0.2, total: 100, oversupplyShare: 0.4 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(false);
  });

  it('preferMissingCategories recommends the least-covered category by name and count', () => {
    const policy = policyById('portfolio.preferMissingCategories');
    const evidence = bundle(record('portfolio:leastCoveredCategory', { categoryId: 'animal-print', count: 0 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('diversifyPortfolio');
    expect(result.detail).toMatch(/animal-print/);
  });

  it('preferMissingCategories does not fire without coverage data', () => {
    const policy = policyById('portfolio.preferMissingCategories');
    const result = policy.evaluate(bundle(), ctx());
    expect(result.applies).toBe(false);
  });

  it('preferCollectionDiversity recommends filling empty collections when any exist', () => {
    const policy = policyById('portfolio.preferCollectionDiversity');
    const evidence = bundle(record('collection:emptyCollections', { count: 3 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('fillEmptyCollections');
    expect(result.detail).toMatch(/3 collection/);
  });

  it('preferCollectionDiversity does not fire when no collections are empty', () => {
    const policy = policyById('portfolio.preferCollectionDiversity');
    const evidence = bundle(record('collection:emptyCollections', { count: 0 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(false);
  });

  it('declares the 3 policies named in the spec', () => {
    expect(PORTFOLIO_POLICIES.map((p) => p.id).sort()).toEqual(['portfolio.avoidOversaturation', 'portfolio.preferCollectionDiversity', 'portfolio.preferMissingCategories'].sort());
  });
});
