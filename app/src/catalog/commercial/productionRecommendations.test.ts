import { describe, it, expect } from 'vitest';
import { generateProductionRecommendations, DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET } from './productionRecommendations';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';
import type { CommercialFeedbackReport } from './commercialFeedbackEngine';

function makeAsset(overrides: Partial<Parameters<typeof createPortfolioAsset>[0]> = {}): PortfolioAsset {
  return createPortfolioAsset({
    displayName: 'Test Asset',
    originalFilename: 'test.svg',
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
    ...overrides,
  });
}

describe('generateProductionRecommendations', () => {
  it('recommends a never-generated preset with the highest gap score', () => {
    const existing = makeAsset({ presetId: 'existingStyle' });
    const report = generateProductionRecommendations({
      assets: [existing],
      availablePresetIds: ['existingStyle', 'neverGenerated'],
    });
    const never = report.recommendations.find((r) => r.presetId === 'neverGenerated')!;
    expect(never.existingAssetCount).toBe(0);
    expect(never.reason).toContain('no existing assets yet');
    expect(report.recommendations[0].presetId).toBe('neverGenerated');
  });

  it('excludes a preset that has reached the duplicate-risk limit', () => {
    const saturated = Array.from({ length: DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET }, () => makeAsset({ presetId: 'saturated' }));
    const report = generateProductionRecommendations({ assets: saturated, availablePresetIds: ['saturated', 'fresh'] });
    expect(report.excludedDueToDuplicateRisk).toContain('saturated');
    expect(report.recommendations.some((r) => r.presetId === 'saturated')).toBe(false);
    expect(report.recommendations.some((r) => r.presetId === 'fresh')).toBe(true);
  });

  it('respects a custom maxExistingAssetsPerPreset limit', () => {
    const assets = Array.from({ length: 3 }, () => makeAsset({ presetId: 'capped' }));
    const report = generateProductionRecommendations({ assets, availablePresetIds: ['capped'], maxExistingAssetsPerPreset: 3 });
    expect(report.excludedDueToDuplicateRisk).toContain('capped');
  });

  it('flags internal repetition when a preset has many assets sharing the same styleDna/compositionType/palette', () => {
    const repetitive = Array.from({ length: 8 }, () =>
      makeAsset({ presetId: 'repetitivePreset', styleDna: 'sameDna', compositionType: 'sameComposition', colorPalette: ['#fff', '#000'] }),
    );
    const report = generateProductionRecommendations({ assets: repetitive, availablePresetIds: ['repetitivePreset'] });
    const rec = report.recommendations.find((r) => r.presetId === 'repetitivePreset')!;
    expect(rec.distinctStyleDnaCount).toBe(1);
    expect(rec.distinctCompositionTypeCount).toBe(1);
    expect(rec.distinctPaletteCount).toBe(1);
    expect(rec.reason).toContain('repetitive across those dimensions');
  });

  it('counts distinct product targets across the flattened productTargets arrays', () => {
    const assets = [
      makeAsset({ presetId: 'multiTarget', productTargets: ['mug', 'tote-bag'] }),
      makeAsset({ presetId: 'multiTarget', productTargets: ['phone-case'] }),
    ];
    const report = generateProductionRecommendations({ assets, availablePresetIds: ['multiTarget'] });
    const rec = report.recommendations.find((r) => r.presetId === 'multiTarget')!;
    expect(rec.distinctProductTargetCount).toBe(3);
  });

  it('applies a commercial boost only when confidence is moderate or high', () => {
    const asset = makeAsset({ presetId: 'boostedPreset' });
    const feedbackHighConfidence: CommercialFeedbackReport = {
      generatedAt: 0,
      portfolioDecidedCount: 20,
      portfolioApprovalRate: 0.5,
      dimensions: [
        {
          dimension: 'presetId',
          value: 'boostedPreset',
          sampleSize: 12,
          decidedCount: 12,
          approvedCount: 11,
          rejectedCount: 1,
          approvalRate: 11 / 12,
          netRevenue: 0,
          downloads: 0,
          topRejectionCategories: [],
          confidence: 'high',
          explanation: 'test',
        },
      ],
    };
    const withBoost = generateProductionRecommendations({ assets: [asset], availablePresetIds: ['boostedPreset'], commercialFeedback: feedbackHighConfidence });
    const withoutBoost = generateProductionRecommendations({ assets: [asset], availablePresetIds: ['boostedPreset'] });
    const recWith = withBoost.recommendations.find((r) => r.presetId === 'boostedPreset')!;
    const recWithout = withoutBoost.recommendations.find((r) => r.presetId === 'boostedPreset')!;
    expect(recWith.score).toBeGreaterThan(recWithout.score);
    expect(recWith.commercialConfidence).toBe('high');
    expect(recWith.reason).toContain('weighted into this recommendation');
  });

  it('does NOT apply a commercial boost when confidence is low, even with a strong approval rate', () => {
    const asset = makeAsset({ presetId: 'unweightedPreset' });
    const lowConfidenceFeedback: CommercialFeedbackReport = {
      generatedAt: 0,
      portfolioDecidedCount: 2,
      portfolioApprovalRate: 1,
      dimensions: [
        {
          dimension: 'presetId',
          value: 'unweightedPreset',
          sampleSize: 2,
          decidedCount: 2,
          approvedCount: 2,
          rejectedCount: 0,
          approvalRate: 1,
          netRevenue: 0,
          downloads: 0,
          topRejectionCategories: [],
          confidence: 'low',
          explanation: 'test',
        },
      ],
    };
    const withLowConfidence = generateProductionRecommendations({ assets: [asset], availablePresetIds: ['unweightedPreset'], commercialFeedback: lowConfidenceFeedback });
    const withoutFeedback = generateProductionRecommendations({ assets: [asset], availablePresetIds: ['unweightedPreset'] });
    const recWith = withLowConfidence.recommendations.find((r) => r.presetId === 'unweightedPreset')!;
    const recWithout = withoutFeedback.recommendations.find((r) => r.presetId === 'unweightedPreset')!;
    expect(recWith.score).toBe(recWithout.score);
    expect(recWith.reason).toContain('NOT used to weight');
  });

  it('caps the returned list at maxRecommendations', () => {
    const report = generateProductionRecommendations({
      assets: [],
      availablePresetIds: ['a', 'b', 'c', 'd', 'e'],
      maxRecommendations: 2,
    });
    expect(report.recommendations).toHaveLength(2);
  });

  it('sorts recommendations by score descending', () => {
    const many = Array.from({ length: 6 }, () => makeAsset({ presetId: 'many' }));
    const report = generateProductionRecommendations({ assets: many, availablePresetIds: ['many', 'none'] });
    const scores = report.recommendations.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(report.recommendations[0].presetId).toBe('none');
  });
});
