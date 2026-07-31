import { describe, it, expect } from 'vitest';
import { buildAutopilotResultSummary } from './resultSummary';
import { createAutonomousDesignRun, type AutonomousDesignRun, type AutonomousRunItemState } from './domain/autonomousDesignRun';
import { createCollectionPlan, getCollectionPlanItems } from '../design-director/domain/collectionPlan';
import { emptyAutopilotConstraints } from './domain/constraints';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';

function makePlan() {
  return createCollectionPlan({
    briefId: 'BRF-1',
    name: 'Test',
    theme: 'geometric',
    totalSize: 3,
    patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
    now: 1000,
  });
}

function makeItem(overrides: Partial<AutonomousRunItemState>): AutonomousRunItemState {
  return {
    collectionItemId: 'CPI-1',
    generatorHandoffId: 'GH-1',
    portfolioAssetId: 'PA-1',
    qualitySnapshotId: null,
    decision: 'READY',
    repairAttempts: 1,
    error: null,
    completedAt: 1000,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<QualitySnapshot>): QualitySnapshot {
  return {
    snapshotId: 'QS-1',
    assetId: 'PA-1',
    productionAssetId: null,
    beautyScore: 80,
    commercialScore: 80,
    thumbnailScore: 80,
    fragmented: false,
    deadSpace: false,
    decision: 'READY',
    generatorVersion: 'v1',
    createdAt: 1000,
    schemaVersion: 1,
    ...overrides,
  };
}

function makeRun(items: AutonomousRunItemState[]): AutonomousDesignRun {
  let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 3, constraints: emptyAutopilotConstraints(), now: 1000 });
  run = { ...run, items, completedCount: items.length, readyCount: items.filter((i) => i.decision === 'READY').length, reviewCount: items.filter((i) => i.decision === 'REVIEW').length, rejectCount: items.filter((i) => i.decision === 'REJECT').length };
  return run;
}

describe('buildAutopilotResultSummary', () => {
  it('never drops a REJECT item from the summary — every generated item is represented', () => {
    const plan = makePlan();
    const items = getCollectionPlanItems(plan);
    const run = makeRun([
      makeItem({ collectionItemId: items[0].id, portfolioAssetId: 'PA-hero', decision: 'READY', qualitySnapshotId: 'QS-hero' }),
      makeItem({ collectionItemId: items[1].id, portfolioAssetId: 'PA-secondary', decision: 'REVIEW', qualitySnapshotId: 'QS-secondary' }),
      makeItem({ collectionItemId: items[2].id, portfolioAssetId: 'PA-blender', decision: 'REJECT', qualitySnapshotId: 'QS-blender' }),
    ]);
    const snapshots = [
      makeSnapshot({ snapshotId: 'QS-hero', assetId: 'PA-hero', commercialScore: 90 }),
      makeSnapshot({ snapshotId: 'QS-secondary', assetId: 'PA-secondary', commercialScore: 60, decision: 'REVIEW' }),
      makeSnapshot({ snapshotId: 'QS-blender', assetId: 'PA-blender', commercialScore: 20, decision: 'REJECT', fragmented: true }),
    ];

    const summary = buildAutopilotResultSummary(run, plan, snapshots);

    expect(summary.rejectAssetIds).toEqual(['PA-blender']);
    expect(summary.rejectionReasons).toHaveLength(1);
    expect(summary.rejectionReasons[0].reasons.length).toBeGreaterThan(0);
    expect(summary.bestReadyAssetIds).toEqual(['PA-hero']);
    expect(summary.recommendedSubmissionGroup).toEqual(['PA-hero']);
  });

  it('sorts bestReadyAssetIds best-first by commercial score when snapshots are supplied', () => {
    const plan = makePlan();
    const items = getCollectionPlanItems(plan);
    const run = makeRun([
      makeItem({ collectionItemId: items[0].id, portfolioAssetId: 'PA-weak', decision: 'READY', qualitySnapshotId: 'QS-weak' }),
      makeItem({ collectionItemId: items[1].id, portfolioAssetId: 'PA-strong', decision: 'READY', qualitySnapshotId: 'QS-strong' }),
    ]);
    const snapshots = [
      makeSnapshot({ snapshotId: 'QS-weak', assetId: 'PA-weak', commercialScore: 50 }),
      makeSnapshot({ snapshotId: 'QS-strong', assetId: 'PA-strong', commercialScore: 95 }),
    ];
    const summary = buildAutopilotResultSummary(run, plan, snapshots);
    expect(summary.bestReadyAssetIds).toEqual(['PA-strong', 'PA-weak']);
  });

  it('reports collection completeness by comparing planned vs generated counts per role', () => {
    const plan = makePlan();
    const items = getCollectionPlanItems(plan);
    const incompleteRun = makeRun([makeItem({ collectionItemId: items[0].id, portfolioAssetId: 'PA-hero', decision: 'READY' })]);
    const incomplete = buildAutopilotResultSummary(incompleteRun, plan);
    expect(incomplete.collectionComplete).toBe(false);

    const completeRun = makeRun(items.map((i, idx) => makeItem({ collectionItemId: i.id, portfolioAssetId: `PA-${idx}`, decision: 'READY' })));
    const complete = buildAutopilotResultSummary(completeRun, plan);
    expect(complete.collectionComplete).toBe(true);
  });

  it('sums repair attempts and counts items actually repaired (more than one attempt)', () => {
    const plan = makePlan();
    const items = getCollectionPlanItems(plan);
    const run = makeRun([
      makeItem({ collectionItemId: items[0].id, portfolioAssetId: 'PA-0', repairAttempts: 1 }),
      makeItem({ collectionItemId: items[1].id, portfolioAssetId: 'PA-1', repairAttempts: 3 }),
    ]);
    const summary = buildAutopilotResultSummary(run, plan);
    expect(summary.totalRepairAttempts).toBe(4);
    expect(summary.itemsRepaired).toBe(1);
  });
});
