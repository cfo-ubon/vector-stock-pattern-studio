import { describe, it, expect } from 'vitest';
import { findOpportunities } from './opportunityFinder';
import { createFactoryTask } from '../factory/domain/factoryTask';

describe('findOpportunities', () => {
  it('returns nothing when the queue has no READY work', () => {
    expect(findOpportunities([])).toEqual([]);
  });

  it('never recommends generate tasks, even when one is READY', () => {
    const generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    expect(findOpportunities([generate])).toEqual([]);
  });

  it('surfaces each opportunity type only from real READY tasks of that stage', () => {
    const seo = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: 1000 });
    const collection = createFactoryTask({ type: 'collectionCompletion', reason: 'y', collectionId: 'C-1', now: 1000 });
    const opportunities = findOpportunities([seo, collection]);
    expect(opportunities.map((o) => o.type).sort()).toEqual(['COMPLETE_COLLECTION', 'FINISH_SEO'].sort());
    expect(opportunities.find((o) => o.type === 'FINISH_SEO')!.taskIds).toEqual([seo.id]);
  });

  it('sorts opportunities by count descending', () => {
    const oneRepair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: 1000 });
    const twoSeo = [createFactoryTask({ type: 'seo', reason: 'y', assetId: 'B-1', now: 1000 }), createFactoryTask({ type: 'seo', reason: 'z', assetId: 'B-2', now: 1000 })];
    const opportunities = findOpportunities([oneRepair, ...twoSeo]);
    expect(opportunities[0].type).toBe('FINISH_SEO');
    expect(opportunities[0].count).toBe(2);
  });
});
