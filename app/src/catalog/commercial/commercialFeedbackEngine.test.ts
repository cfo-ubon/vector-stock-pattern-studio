import { describe, it, expect } from 'vitest';
import {
  generateCommercialFeedback,
  MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE,
  MIN_SAMPLE_SIZE_HIGH_CONFIDENCE,
} from './commercialFeedbackEngine';
import { createPortfolioAsset } from '../domain/asset';
import { createSubmissionRecord } from './../submission/submissionRecord';
import { createSalesEvent } from '../submission/salesRevenue';
import { createRejectionRecord } from '../submission/rejectionIntelligence';
import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';

function makeAsset(overrides: Partial<Parameters<typeof createPortfolioAsset>[0]> = {}): PortfolioAsset {
  return createPortfolioAsset({
    displayName: 'Test Asset',
    originalFilename: 'test.svg',
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
    presetId: 'luxuryFloral',
    ...overrides,
  });
}

function decided(asset: PortfolioAsset, status: 'APPROVED' | 'REJECTED', marketplaceId = 'etsy'): SubmissionRecord {
  const record = createSubmissionRecord({ patternId: asset.assetId, marketplaceId });
  return { ...record, status };
}

describe('generateCommercialFeedback', () => {
  it('produces an empty report with null approval rate when there is no data', () => {
    const report = generateCommercialFeedback({ assets: [], submissions: [], salesEvents: [], rejectionRecords: [], now: 1000 });
    expect(report.portfolioDecidedCount).toBe(0);
    expect(report.portfolioApprovalRate).toBeNull();
    expect(report.dimensions).toEqual([]);
    expect(report.generatedAt).toBe(1000);
  });

  it('ignores submissions whose patternId does not match any known asset', () => {
    const report = generateCommercialFeedback({
      assets: [],
      submissions: [createSubmissionRecord({ patternId: 'orphan-pattern', marketplaceId: 'etsy' })],
      salesEvents: [],
      rejectionRecords: [],
    });
    expect(report.dimensions).toEqual([]);
  });

  it('caps confidence at low below the moderate threshold, even for a 100% approval rate', () => {
    const asset = makeAsset({ presetId: 'lowSampleStyle' });
    const submissions = [decided(asset, 'APPROVED'), decided(asset, 'APPROVED')];
    const report = generateCommercialFeedback({ assets: [asset], submissions, salesEvents: [], rejectionRecords: [] });
    const insight = report.dimensions.find((d) => d.value === 'lowSampleStyle')!;
    expect(insight.decidedCount).toBe(2);
    expect(insight.approvalRate).toBe(1);
    expect(insight.confidence).toBe('low');
    expect(insight.explanation).toContain('low confidence');
    expect(insight.explanation).toContain('hint, not a proven trend');
  });

  it('reports moderate confidence once decidedCount reaches the moderate threshold but stays below the high threshold', () => {
    const asset = makeAsset({ presetId: 'moderateStyle' });
    const submissions = Array.from({ length: MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE }, () => decided(asset, 'APPROVED'));
    const report = generateCommercialFeedback({ assets: [asset], submissions, salesEvents: [], rejectionRecords: [] });
    const insight = report.dimensions.find((d) => d.value === 'moderateStyle')!;
    expect(insight.decidedCount).toBe(MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE);
    expect(insight.confidence).toBe('moderate');
    expect(insight.explanation).toContain('moderate confidence');
  });

  it('reports high confidence only once decidedCount reaches the high threshold', () => {
    const asset = makeAsset({ presetId: 'highStyle' });
    const submissions = Array.from({ length: MIN_SAMPLE_SIZE_HIGH_CONFIDENCE }, (_, i) => decided(asset, i % 3 === 0 ? 'REJECTED' : 'APPROVED'));
    const report = generateCommercialFeedback({ assets: [asset], submissions, salesEvents: [], rejectionRecords: [] });
    const insight = report.dimensions.find((d) => d.value === 'highStyle')!;
    expect(insight.decidedCount).toBe(MIN_SAMPLE_SIZE_HIGH_CONFIDENCE);
    expect(insight.confidence).toBe('high');
    expect(insight.explanation).toContain('high confidence');
  });

  it('computes the portfolio-wide baseline approval rate across all decided submissions', () => {
    const assetA = makeAsset({ presetId: 'a' });
    const assetB = makeAsset({ presetId: 'b' });
    const submissions = [decided(assetA, 'APPROVED'), decided(assetA, 'REJECTED'), decided(assetB, 'APPROVED')];
    const report = generateCommercialFeedback({ assets: [assetA, assetB], submissions, salesEvents: [], rejectionRecords: [] });
    expect(report.portfolioDecidedCount).toBe(3);
    expect(report.portfolioApprovalRate).toBeCloseTo(2 / 3);
  });

  it('aggregates net revenue and downloads for a dimension value via productionAssetId', async () => {
    const asset = makeAsset({ presetId: 'revenueStyle', productionAssetId: 'PAID-xyz' });
    const submission = decided(asset, 'APPROVED');
    const sale1 = createSalesEvent({ productionAssetId: 'PAID-xyz', marketplaceId: 'etsy', date: 1000, downloads: 3, grossRevenue: 30, fees: 5 });
    const sale2 = createSalesEvent({ productionAssetId: 'PAID-xyz', marketplaceId: 'shutterstock', date: 2000, downloads: 2, grossRevenue: 10, fees: 1 });
    const report = generateCommercialFeedback({ assets: [asset], submissions: [submission], salesEvents: [sale1, sale2], rejectionRecords: [] });
    const insight = report.dimensions.find((d) => d.value === 'revenueStyle')!;
    expect(insight.downloads).toBe(5);
    expect(insight.netRevenue).toBe(34);
  });

  it('reports the top rejection categories for a dimension value, most frequent first, capped at 3', () => {
    const asset = makeAsset({ presetId: 'rejectedStyle' });
    const r1 = decided(asset, 'REJECTED');
    const r2 = decided(asset, 'REJECTED');
    const r3 = decided(asset, 'REJECTED');
    const rejections = [
      createRejectionRecord({ submissionId: r1.submissionId, marketplaceReasonText: 'duplicate of existing content' }),
      createRejectionRecord({ submissionId: r2.submissionId, marketplaceReasonText: 'duplicate submission' }),
      createRejectionRecord({ submissionId: r3.submissionId, marketplaceReasonText: 'trademark issue' }),
    ];
    const report = generateCommercialFeedback({ assets: [asset], submissions: [r1, r2, r3], salesEvents: [], rejectionRecords: rejections });
    const insight = report.dimensions.find((d) => d.value === 'rejectedStyle')!;
    expect(insight.topRejectionCategories[0]).toEqual({ category: 'duplicate-content', count: 2 });
    expect(insight.topRejectionCategories[1]).toEqual({ category: 'trademark', count: 1 });
  });

  it('produces insights across all four dimensions (presetId, styleDna, compositionType, patternType)', () => {
    const asset = makeAsset({ presetId: 'p1', styleDna: 'dna1', compositionType: 'bouquet', patternType: 'floral' });
    const submissions = [decided(asset, 'APPROVED')];
    const report = generateCommercialFeedback({ assets: [asset], submissions, salesEvents: [], rejectionRecords: [] });
    const dims = new Set(report.dimensions.map((d) => d.dimension));
    expect(dims).toEqual(new Set(['presetId', 'styleDna', 'compositionType', 'patternType']));
  });

  it('never mutates the input asset/submission arrays (never touches Beauty/Commercial Score fields)', () => {
    const asset = makeAsset({ presetId: 'immutableStyle' });
    const submission = decided(asset, 'APPROVED');
    const assetsCopy = JSON.parse(JSON.stringify(asset));
    const submissionsCopy = JSON.parse(JSON.stringify(submission));
    generateCommercialFeedback({ assets: [asset], submissions: [submission], salesEvents: [], rejectionRecords: [] });
    expect(asset).toEqual(assetsCopy);
    expect(submission).toEqual(submissionsCopy);
  });

  it('sorts dimension insights by decidedCount descending', () => {
    const smallAsset = makeAsset({ presetId: 'small' });
    const bigAsset = makeAsset({ presetId: 'big' });
    const submissions = [decided(smallAsset, 'APPROVED'), decided(bigAsset, 'APPROVED'), decided(bigAsset, 'REJECTED'), decided(bigAsset, 'APPROVED')];
    const report = generateCommercialFeedback({ assets: [smallAsset, bigAsset], submissions, salesEvents: [], rejectionRecords: [] });
    const presetInsights = report.dimensions.filter((d) => d.dimension === 'presetId');
    expect(presetInsights[0].value).toBe('big');
  });
});
