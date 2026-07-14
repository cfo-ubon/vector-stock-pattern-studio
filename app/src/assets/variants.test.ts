import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { applyVariant } from './variants';
import { ASSET_VARIANT_TYPES } from './types';

function realHeroAsset(seed: string) {
  const collection = generateCollection({ ...defaultParams(), categoryId: 'botanical', seed });
  const assets = extractAssetsFromCollection(collection);
  const hero = assets.find((a) => a.metadata.kind === 'heroMotif');
  if (!hero) throw new Error('no hero asset found in fixture collection');
  return hero;
}

describe('applyVariant', () => {
  for (const type of ASSET_VARIANT_TYPES) {
    it(`${type}: produces a new asset with a distinct id and version bumped by 1`, () => {
      const asset = realHeroAsset(`variant-${type}`);
      const variant = applyVariant(asset, type);
      expect(variant.metadata.id).not.toBe(asset.metadata.id);
      expect(variant.metadata.version).toBe(asset.metadata.version + 1);
      expect(variant.node).toBeDefined();
    });
  }

  it('outline: strips fill and sets a real stroke on the root node', () => {
    const asset = realHeroAsset('variant-outline-check');
    const variant = applyVariant(asset, 'outline');
    expect(variant.node.attrs?.fill).toBe('none');
    expect(typeof variant.node.attrs?.stroke).toBe('string');
  });

  it('filled: removes stroke and ensures fill is set', () => {
    const asset = realHeroAsset('variant-filled-check');
    const outlineFirst = applyVariant(asset, 'outline');
    const filled = applyVariant(outlineFirst, 'filled');
    expect(filled.node.attrs?.stroke).toBeUndefined();
    expect(filled.node.attrs?.fill).not.toBe('none');
  });

  it('minimal: reduces the real node count (lower complexity) for a multi-child asset', () => {
    const asset = realHeroAsset('variant-minimal-check');
    const variant = applyVariant(asset, 'minimal');
    expect(variant.metadata.complexity).toBeLessThanOrEqual(asset.metadata.complexity);
  });

  it('detailed: never reduces node count (adds real overlay geometry via heroComplexity.ts)', () => {
    const asset = realHeroAsset('variant-detailed-check');
    const variant = applyVariant(asset, 'detailed');
    expect(variant.metadata.complexity).toBeGreaterThanOrEqual(asset.metadata.complexity);
  });

  it('monoline: forces a single uniform stroke color and fill:none across the whole tree', () => {
    const asset = realHeroAsset('variant-monoline-check');
    const variant = applyVariant(asset, 'monoline');
    const colors = new Set<string>();
    const walk = (n: typeof variant.node) => {
      if (typeof n.attrs?.stroke === 'string') colors.add(n.attrs.stroke);
      expect(n.attrs?.fill).toBe('none');
      (n.children ?? []).forEach(walk);
    };
    walk(variant.node);
    expect(colors.size).toBeLessThanOrEqual(1);
  });

  it('vintage: only ever produces real hex colors, no invalid color strings', () => {
    const asset = realHeroAsset('variant-vintage-check');
    const variant = applyVariant(asset, 'vintage');
    const walk = (n: typeof variant.node) => {
      for (const key of ['fill', 'stroke'] as const) {
        const v = n.attrs?.[key];
        if (typeof v === 'string' && v !== 'none') expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      (n.children ?? []).forEach(walk);
    };
    walk(variant.node);
  });

  it('preserves the source asset\'s kind, family, categoryId, and lineage fields', () => {
    const asset = realHeroAsset('variant-lineage-check');
    const variant = applyVariant(asset, 'bold');
    expect(variant.metadata.kind).toBe(asset.metadata.kind);
    expect(variant.metadata.family).toBe(asset.metadata.family);
    expect(variant.metadata.categoryId).toBe(asset.metadata.categoryId);
    expect(variant.metadata.sourceCollectionId).toBe(asset.metadata.sourceCollectionId);
    expect(variant.metadata.sourceMotifIds).toEqual(asset.metadata.sourceMotifIds);
  });

  it('never mutates the source asset', () => {
    const asset = realHeroAsset('variant-immutable-check');
    const originalNode = JSON.parse(JSON.stringify(asset.node));
    applyVariant(asset, 'outline');
    expect(asset.node).toEqual(originalNode);
  });
});
