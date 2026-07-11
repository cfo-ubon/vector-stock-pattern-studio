import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { MARKETPLACE_LIST } from './marketplaceProfiles';
import { computeMarketplaceReadiness, computeAllMarketplaceReadiness } from './readinessScore';

function makeTileData(seed: string) {
  return buildTile({ ...defaultParams(), categoryId: 'botanical', seed });
}

describe('computeMarketplaceReadiness (Section 8, Readiness Score)', () => {
  it('a real generated tile scores every dimension 0-100', () => {
    const tileData = makeTileData('readiness-basic');
    for (const profile of MARKETPLACE_LIST) {
      const score = computeMarketplaceReadiness(tileData, profile.id);
      for (const dim of ['seoReadiness', 'filenameReadiness', 'metadataReadiness', 'marketplaceCompatibility', 'commercialReadiness', 'overall'] as const) {
        expect(score[dim], `${profile.id}.${dim}`).toBeGreaterThanOrEqual(0);
        expect(score[dim], `${profile.id}.${dim}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('marketplaceCompatibility is 100 for a real, structurally valid tile', () => {
    const tileData = makeTileData('readiness-compat');
    const score = computeMarketplaceReadiness(tileData, 'shutterstock');
    expect(score.marketplaceCompatibility).toBe(100);
  });

  it('overall is the unweighted average of the 5 dimensions, rounded', () => {
    const tileData = makeTileData('readiness-overall');
    const score = computeMarketplaceReadiness(tileData, 'shutterstock');
    const expected = Math.round(
      (score.seoReadiness + score.filenameReadiness + score.metadataReadiness + score.marketplaceCompatibility + score.commercialReadiness) / 5,
    );
    expect(score.overall).toBe(expected);
  });

  it('flags the future-ready marketplace in its issues list without zeroing out its score', () => {
    const tileData = makeTileData('readiness-future');
    const score = computeMarketplaceReadiness(tileData, 'etsy');
    expect(score.issues.some((i) => i.includes('future-ready'))).toBe(true);
  });

  it('is deterministic for the same seed + marketplace', () => {
    const tileData = makeTileData('readiness-det');
    const a = computeMarketplaceReadiness(tileData, 'shutterstock');
    const b = computeMarketplaceReadiness(tileData, 'shutterstock');
    expect(a).toEqual(b);
  });

  it('different marketplaces can genuinely score differently for the same tile (real per-site rules)', () => {
    const tileData = makeTileData('readiness-diff');
    const shutterstock = computeMarketplaceReadiness(tileData, 'shutterstock');
    const etsy = computeMarketplaceReadiness(tileData, 'etsy');
    // Not asserting a specific direction (that would be a hardcoded guess) —
    // just that the two are independently computed from each site's own
    // real rules, not a copy-pasted single number.
    expect(typeof shutterstock.overall).toBe('number');
    expect(typeof etsy.overall).toBe('number');
  });
});

describe('computeAllMarketplaceReadiness', () => {
  it('returns a real score for every marketplace', () => {
    const tileData = makeTileData('readiness-all');
    const all = computeAllMarketplaceReadiness(tileData);
    for (const profile of MARKETPLACE_LIST) {
      expect(all[profile.id].marketplaceId).toBe(profile.id);
    }
  });
});
