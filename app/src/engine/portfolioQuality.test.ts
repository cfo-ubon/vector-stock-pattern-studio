import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics } from './scoring';
import { computeBotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import {
  computeIllustrationQuality,
  computeVisualRichness,
  computeSpeciesDiversity,
  computeCompositionDiversity,
  computeClusterDiversity,
  computeHeroDiversity,
  computeHeroArchetypeDiversity,
  computeSignatureFingerprintDistinctness,
  computePortfolioConsistency,
  detectSequentialStyleDrift,
  type SignatureFingerprint,
  type PortfolioConsistencySample,
} from './portfolioQuality';
import { HERO_ARCHETYPE_POOL } from '../generators/premiumHero';
import { BOTANICAL_FAMILIES } from '../generators/botanicalFamilies';
import type { LayoutId } from './types';
import { STYLE_DNA_LIST, resolveStyleDna } from './styleDna';

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

describe('computeCompositionDiversity (Build 006, Section 9)', () => {
  it('returns 0 for an empty list or a zero total', () => {
    expect(computeCompositionDiversity([], 14)).toBe(0);
    expect(computeCompositionDiversity(['grid'], 0)).toBe(0);
  });

  it('returns 100 when every distinct layout in the total is used', () => {
    expect(computeCompositionDiversity(['grid', 'brick'], 2)).toBe(100);
  });

  it('ignores duplicates and returns a proportional fraction', () => {
    const layouts: LayoutId[] = ['grid', 'grid', 'brick', 'radial'];
    expect(computeCompositionDiversity(layouts, 14)).toBe(Math.round((3 / 14) * 100));
  });
});

describe('computeClusterDiversity (Build 006, Section 9)', () => {
  it('returns 0 for an empty or all-undefined list', () => {
    expect(computeClusterDiversity([])).toBe(0);
    expect(computeClusterDiversity([undefined, undefined])).toBe(0);
  });

  it('returns 100 when species spanning all 3 illustration templates are used (statement/filler-companion/foliageOnly)', () => {
    // rose -> bouquet template (usesCalyx), a filler-role species -> spray,
    // a foliageOnly species -> branch -- real BOTANICAL_SPECIES roles.
    expect(computeClusterDiversity(['rose', 'cosmos', 'eucalyptus'])).toBe(100);
  });

  it('returns a proportional fraction for species that only ever resolve to 1 template', () => {
    // rose and peony are both bouquetRole "statement" -> both resolve to
    // the same 'bouquet' template.
    expect(computeClusterDiversity(['rose', 'peony'])).toBe(Math.round((1 / 3) * 100));
  });
});

describe('computeHeroDiversity (Build 006, Section 9)', () => {
  it('returns 0 for an empty or all-undefined list', () => {
    expect(computeHeroDiversity([])).toBe(0);
    expect(computeHeroDiversity([undefined])).toBe(0);
  });

  it('returns a proportional fraction based on distinct silhouettes, not distinct species', () => {
    // rose and ranunculus are both silhouette "layered" -- 2 species, 1 silhouette.
    expect(computeHeroDiversity(['rose', 'ranunculus'])).toBe(Math.round((1 / 8) * 100));
  });

  it('a wider silhouette spread scores higher than a narrow one for the same species count', () => {
    const narrow = computeHeroDiversity(['rose', 'ranunculus']); // both layered
    const wide = computeHeroDiversity(['rose', 'lavender']); // layered + spiky
    expect(wide).toBeGreaterThan(narrow);
  });
});

describe('computeHeroArchetypeDiversity (Build 009, Section 6: Silhouette Optimization)', () => {
  it('returns 0 for an empty list (nothing exercised, not "fully diverse")', () => {
    expect(computeHeroArchetypeDiversity([])).toBe(0);
  });

  it('returns 100 when every reachable archetype in HERO_ARCHETYPE_POOL is used', () => {
    expect(computeHeroArchetypeDiversity([...HERO_ARCHETYPE_POOL])).toBe(100);
  });

  it('ignores duplicates and returns a proportional fraction', () => {
    const archetypes = ['bouquet', 'bouquet', 'cascade'];
    expect(computeHeroArchetypeDiversity(archetypes)).toBe(Math.round((2 / HERO_ARCHETYPE_POOL.length) * 100));
  });

  it('a single repeated archetype scores the lowest non-zero fraction', () => {
    const oneOnly = computeHeroArchetypeDiversity(['bouquet', 'bouquet', 'bouquet']);
    const two = computeHeroArchetypeDiversity(['bouquet', 'cascade']);
    expect(oneOnly).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(oneOnly);
  });
});

describe('computeSignatureFingerprintDistinctness (Build 010, Section 9: Commercial Validation Suite)', () => {
  function fp(overrides: Partial<SignatureFingerprint> = {}): SignatureFingerprint {
    return { depthStrength: undefined, professionalRules: undefined, premiumRhythm: undefined, ...overrides };
  }

  it('returns 0 for fewer than 2 fingerprints', () => {
    expect(computeSignatureFingerprintDistinctness([])).toBe(0);
    expect(computeSignatureFingerprintDistinctness([fp()])).toBe(0);
  });

  it('returns 0 when every fingerprint is identical (the failure mode the audit warned against)', () => {
    const all = Array.from({ length: 15 }, () => fp());
    expect(computeSignatureFingerprintDistinctness(all)).toBe(0);
  });

  it('returns 100 when every pair of fingerprints differs', () => {
    const distinct = [
      fp({ depthStrength: 0.3, professionalRules: true, premiumRhythm: true }),
      fp({ depthStrength: undefined, professionalRules: undefined, premiumRhythm: undefined }),
      fp({ depthStrength: 0.1, professionalRules: false, premiumRhythm: false }),
    ];
    expect(computeSignatureFingerprintDistinctness(distinct)).toBe(100);
  });

  it('a mixed set (some distinct, some identical) scores strictly between 0 and 100', () => {
    const mixed = [
      fp({ depthStrength: 0.3, professionalRules: true, premiumRhythm: true }),
      fp({ depthStrength: 0.3, professionalRules: true, premiumRhythm: true }),
      fp({ depthStrength: undefined, professionalRules: undefined, premiumRhythm: undefined }),
    ];
    const score = computeSignatureFingerprintDistinctness(mixed);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("the real 15 built-in Style DNA presets' resolved signatures score well above 0", () => {
    // Reuses this build's own real resolution logic (Section 8) rather than
    // hand-constructed fixtures, so this is a genuine end-to-end honesty
    // check, not just a unit test of the aggregator in isolation.
    const fingerprints = STYLE_DNA_LIST.map((dna) => {
      const patch = resolveStyleDna(dna, 'signature-fingerprint-real-check');
      return { depthStrength: patch.depthStrength, professionalRules: patch.professionalRules, premiumRhythm: patch.hierarchy?.premiumRhythm };
    });
    expect(computeSignatureFingerprintDistinctness(fingerprints)).toBeGreaterThan(0);
  });
});

describe('computePortfolioConsistency (Build 011, Section 8: Portfolio Consistency Engine)', () => {
  const sample = (overrides: Partial<PortfolioConsistencySample> = {}): PortfolioConsistencySample => ({
    absoluteCommercialQuality: 80,
    luxuryCompositionOverall: 75,
    luxuryFeeling: 70,
    ...overrides,
  });

  it('returns 100 for fewer than 2 samples (nothing to disagree with itself)', () => {
    expect(computePortfolioConsistency([])).toBe(100);
    expect(computePortfolioConsistency([sample()])).toBe(100);
  });

  it('scores identical samples at (or extremely near) 100', () => {
    const samples = Array.from({ length: 20 }, () => sample());
    expect(computePortfolioConsistency(samples)).toBeGreaterThanOrEqual(99);
  });

  it('scores a widely scattered set of samples lower than a tight set', () => {
    const tight = [sample({ absoluteCommercialQuality: 78 }), sample({ absoluteCommercialQuality: 80 }), sample({ absoluteCommercialQuality: 82 })];
    const scattered = [sample({ absoluteCommercialQuality: 20 }), sample({ absoluteCommercialQuality: 80 }), sample({ absoluteCommercialQuality: 140 })];
    expect(computePortfolioConsistency(scattered)).toBeLessThan(computePortfolioConsistency(tight));
  });

  it('every score is within [0, 100]', () => {
    const wild = [sample({ absoluteCommercialQuality: 1 }), sample({ absoluteCommercialQuality: 99, luxuryCompositionOverall: 1, luxuryFeeling: 99 }), sample({ absoluteCommercialQuality: 50 })];
    const score = computePortfolioConsistency(wild);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('folds in styleDnaConsistency as a second signal when supplied, lowering the score when drift-vs-intent is poor', () => {
    const samples = Array.from({ length: 5 }, () => sample());
    const withGoodDrift = samples.map((s) => ({ ...s, styleDnaConsistency: 95 }));
    const withPoorDrift = samples.map((s) => ({ ...s, styleDnaConsistency: 20 }));
    expect(computePortfolioConsistency(withPoorDrift)).toBeLessThan(computePortfolioConsistency(withGoodDrift));
  });

  it('is unaffected by styleDnaConsistency when omitted from every sample (no active Style DNA)', () => {
    const samples = [sample({ absoluteCommercialQuality: 70 }), sample({ absoluteCommercialQuality: 90 })];
    const withoutDrift = computePortfolioConsistency(samples);
    const withUndefinedDrift = computePortfolioConsistency(samples.map((s) => ({ ...s, styleDnaConsistency: undefined })));
    expect(withUndefinedDrift).toBe(withoutDrift);
  });
});

describe('detectSequentialStyleDrift (Build 011, Section 8: Portfolio Consistency Engine)', () => {
  it('reports no drift for fewer than 4 samples', () => {
    const result = detectSequentialStyleDrift([80, 82, 78]);
    expect(result.driftDetected).toBe(false);
    expect(result.driftMagnitude).toBe(0);
  });

  it('reports no drift when the sequence stays flat', () => {
    const flat = Array.from({ length: 20 }, () => 80);
    const result = detectSequentialStyleDrift(flat);
    expect(result.driftDetected).toBe(false);
    expect(result.driftMagnitude).toBe(0);
  });

  it('detects drift when the second half is meaningfully lower than the first', () => {
    const declining = [...Array(10).fill(90), ...Array(10).fill(60)];
    const result = detectSequentialStyleDrift(declining);
    expect(result.driftDetected).toBe(true);
    expect(result.firstHalfMean).toBeGreaterThan(result.secondHalfMean);
  });

  it('does not flag a small, ordinary fluctuation as drift', () => {
    const mild = [78, 81, 79, 82, 80, 79, 81, 80];
    const result = detectSequentialStyleDrift(mild);
    expect(result.driftDetected).toBe(false);
  });

  it('is order-dependent (reversing the sequence flips which half reads higher)', () => {
    const declining = [...Array(10).fill(90), ...Array(10).fill(60)];
    const rising = [...declining].reverse();
    const declineResult = detectSequentialStyleDrift(declining);
    const riseResult = detectSequentialStyleDrift(rising);
    expect(declineResult.firstHalfMean).toBeGreaterThan(declineResult.secondHalfMean);
    expect(riseResult.secondHalfMean).toBeGreaterThan(riseResult.firstHalfMean);
  });
});
