#!/usr/bin/env -S npx tsx
// Mission 7 (Release Candidate / Production Hardening) — Parts 4, 6, 7.
// Real, measured performance numbers for the Production Experience Layer
// (Mission 6) at realistic and stress-test scale. No estimates — every
// number below is `performance.now()` around a real call into the real
// engine functions the app itself uses (`generateProductionDailyBrief`,
// `buildReviewWorkspaceItems`, `loadCommercialPipelineContext`,
// `buildExportReadinessDashboard`, `drainFactoryQueue`), run against an
// in-memory `fake-indexeddb` instance seeded with real domain records via
// the existing P2.5 dataset generator (never a second, ad hoc fixture
// builder).
//
// Usage: npx tsx scripts/mission7ProductionHardeningPerf.ts

import 'fake-indexeddb/auto';

import { generateDataset } from '../src/catalog/validation/datasetGenerator';
import type { DatasetGeneratorConfig } from '../src/catalog/validation/types';
import { putPortfolioAssetsBulk, clearPortfolioStores, loadPortfolioAssets } from '../src/catalog/storage/portfolioStore';
import { putQualitySnapshot, createQualitySnapshot, clearQualitySnapshots, loadQualitySnapshots } from '../src/catalog/quality/qualitySnapshotStore';
import { clearCollectionsStore } from '../src/catalog/storage/collectionStore';
import { clearFactoryQueueForTest, putFactoryTasks, loadFactoryTasks } from '../src/factory/storage/factoryQueueStore';
import { clearFactoryTimelineForTest, loadFactoryTimeline } from '../src/factory/storage/factoryTimelineStore';
import { clearFactorySchedulerStateForTest } from '../src/factory/storage/factorySchedulerStateStore';
import { createFactoryTask } from '../src/factory/domain/factoryTask';
import { drainFactoryQueue } from '../src/factory/scheduler';
import { computeFactoryHealth } from '../src/factory/factoryMetrics';
import { computeFactoryIntelligenceMetrics } from '../src/factoryIntelligence/metricsEngine';
import { loadCommercialPipelineContext } from '../src/commercial/loadCommercialPipelineContext';
import { buildExportReadinessDashboard } from '../src/commercial/exportReadinessDashboard';
import { buildReviewWorkspaceItems, countReviewWaiting } from '../src/productionExperience/reviewWorkspace';
import { generateProductionDailyBrief, checkContinueYesterday } from '../src/productionAutopilot';
import { clearOwnerDecisionRecordsForTest } from '../src/productionAutopilot/storage/ownerDecisionStore';
import { clearProductionSessionsForTest } from '../src/productionAutopilot/storage/productionSessionStore';
import { clearOrchestrationRunsForTest } from '../src/factoryOrchestrator/storage/orchestrationRunStore';
import { loadAutonomousDesignRuns } from '../src/autopilot/storage/autonomousDesignRunStore';

interface Timed {
  label: string;
  ms: number;
  extra?: string;
}

const results: Timed[] = [];

async function time<T>(label: string, fn: () => Promise<T> | T, extra?: (result: T) => string): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  results.push({ label, ms, extra: extra ? extra(result) : undefined });
  return result;
}

async function resetAllStores(): Promise<void> {
  await clearPortfolioStores();
  await clearQualitySnapshots();
  await clearCollectionsStore();
  await clearFactoryQueueForTest();
  await clearFactoryTimelineForTest();
  await clearFactorySchedulerStateForTest();
  await clearOwnerDecisionRecordsForTest();
  await clearProductionSessionsForTest();
  await clearOrchestrationRunsForTest();
}

function datasetConfig(assetCount: number, seed: string): DatasetGeneratorConfig {
  return {
    seed,
    preset: 'custom',
    assetCount,
    collectionCount: Math.max(1, Math.round(assetCount / 20)),
    avgMembershipsPerAsset: 1,
    archivedCollectionRatio: 0.05,
    emptyCollectionRatio: 0.1,
    collectionCoverRatio: 0.5,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    batchSize: 500,
    baseTimestamp: 1_700_000_000_000,
    blobSampleCount: 0,
  };
}

async function seedPortfolio(assetCount: number, seed: string): Promise<void> {
  if (assetCount === 0) return;
  const dataset = generateDataset(datasetConfig(assetCount, seed));
  await putPortfolioAssetsBulk(dataset.assets);
  let i = 0;
  for (const asset of dataset.assets) {
    const decision = i % 10 === 0 ? 'REVIEW' : i % 37 === 0 ? 'REJECT' : 'READY';
    const snapshot = createQualitySnapshot({
      assetId: asset.assetId,
      beautyScore: 70 + (i % 20),
      commercialScore: 70 + (i % 15),
      fragmented: i % 13 === 0,
      deadSpace: i % 17 === 0,
      decision,
      generatorVersion: 'v1',
      now: 1_700_000_000_000 + i,
    });
    await putQualitySnapshot(snapshot);
    i++;
  }
}

async function measurePortfolioScale(assetCount: number): Promise<void> {
  await resetAllStores();
  const seedMs = performance.now();
  await seedPortfolio(assetCount, `mission7-${assetCount}`);
  results.push({ label: `[seed] ${assetCount} portfolio assets + quality snapshots`, ms: performance.now() - seedMs });

  const assets = await time(`Load ${assetCount} portfolio assets (loadPortfolioAssets)`, () => loadPortfolioAssets());
  const snapshots = await time(`Load ${assetCount} quality snapshots (loadQualitySnapshots)`, () => loadQualitySnapshots());

  await time(`Review Workspace build (buildReviewWorkspaceItems) — ${assetCount} assets`, () => buildReviewWorkspaceItems(assets, snapshots), (r) => `${r.length} items`);
  await time(`Review Waiting count (countReviewWaiting) — ${assetCount} assets`, () => countReviewWaiting(assets, snapshots));

  const pipelineCtx = await time(`Export Preparation: loadCommercialPipelineContext — ${assetCount} assets`, () => loadCommercialPipelineContext());
  await time(`Export Preparation: buildExportReadinessDashboard — ${assetCount} assets`, () => buildExportReadinessDashboard(pipelineCtx.readinessReports), (r) => `${r.totalAssets} assets classified`);
}

async function measureQueueScale(taskCount: number): Promise<void> {
  await resetAllStores();
  const seedMs = performance.now();
  const tasks = Array.from({ length: taskCount }, (_, i) =>
    createFactoryTask({ type: 'qa', reason: `stress task ${i}`, assetId: `stress-asset-${i}`, now: 1_700_000_000_000 }),
  );
  await putFactoryTasks(tasks);
  results.push({ label: `[seed] ${taskCount} factory tasks (all READY qa, no deps)`, ms: performance.now() - seedMs });

  const loaded = await time(`Queue Build: loadFactoryTasks — ${taskCount} tasks`, () => loadFactoryTasks());
  const timeline = await time(`Timeline load — ${taskCount} tasks' worth of queue`, () => loadFactoryTimeline());
  await time(`Factory Health compute — ${taskCount} tasks`, () => computeFactoryHealth(loaded, timeline, 1_700_000_100_000));
  await time(`Factory Intelligence metrics — ${taskCount} tasks`, () => computeFactoryIntelligenceMetrics(loaded, timeline, 1_700_000_100_000));

  // Real qa executor needs a matching QualitySnapshot per asset to
  // succeed — seed those too so drainFactoryQueue does real completions,
  // not just fast synthetic failures (which would understate real cost).
  await clearQualitySnapshots();
  for (let i = 0; i < taskCount; i++) {
    await putQualitySnapshot(
      createQualitySnapshot({ assetId: `stress-asset-${i}`, beautyScore: 80, commercialScore: 80, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1', now: 1_700_000_000_000 }),
    );
  }
  const drainResult = await time(`Queue drain (drainFactoryQueue) — ${taskCount} READY qa tasks`, () => drainFactoryQueue(1_700_000_200_000), (r) => `${r.ranTaskIds.length} tasks ran`);
  if (drainResult.ranTaskIds.length !== taskCount) {
    console.warn(`  WARNING: expected ${taskCount} tasks to run, only ${drainResult.ranTaskIds.length} did.`);
  }
}

async function measureDailyBriefAndStartup(assetCount: number): Promise<void> {
  await resetAllStores();
  await seedPortfolio(assetCount, `mission7-brief-${assetCount}`);
  const tasks = Array.from({ length: 50 }, (_, i) => createFactoryTask({ type: 'qa', reason: `x`, assetId: `a-${i}`, now: 1_700_000_000_000 }));
  await putFactoryTasks(tasks);

  const startupStart = performance.now();
  const [loadedTasks, loadedTimeline, assets, snapshots, autoRuns] = await Promise.all([
    loadFactoryTasks(),
    loadFactoryTimeline(),
    loadPortfolioAssets(),
    loadQualitySnapshots(),
    loadAutonomousDesignRuns(),
  ]);
  const now = Date.now();
  generateProductionDailyBrief(loadedTasks, loadedTimeline, [], assets, snapshots, autoRuns, now);
  checkContinueYesterday(loadedTasks);
  const startupMs = performance.now() - startupStart;
  results.push({ label: `Startup equivalent (ProductionHomeView.reload parallel loads + Daily Brief) — ${assetCount} assets, 50 tasks`, ms: startupMs });
}

async function main(): Promise<void> {
  console.log('Mission 7 — Production Hardening: real measured performance\n');

  console.log('=== Part 4: Startup / Daily Brief ===');
  await measureDailyBriefAndStartup(0);
  await measureDailyBriefAndStartup(1000);

  console.log('=== Part 6: Portfolio Stress (1,000 / 5,000 / 10,000 packages) ===');
  for (const n of [1000, 5000, 10000]) {
    await measurePortfolioScale(n);
  }

  console.log('=== Part 7: Queue Stress (100 / 500 / 1,000 tasks) ===');
  for (const n of [100, 500, 1000]) {
    await measureQueueScale(n);
  }

  await resetAllStores();

  console.log('\n=== Results (measured, not estimated) ===\n');
  const memory = process.memoryUsage();
  for (const r of results) {
    console.log(`${r.ms.toFixed(1).padStart(10)} ms  ${r.label}${r.extra ? `  (${r.extra})` : ''}`);
  }
  console.log(`\nProcess memory at end of run: rss=${(memory.rss / 1024 / 1024).toFixed(1)}MB heapUsed=${(memory.heapUsed / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
