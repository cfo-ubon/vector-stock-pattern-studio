import { describe, it, expect } from 'vitest';
import { explainBusinessOutcomeChange, sortBusinessOutcomeHistory } from './businessOutcomeEvolution';
import type { BusinessOutcomeScore } from '../factoryIntelligence/domain/types';

function score(overrides: Partial<BusinessOutcomeScore>): BusinessOutcomeScore {
  return {
    id: 'FBOS-1',
    score: 50,
    components: [{ name: 'factoryEfficiency', value: 50, weight: 0.25, contribution: 12.5 }],
    explanation: [],
    createdAt: 1000,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('explainBusinessOutcomeChange', () => {
  it('reports UNKNOWN delta (never fabricated) when either score is null', () => {
    const result = explainBusinessOutcomeChange(score({ score: null }), score({ score: 60 }));
    expect(result.scoreDelta).toBeNull();
    expect(result.explanation[0]).toContain('Cannot compute');
  });

  it('computes a real delta and names the top real movers', () => {
    const previous = score({ score: 40, components: [{ name: 'factoryEfficiency', value: 40, weight: 0.25, contribution: 10 }] });
    const current = score({ score: 70, components: [{ name: 'factoryEfficiency', value: 90, weight: 0.25, contribution: 22.5 }] });
    const result = explainBusinessOutcomeChange(previous, current);
    expect(result.scoreDelta).toBe(30);
    expect(result.explanation.some((e) => e.includes('factoryEfficiency'))).toBe(true);
  });

  it('explains a component that newly gained real data', () => {
    const previous = score({ components: [{ name: 'commercialReadiness', value: null, weight: 0.2, contribution: null }] });
    const current = score({ components: [{ name: 'commercialReadiness', value: 80, weight: 0.2, contribution: 16 }] });
    const result = explainBusinessOutcomeChange(previous, current);
    expect(result.explanation.some((e) => e.includes('now has real data for the first time'))).toBe(true);
  });
});

describe('sortBusinessOutcomeHistory', () => {
  it('sorts oldest first', () => {
    const sorted = sortBusinessOutcomeHistory([score({ id: 'B', createdAt: 2000 }), score({ id: 'A', createdAt: 1000 })]);
    expect(sorted.map((s) => s.id)).toEqual(['A', 'B']);
  });
});
