import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { MARKETPLACE_LIST } from './marketplaceProfiles';
import { generateMarketplaceSeo, generateAllMarketplaceSeo } from './marketplaceSeo';

function makeTileData(seed: string) {
  return buildTile({ ...defaultParams(), categoryId: 'botanical', paletteId: 'jewel-tones', seed });
}

describe('marketplaceSeo: SEO generation', () => {
  it('generates a non-empty title, filename, and at least one keyword for every marketplace', () => {
    const tileData = makeTileData('seo-basic');
    for (const profile of MARKETPLACE_LIST) {
      const seo = generateMarketplaceSeo(tileData, profile.id);
      expect(seo.title.length, `${profile.id} title`).toBeGreaterThan(0);
      expect(seo.filename.length, `${profile.id} filename`).toBeGreaterThan(0);
      expect(seo.keywords.length, `${profile.id} keywords`).toBeGreaterThan(0);
    }
  });

  it('respects each marketplace\'s own description requirement (Adobe/Freepik have none)', () => {
    const tileData = makeTileData('seo-description');
    expect(generateMarketplaceSeo(tileData, 'adobestock').description).toBe('');
    expect(generateMarketplaceSeo(tileData, 'freepik').description).toBe('');
    expect(generateMarketplaceSeo(tileData, 'shutterstock').description.length).toBeGreaterThan(0);
    expect(generateMarketplaceSeo(tileData, 'creativefabrica').description.length).toBeGreaterThan(0);
    expect(generateMarketplaceSeo(tileData, 'etsy').description.length).toBeGreaterThan(0);
  });

  it('Etsy keywords never exceed 13 tags and each tag stays within 20 characters', () => {
    const tileData = makeTileData('seo-etsy-tags');
    const seo = generateMarketplaceSeo(tileData, 'etsy');
    expect(seo.keywords.length).toBeLessThanOrEqual(13);
    for (const k of seo.keywords) expect(k.length).toBeLessThanOrEqual(20);
  });

  it('is fully deterministic for the same tileData + marketplace', () => {
    const tileData = makeTileData('seo-det');
    const a = generateMarketplaceSeo(tileData, 'shutterstock');
    const b = generateMarketplaceSeo(tileData, 'shutterstock');
    expect(a).toEqual(b);
  });

  it('generateAllMarketplaceSeo covers every marketplace exactly once', () => {
    const tileData = makeTileData('seo-all');
    const all = generateAllMarketplaceSeo(tileData);
    expect(Object.keys(all).sort()).toEqual(MARKETPLACE_LIST.map((p) => p.id).sort());
  });

  it('a custom filename template only changes the filename, not the SEO text', () => {
    const tileData = makeTileData('seo-custom-filename');
    const withDefault = generateMarketplaceSeo(tileData, 'shutterstock');
    const withCustom = generateMarketplaceSeo(tileData, 'shutterstock', '{seed}-custom');
    expect(withCustom.filename).not.toBe(withDefault.filename);
    expect(withCustom.title).toBe(withDefault.title);
    expect(withCustom.keywords).toEqual(withDefault.keywords);
  });
});
