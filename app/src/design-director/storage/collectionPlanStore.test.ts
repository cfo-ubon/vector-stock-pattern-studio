import { describe, it, expect, beforeEach } from 'vitest';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';
import { loadCollectionPlans, getCollectionPlan, putCollectionPlan, deleteCollectionPlan, clearCollectionPlans } from './collectionPlanStore';

beforeEach(async () => {
  await clearCollectionPlans();
});

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

function makePlan() {
  return createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
}

describe('collectionPlanStore', () => {
  it('persists and retrieves a plan', async () => {
    const plan = makePlan();
    await putCollectionPlan(plan);
    expect(await getCollectionPlan(plan.id)).toEqual(plan);
  });

  it('deletes a plan', async () => {
    const plan = makePlan();
    await putCollectionPlan(plan);
    await deleteCollectionPlan(plan.id);
    expect(await getCollectionPlan(plan.id)).toBeUndefined();
  });

  it('loads all plans', async () => {
    await putCollectionPlan(makePlan());
    expect(await loadCollectionPlans()).toHaveLength(1);
  });
});
