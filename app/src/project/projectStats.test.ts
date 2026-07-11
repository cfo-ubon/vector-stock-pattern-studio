import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { createProject, addCollectionToProject, setCollectionUploadStatus } from './projectManager';
import { computeProjectStats, listProjectAssets } from './projectStats';

describe('projectStats: listProjectAssets', () => {
  it('is empty for a project with no collections', () => {
    expect(listProjectAssets(createProject('A'))).toEqual([]);
  });

  it('flattens every asset across every collection, tagged with its collection', () => {
    const p1 = addCollectionToProject(createProject('A'), generateCollection({ ...defaultParams(), seed: 'stats-assets-1' }));
    const p2 = addCollectionToProject(p1, generateCollection({ ...defaultParams(), seed: 'stats-assets-2' }));
    const assets = listProjectAssets(p2);
    expect(assets.length).toBe(p2.collections[0].collection.assets.length + p2.collections[1].collection.assets.length);
    const collectionIds = new Set(assets.map((a) => a.collectionId));
    expect(collectionIds.size).toBe(2);
  });
});

describe('projectStats: computeProjectStats', () => {
  it('reports zeroed/empty stats for a brand-new project', () => {
    const stats = computeProjectStats(createProject('A'));
    expect(stats.collectionsCount).toBe(0);
    expect(stats.assetsCount).toBe(0);
    expect(stats.svgCount).toBe(0);
    expect(stats.metadataStatus).toBe('missing');
    expect(stats.exportStatus).toBe('never');
    expect(stats.uploadStatus).toBe('noCollections');
  });

  it('reports real counts and complete metadata/exported status once a collection exists', () => {
    const p = addCollectionToProject(createProject('A'), generateCollection({ ...defaultParams(), seed: 'stats-real' }));
    const stats = computeProjectStats(p);
    expect(stats.collectionsCount).toBe(1);
    expect(stats.assetsCount).toBe(p.collections[0].collection.assets.length);
    expect(stats.svgCount).toBeGreaterThan(0);
    expect(stats.metadataStatus).toBe('complete');
    expect(stats.exportStatus).toBe('exported');
    expect(stats.uploadStatus).toBe('notStarted');
  });

  it('reflects upload status transitions (notStarted -> inProgress -> allReady)', () => {
    let p = addCollectionToProject(createProject('A'), generateCollection({ ...defaultParams(), seed: 'stats-upload' }));
    const entryId = p.collections[0].id;
    expect(computeProjectStats(p).uploadStatus).toBe('notStarted');

    p = setCollectionUploadStatus(p, entryId, 'adobestock', 'uploaded');
    expect(computeProjectStats(p).uploadStatus).toBe('inProgress');

    for (const site of ['shutterstock', 'freepik', 'creativefabrica', 'creativemarket', 'etsy'] as const) {
      p = setCollectionUploadStatus(p, entryId, site, 'ready');
    }
    expect(computeProjectStats(p).uploadStatus).toBe('allReady');
  });

  it('is fully deterministic for the same project data', () => {
    const p = addCollectionToProject(createProject('A'), generateCollection({ ...defaultParams(), seed: 'stats-det' }));
    expect(computeProjectStats(p)).toEqual(computeProjectStats(p));
  });
});
