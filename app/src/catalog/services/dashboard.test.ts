import { describe, it, expect } from 'vitest';
import { computeDashboardSummary } from './dashboard';
import { computeHealthReport } from './healthCheck';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';

function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const base = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  return { ...base, ...overrides };
}

describe('computeDashboardSummary', () => {
  it('counts assets by workflow status, active vs archived, from real data only', () => {
    const assets = [
      makeAsset({ workflowStatus: 'DRAFT' }),
      makeAsset({ workflowStatus: 'READY_FOR_REVIEW' }),
      makeAsset({ workflowStatus: 'READY_TO_UPLOAD' }),
      makeAsset({ workflowStatus: 'SUBMITTED' }),
      makeAsset({ workflowStatus: 'APPROVED' }),
      makeAsset({ workflowStatus: 'REJECTED' }),
      makeAsset({ isArchived: true }),
    ];
    const health = computeHealthReport(assets, []);
    const summary = computeDashboardSummary(assets, health);
    expect(summary.totalAssets).toBe(7);
    expect(summary.activeAssets).toBe(6);
    expect(summary.archivedAssets).toBe(1);
    expect(summary.readyForReview).toBe(1);
    expect(summary.readyToUpload).toBe(1);
    expect(summary.submitted).toBe(1);
    expect(summary.approved).toBe(1);
    expect(summary.rejected).toBe(1);
  });

  it('reports missingPreview count from the health report, not guessed', () => {
    const assets = [makeAsset({ previewReference: null }), makeAsset({ previewReference: 'f1' })];
    const health = computeHealthReport(assets, []);
    const summary = computeDashboardSummary(assets, health);
    expect(summary.missingPreview).toBe(1);
  });

  it('caps recentlyImported to the given limit, newest first', () => {
    const assets = [makeAsset({ importedAt: 1 }), makeAsset({ importedAt: 3 }), makeAsset({ importedAt: 2 })];
    const health = computeHealthReport(assets, []);
    const summary = computeDashboardSummary(assets, health, 2);
    expect(summary.recentlyImported).toHaveLength(2);
    expect(summary.recentlyImported.map((a) => a.importedAt)).toEqual([3, 2]);
  });

  it('returns all zeros for an empty catalog', () => {
    const health = computeHealthReport([], []);
    const summary = computeDashboardSummary([], health);
    expect(summary.totalAssets).toBe(0);
    expect(summary.recentlyImported).toHaveLength(0);
  });
});
