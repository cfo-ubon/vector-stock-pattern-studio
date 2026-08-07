import { describe, it, expect } from 'vitest';
import { checkCollectionCompleteness } from './collectionCompleteness';
import { createCollection } from '../catalog/domain/collection';
import { createPortfolioAsset } from '../catalog/domain/asset';
import type { PortfolioAsset } from '../catalog/domain/types';

function makeAsset(tags: string[]): PortfolioAsset {
  const asset = createPortfolioAsset({ displayName: 'Asset', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  return { ...asset, tags };
}

describe('checkCollectionCompleteness', () => {
  it('reports roleTrackingAvailable=false (not a fabricated incomplete/complete verdict) when no member is tagged with a role', () => {
    const collection = createCollection({ name: 'Untagged Collection', now: 1000 });
    const report = checkCollectionCompleteness(collection, [makeAsset([]), makeAsset(['blue'])]);
    expect(report.roleTrackingAvailable).toBe(false);
    expect(report.complete).toBe(false);
    expect(report.explanation).toContain('Role tracking not available');
  });

  it('reports an empty collection honestly', () => {
    const collection = createCollection({ name: 'Empty', now: 1000 });
    const report = checkCollectionCompleteness(collection, []);
    expect(report.roleTrackingAvailable).toBe(false);
    expect(report.memberCount).toBe(0);
    expect(report.explanation).toContain('empty');
  });

  it('is complete when every one of the 7 roles is represented via tags', () => {
    const collection = createCollection({ name: 'Full Collection', now: 1000 });
    const members = ['hero', 'secondary', 'blender', 'coordinate', 'stripe', 'texture', 'colorway'].map((role) => makeAsset([role]));
    const report = checkCollectionCompleteness(collection, members);
    expect(report.roleTrackingAvailable).toBe(true);
    expect(report.complete).toBe(true);
    expect(report.missingRoles).toEqual([]);
  });

  it('lists exactly which roles are missing when partially tagged', () => {
    const collection = createCollection({ name: 'Partial Collection', now: 1000 });
    const members = [makeAsset(['hero']), makeAsset(['secondary'])];
    const report = checkCollectionCompleteness(collection, members);
    expect(report.roleTrackingAvailable).toBe(true);
    expect(report.complete).toBe(false);
    expect(report.missingRoles).toEqual(['blender', 'coordinate', 'stripe', 'texture', 'colorway']);
    expect(report.explanation).toContain('Collection not commercially complete');
  });
});
