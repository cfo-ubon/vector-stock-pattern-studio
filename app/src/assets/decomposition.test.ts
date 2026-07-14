import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { decomposeTileIntoAssets, decomposeAssetToSvg } from './decomposition';

function botanicalTile(seed: string) {
  return generateCollection({ ...defaultParams(), categoryId: 'botanical', seed }).patternTiles[0];
}

describe('decomposeTileIntoAssets', () => {
  it('extracts a real, non-empty asset per motif placement group in the tile', () => {
    const tile = botanicalTile('decompose-1');
    const assets = decomposeTileIntoAssets(tile, { sourceCollectionId: 'legacy-1' });
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset.node).toBeDefined();
      expect(asset.metadata.sourceCollectionId).toBe('legacy-1');
    }
  });

  it('tags family from the real category, not a placeholder', () => {
    const tile = botanicalTile('decompose-2');
    const assets = decomposeTileIntoAssets(tile, { sourceCollectionId: 'legacy-2' });
    for (const asset of assets) expect(asset.metadata.family).toBe('flower');
  });

  it('only extracts colors the geometry actually references', () => {
    const tile = botanicalTile('decompose-3');
    const assets = decomposeTileIntoAssets(tile, { sourceCollectionId: 'legacy-3' });
    for (const asset of assets) {
      for (const c of asset.metadata.colorRoles) expect(tile.colors.map((x) => x.toLowerCase())).toContain(c.toLowerCase());
    }
  });

  it('is deterministic for the same tile', () => {
    const tile = botanicalTile('decompose-4');
    const a = decomposeTileIntoAssets(tile, { sourceCollectionId: 'legacy-4' });
    const b = decomposeTileIntoAssets(tile, { sourceCollectionId: 'legacy-4' });
    expect(a.map((x) => x.metadata.id)).toEqual(b.map((x) => x.metadata.id));
    expect(a.map((x) => x.node)).toEqual(b.map((x) => x.node));
  });
});

describe('decomposeAssetToSvg', () => {
  it('produces a real, complete, editable standalone SVG document — never rasterized', () => {
    const collection = generateCollection({ ...defaultParams(), categoryId: 'botanical', seed: 'decompose-svg-1' });
    const [asset] = extractAssetsFromCollection(collection);
    const svg = decomposeAssetToSvg(asset);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
    expect(svg).not.toContain('<image');
    expect(svg).not.toMatch(/data:image/);
  });
});
