import { describe, it, expect } from 'vitest';
import { buildCollectionRolePlan, resolveCollectionRoleRatio } from './collectionRolePlanner';
import { COLLECTION_PATTERN_TYPE_VALUES } from '../design-director/domain/collectionPlan';

describe('resolveCollectionRoleRatio', () => {
  it('every ratio sums to 1', () => {
    for (const marketplace of ['Etsy', 'Shutterstock', 'Adobe Stock', 'Unknown Marketplace']) {
      const ratio = resolveCollectionRoleRatio({ marketplace, productionGoal: 'collection', totalSize: 20 });
      const sum = COLLECTION_PATTERN_TYPE_VALUES.reduce((s, t) => s + ratio[t], 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('a "single" production goal (or size <= 1) is 100% hero', () => {
    const ratio = resolveCollectionRoleRatio({ marketplace: 'Etsy', productionGoal: 'single', totalSize: 1 });
    expect(ratio.hero).toBe(1);
    for (const type of COLLECTION_PATTERN_TYPE_VALUES) {
      if (type !== 'hero') expect(ratio[type]).toBe(0);
    }
  });

  it('Shutterstock and Etsy produce genuinely different ratios (not one fixed default regardless of marketplace)', () => {
    const stock = resolveCollectionRoleRatio({ marketplace: 'Shutterstock', productionGoal: 'collection', totalSize: 20 });
    const etsy = resolveCollectionRoleRatio({ marketplace: 'Etsy', productionGoal: 'collection', totalSize: 20 });
    expect(stock.coordinate).not.toBeCloseTo(etsy.coordinate, 5);
  });
});

describe('buildCollectionRolePlan', () => {
  it('counts sum exactly to the requested total size', () => {
    const { counts } = buildCollectionRolePlan({ marketplace: 'Etsy', productionGoal: 'collection', totalSize: 20 });
    const sum = COLLECTION_PATTERN_TYPE_VALUES.reduce((s, t) => s + counts[t], 0);
    expect(sum).toBe(20);
  });

  it('does not generate 20 copies of a single role — real diversity across multiple roles for a real collection', () => {
    const { entries } = buildCollectionRolePlan({ marketplace: 'Etsy', productionGoal: 'collection', totalSize: 20 });
    expect(entries.length).toBeGreaterThan(1);
  });

  it('a single-pattern request produces one hero item, not a partial fractional split', () => {
    const { counts, entries } = buildCollectionRolePlan({ marketplace: 'Etsy', productionGoal: 'single', totalSize: 1 });
    expect(counts.hero).toBe(1);
    expect(entries).toEqual([{ role: 'hero', count: 1 }]);
  });
});
