import { describe, it, expect, beforeEach } from 'vitest';
import { promoteReadyToPortfolio, promoteAllToPortfolioWithStatus } from './portfolioPromotion';
import { createAutonomousDesignRun, type AutonomousDesignRun, type AutonomousRunItemState } from './domain/autonomousDesignRun';
import { emptyAutopilotConstraints } from './domain/constraints';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { putPortfolioAsset, getPortfolioAsset, clearPortfolioStores } from '../catalog/storage/portfolioStore';

beforeEach(async () => {
  await clearPortfolioStores();
});

async function seedAsset(assetId: string): Promise<string> {
  const asset = createPortfolioAsset({
    displayName: assetId,
    originalFilename: `${assetId}.svg`,
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
  });
  await putPortfolioAsset({ ...asset, assetId });
  return assetId;
}

function makeItem(overrides: Partial<AutonomousRunItemState>): AutonomousRunItemState {
  return {
    collectionItemId: 'CPI-1',
    generatorHandoffId: 'GH-1',
    portfolioAssetId: null,
    qualitySnapshotId: null,
    decision: null,
    repairAttempts: 1,
    error: null,
    completedAt: 1000,
    ...overrides,
  };
}

function makeRun(items: AutonomousRunItemState[]): AutonomousDesignRun {
  const run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: items.length, constraints: emptyAutopilotConstraints(), now: 1000 });
  return { ...run, items };
}

describe('promoteReadyToPortfolio', () => {
  it('promotes only READY items to READY_TO_UPLOAD, leaving REVIEW/REJECT untouched', async () => {
    await seedAsset('PA-ready');
    await seedAsset('PA-review');
    await seedAsset('PA-reject');
    const run = makeRun([
      makeItem({ portfolioAssetId: 'PA-ready', decision: 'READY' }),
      makeItem({ portfolioAssetId: 'PA-review', decision: 'REVIEW' }),
      makeItem({ portfolioAssetId: 'PA-reject', decision: 'REJECT' }),
    ]);

    const result = await promoteReadyToPortfolio(run);

    expect(result.promoted).toEqual(['PA-ready']);
    expect((await getPortfolioAsset('PA-ready'))!.workflowStatus).toBe('READY_TO_UPLOAD');
    expect((await getPortfolioAsset('PA-review'))!.workflowStatus).toBe('DRAFT');
    expect((await getPortfolioAsset('PA-reject'))!.workflowStatus).toBe('DRAFT');
  });
});

describe('promoteAllToPortfolioWithStatus', () => {
  it('promotes every item to its honest matching status — REJECT becomes REJECTED, never deleted', async () => {
    await seedAsset('PA-ready');
    await seedAsset('PA-review');
    await seedAsset('PA-reject');
    const run = makeRun([
      makeItem({ portfolioAssetId: 'PA-ready', decision: 'READY' }),
      makeItem({ portfolioAssetId: 'PA-review', decision: 'REVIEW' }),
      makeItem({ portfolioAssetId: 'PA-reject', decision: 'REJECT' }),
    ]);

    const result = await promoteAllToPortfolioWithStatus(run);

    expect(result.promoted).toHaveLength(3);
    expect((await getPortfolioAsset('PA-ready'))!.workflowStatus).toBe('READY_TO_UPLOAD');
    expect((await getPortfolioAsset('PA-review'))!.workflowStatus).toBe('READY_FOR_REVIEW');
    const rejected = await getPortfolioAsset('PA-reject');
    expect(rejected).toBeDefined();
    expect(rejected!.workflowStatus).toBe('REJECTED');
  });

  it('skips items with no portfolioAssetId or missing asset rather than throwing', async () => {
    const run = makeRun([makeItem({ portfolioAssetId: null, decision: null, error: 'import failed' })]);
    const result = await promoteAllToPortfolioWithStatus(run);
    expect(result.promoted).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});
