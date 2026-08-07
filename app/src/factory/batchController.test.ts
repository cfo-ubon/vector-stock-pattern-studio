import { describe, it, expect } from 'vitest';
import { createFactoryBatch, expandFactoryBatchForAssets } from './batchController';
import type { GenerateParams } from '../engine/types';

const PARAMS = {} as GenerateParams;

describe('createFactoryBatch', () => {
  it('creates exactly one generate task, READY (no dependencies), never auto-runnable by the Scheduler', () => {
    const { batchId, generateTask } = createFactoryBatch({ count: 30, params: PARAMS, now: 1000 });
    expect(generateTask.type).toBe('generate');
    expect(generateTask.status).toBe('READY');
    expect(generateTask.batchId).toBe(batchId);
    expect(generateTask.dependsOnTaskIds).toEqual([]);
  });

  it('scales estimatedWorkMinutes with the requested count', () => {
    const small = createFactoryBatch({ count: 10, params: PARAMS, now: 1000 });
    const large = createFactoryBatch({ count: 100, params: PARAMS, now: 1000 });
    expect(large.generateTask.estimatedWorkMinutes).toBeGreaterThan(small.generateTask.estimatedWorkMinutes);
  });
});

describe('expandFactoryBatchForAssets', () => {
  it('creates a qa/repair/seo/package/exportValidation chain per real asset, never guessing ahead for assets that do not exist', () => {
    const { generateTask } = createFactoryBatch({ count: 2, params: PARAMS, now: 1000 });
    const tasks = expandFactoryBatchForAssets({ generateTask, createdAssetIds: ['A-1', 'A-2'], targetMarketplace: 'shutterstock', now: 2000 });
    expect(tasks).toHaveLength(10);
    for (const assetId of ['A-1', 'A-2']) {
      const forAsset = tasks.filter((t) => t.assetId === assetId);
      expect(forAsset.map((t) => t.type).sort()).toEqual(['exportValidation', 'package', 'qa', 'repair', 'seo'].sort());
    }
  });

  it('wires real task-id edges: qa depends on generate, seo/repair depend on qa, package on seo, exportValidation on package', () => {
    const { generateTask } = createFactoryBatch({ count: 1, params: PARAMS, now: 1000 });
    const tasks = expandFactoryBatchForAssets({ generateTask, createdAssetIds: ['A-1'], targetMarketplace: 'shutterstock', now: 2000 });
    const byType = Object.fromEntries(tasks.map((t) => [t.type, t]));
    expect(byType.qa.dependsOnTaskIds).toEqual([generateTask.id]);
    expect(byType.repair.dependsOnTaskIds).toEqual([byType.qa.id]);
    expect(byType.seo.dependsOnTaskIds).toEqual([byType.qa.id]);
    expect(byType.package.dependsOnTaskIds).toEqual([byType.seo.id]);
    expect(byType.exportValidation.dependsOnTaskIds).toEqual([byType.package.id]);
  });

  it('every expanded task starts WAITING (it has a dependency)', () => {
    const { generateTask } = createFactoryBatch({ count: 1, params: PARAMS, now: 1000 });
    const tasks = expandFactoryBatchForAssets({ generateTask, createdAssetIds: ['A-1'], targetMarketplace: 'shutterstock', now: 2000 });
    expect(tasks.every((t) => t.status === 'WAITING')).toBe(true);
  });

  it('returns no tasks when no assets were created', () => {
    const { generateTask } = createFactoryBatch({ count: 1, params: PARAMS, now: 1000 });
    const tasks = expandFactoryBatchForAssets({ generateTask, createdAssetIds: [], targetMarketplace: 'shutterstock', now: 2000 });
    expect(tasks).toEqual([]);
  });
});
