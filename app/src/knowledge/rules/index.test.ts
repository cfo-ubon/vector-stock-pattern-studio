import { describe, it, expect } from 'vitest';
import { REJECT_RULES, getHardNodeBudget, listStructuralChecks } from './index';

describe('knowledge/rules', () => {
  it('getHardNodeBudget returns the real threshold candidateEngine.ts enforces', () => {
    expect(getHardNodeBudget()).toBe(8000);
  });

  it('listStructuralChecks documents at least the 5 real checks applyHardRejectRules runs', () => {
    const ids = listStructuralChecks().map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(['emptyPattern', 'invalidGeometry', 'rasterImage', 'externalResourceRef', 'duplicateMotifIds', 'nodeBudgetExceeded']),
    );
  });

  it('REJECT_RULES has a schemaVersion', () => {
    expect(REJECT_RULES.schemaVersion).toBeGreaterThanOrEqual(1);
  });
});
