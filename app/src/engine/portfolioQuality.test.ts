import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics } from './scoring';
import { computeBotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { computeIllustrationQuality, computeVisualRichness, computeSpeciesDiversity } from './portfolioQuality';
import { BOTANICAL_FAMILIES } from '../generators/botanicalFamilies';

describe('computeIllustrationQuality / computeVisualRichness (Build 005, Section 9)', () => {
  it('produces values in [0, 100] for a real tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'illustration-quality-range' });
    const botanical = computeBotanicalBeautyMetrics(tile, computeMetrics(tile));
    const iq = computeIllustrationQuality(botanical);
    const vr = computeVisualRichness(botanical);
    expect(iq).toBeGreaterThanOrEqual(0);
    expect(iq).toBeLessThanOrEqual(100);
    expect(vr).toBeGreaterThanOrEqual(0);
    expect(vr).toBeLessThanOrEqual(100);
  });

  it('illustrationQuality is exactly the average of botanicalRealism/botanicalComplexity/assetHarmony', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'illustration-quality-formula' });
    const botanical = computeBotanicalBeautyMetrics(tile, computeMetrics(tile));
    const expected = Math.round((botanical.botanicalRealism + botanical.botanicalComplexity + botanical.assetHarmony) / 3);
    expect(computeIllustrationQuality(botanical)).toBe(expected);
  });

  it('visualRichness is exactly the average of silhouetteBeauty/luxuryFeeling/organicFlow', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'visual-richness-formula' });
    const botanical = computeBotanicalBeautyMetrics(tile, computeMetrics(tile));
    const expected = Math.round((botanical.silhouetteBeauty + botanical.luxuryFeeling + botanical.organicFlow) / 3);
    expect(computeVisualRichness(botanical)).toBe(expected);
  });
});

describe('computeSpeciesDiversity (Build 005, Section 9)', () => {
  it('returns 0 for an empty or all-undefined list', () => {
    expect(computeSpeciesDiversity([])).toBe(0);
    expect(computeSpeciesDiversity([undefined, undefined])).toBe(0);
  });

  it('returns 100 when every real family is represented', () => {
    expect(computeSpeciesDiversity([...BOTANICAL_FAMILIES])).toBe(100);
  });

  it('returns a proportional fraction for a partial set, ignoring duplicates', () => {
    const families = [BOTANICAL_FAMILIES[0], BOTANICAL_FAMILIES[0], BOTANICAL_FAMILIES[1]];
    const expected = Math.round((2 / BOTANICAL_FAMILIES.length) * 100);
    expect(computeSpeciesDiversity(families)).toBe(expected);
  });

  it('ignores undefined entries mixed in with real families', () => {
    const withUndefined = computeSpeciesDiversity([BOTANICAL_FAMILIES[0], undefined, BOTANICAL_FAMILIES[1]]);
    const withoutUndefined = computeSpeciesDiversity([BOTANICAL_FAMILIES[0], BOTANICAL_FAMILIES[1]]);
    expect(withUndefined).toBe(withoutUndefined);
  });
});
