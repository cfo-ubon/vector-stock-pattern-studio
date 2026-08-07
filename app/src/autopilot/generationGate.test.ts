import { describe, it, expect } from 'vitest';
import { evaluateGenerationGate } from './generationGate';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { createAutonomousDesignRun } from './domain/autonomousDesignRun';

const NOW = 1_700_000_000_000;

describe('evaluateGenerationGate', () => {
  it('recommends generate when there is no unfinished work and no repair backlog', () => {
    const result = evaluateGenerationGate([], [], [], NOW);
    expect(result.recommendGenerate).toBe(true);
    expect(result.action).toBe('generate');
  });

  it('Build 031B Hardening — recommends resuming existing work over generating when a run is interrupted', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: NOW - 1000 });
    run = { ...run, status: 'PAUSED' };
    const result = evaluateGenerationGate([], [], [run], NOW);
    expect(result.recommendGenerate).toBe(false);
    expect(result.action).toBe('resumeExistingWork');
    expect(result.decisionTrace.policyIds).toContain('factory.completeExistingWorkFirst');
  });

  it('Build 031B Hardening — recommends resuming existing work when READY items are not yet imported', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 1, now: NOW - 1000 });
    run = { ...run, items: [{ collectionItemId: 'CI-1', generatorHandoffId: null, portfolioAssetId: null, qualitySnapshotId: null, decision: 'READY', repairAttempts: 0, error: null, completedAt: NOW - 500 }] };
    const result = evaluateGenerationGate([], [], [run], NOW);
    expect(result.recommendGenerate).toBe(false);
    expect(result.action).toBe('resumeExistingWork');
  });

  it('Build 031B Hardening — recommends repairing REVIEW/REJECT items over generating when no unfinished run exists', () => {
    const assets = Array.from({ length: 3 }, (_, i) => createPortfolioAsset({ displayName: `A${i}`, originalFilename: `a${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' }));
    const snapshots = assets.map((a, i) =>
      createQualitySnapshot({ assetId: a.assetId, beautyScore: 50, commercialScore: 50, fragmented: false, deadSpace: false, decision: i === 0 ? 'REJECT' : 'READY', generatorVersion: 'test', now: NOW - 1000 }),
    );
    const result = evaluateGenerationGate(assets, snapshots, [], NOW);
    expect(result.recommendGenerate).toBe(false);
    expect(result.action).toBe('repairExisting');
    expect(result.decisionTrace.policyIds).toContain('factory.repairBeforeGenerate');
  });

  it('unfinished work takes priority over a repair backlog (resumeExistingWork wins)', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: NOW - 1000 });
    run = { ...run, status: 'PAUSED' };
    const assets = [createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' })];
    const snapshots = [createQualitySnapshot({ assetId: assets[0].assetId, beautyScore: 50, commercialScore: 50, fragmented: false, deadSpace: false, decision: 'REJECT', generatorVersion: 'test', now: NOW - 1000 })];
    const result = evaluateGenerationGate(assets, snapshots, [run], NOW);
    expect(result.action).toBe('resumeExistingWork');
  });
});
