import { describe, it, expect } from 'vitest';
import {
  createCollectionPlan,
  isValidCollectionPlan,
  InvalidCollectionPlanInputError,
  getCollectionPlanItems,
  getCollectionPlanItemById,
  markCollectionPlanItemStatus,
  type PatternTypeCounts,
  type CollectionPlan,
} from './collectionPlan';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

describe('createCollectionPlan', () => {
  it('creates a well-shaped plan', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    expect(plan.briefId).toBe('BRF-1');
    expect(plan.colorwayCount).toBe(3);
    expect(isValidCollectionPlan(plan)).toBe(true);
  });

  it('rejects an empty briefId', () => {
    expect(() => createCollectionPlan({ briefId: '', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts })).toThrow(InvalidCollectionPlanInputError);
  });
});

// Build 028C, requirement #9 — individually-identified CollectionPlanItems.
describe('CollectionPlanItem support', () => {
  it('builds one real, individually-identified item per unit in patternTypeCounts', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const items = getCollectionPlanItems(plan);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(items).toHaveLength(total);
    expect(items.filter((i) => i.patternType === 'hero')).toHaveLength(counts.hero);
    // Every item has a real, unique id.
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    // Every item starts 'planned'.
    expect(items.every((i) => i.status === 'planned')).toBe(true);
  });

  it('getCollectionPlanItems safely returns [] for a pre-028C plan with no items array', () => {
    const modernPlan = createCollectionPlan({ briefId: 'BRF-1', name: 'Old', theme: 'x', totalSize: 1, patternTypeCounts: counts, now: 1 });
    const oldShapedPlan: Partial<CollectionPlan> = { ...modernPlan };
    delete oldShapedPlan.items;
    expect(getCollectionPlanItems(oldShapedPlan as CollectionPlan)).toEqual([]);
  });

  it('getCollectionPlanItemById finds a real item and returns null for an unknown id', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const item = getCollectionPlanItems(plan)[0];
    expect(getCollectionPlanItemById(plan, item.id)).toEqual(item);
    expect(getCollectionPlanItemById(plan, 'CITEM-does-not-exist')).toBeNull();
  });

  it('markCollectionPlanItemStatus updates only the targeted item, leaving all others untouched', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const items = getCollectionPlanItems(plan);
    const target = items[0];
    const updated = markCollectionPlanItemStatus(plan, target.id, 'generated');
    const updatedItems = getCollectionPlanItems(updated);
    expect(updatedItems.find((i) => i.id === target.id)?.status).toBe('generated');
    expect(updatedItems.filter((i) => i.id !== target.id).every((i) => i.status === 'planned')).toBe(true);
  });
});
