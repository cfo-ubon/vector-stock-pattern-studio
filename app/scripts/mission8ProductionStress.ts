#!/usr/bin/env -S npx tsx
// Mission 8 (Production Certification) — Part 2: Stress Test.
//
// Runs REAL production batches through the exact pipeline
// `ProductionHomeView.tsx`'s "Generate Now" handler uses (verbatim
// mirror of `handleGenerateNow`, read directly from that file, not
// reconstructed from memory): decisionEngine (selectEvidence +
// buildAutonomousDesignPlan) -> AutonomousDesignRun (create ->
// PLAN_READY) -> prepareRunForGeneration -> runAutonomousGeneration
// (real SVG generation + real QA scoring + real QualitySnapshot
// creation, per pattern) -> createFactoryBatch + expandFactoryBatchForAssets
// (real qa/repair/seo/package/exportValidation task graph) ->
// drainFactoryQueue. No synthetic shortcuts, no new business logic —
// this script only calls existing, already-shipped functions and
// measures them at scale.
//
// Usage: npx tsx scripts/mission8ProductionStress.ts [sizes...]
//   e.g. npx tsx scripts/mission8ProductionStress.ts 10 25 50

import 'fake-indexeddb/auto';

import { createFactoryBatch, expandFactoryBatchForAssets } from '../src/factory/batchController';
import { transitionFactoryTask } from '../src/factory/domain/factoryTask';
import { drainFactoryQueue } from '../src/factory/scheduler';
import { putFactoryTasks, loadFactoryTasks, clearFactoryQueueForTest } from '../src/factory/storage/factoryQueueStore';
import { clearFactoryTimelineForTest } from '../src/factory/storage/factoryTimelineStore';
import { clearFactorySchedulerStateForTest } from '../src/factory/storage/factorySchedulerStateStore';
import { clearPortfolioStores, loadPortfolioAssets } from '../src/catalog/storage/portfolioStore';
import { clearQualitySnapshots } from '../src/catalog/quality/qualitySnapshotStore';
import { clearCollectionsStore } from '../src/catalog/storage/collectionStore';
import { defaultParams } from '../src/engine/defaults';
import { selectEvidence, buildAutonomousDesignPlan, type DecisionEngineInput } from '../src/autopilot/decisionEngine';
import { emptyAutopilotConstraints } from '../src/autopilot/domain/constraints';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../src/autopilot/domain/autonomousDesignRun';
import { prepareRunForGeneration } from '../src/autopilot/runPreparation';
import { runAutonomousGeneration } from '../src/autopilot/generationOrchestrator';
import { putAutonomousDesignRun, clearAutonomousDesignRuns } from '../src/autopilot/storage/autonomousDesignRunStore';
import { putMarketingDesignHandoff } from '../src/design-director/storage/marketingDesignHandoffStore';
import { putCreativeBrief } from '../src/design-director/storage/creativeBriefStore';
import { putCollectionPlan } from '../src/design-director/storage/collectionPlanStore';
import type { FactoryTask } from '../src/factory/domain/types';

interface ScaleResult {
  count: number;
  generateMs: number;
  createdAssetIds: number;
  finalRunStatus: string;
  expandMs: number;
  drainMs: number;
  drainIterationsRan: number;
  statusCounts: Record<string, number>;
  blockedCount: number;
  exportValidationCompleted: number;
  exportValidationTotal: number;
  rssMB: number;
  heapUsedMB: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  crashed: boolean;
  error?: string;
}

async function resetAllStores(): Promise<void> {
  await clearPortfolioStores();
  await clearQualitySnapshots();
  await clearCollectionsStore();
  await clearFactoryQueueForTest();
  await clearFactoryTimelineForTest();
  await clearFactorySchedulerStateForTest();
  await clearAutonomousDesignRuns();
}

async function runScale(count: number): Promise<ScaleResult> {
  await resetAllStores();
  if (global.gc) global.gc();
  const cpuBefore = process.cpuUsage();
  const now = 1_700_000_000_000;

  try {
    const portfolioAssets = await loadPortfolioAssets();
    const input: DecisionEngineInput = {
      mode: 'EVERGREEN_COMMERCIAL',
      requestedCount: count,
      colorwayCount: 3,
      marketplacePreference: null,
      productionGoal: 'auto',
      constraints: emptyAutopilotConstraints(),
      opportunities: [],
      missions: [],
      seasonalEvents: [],
      portfolioAssets,
      offline: { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: '' },
      now,
    };
    const evidence = selectEvidence(input);
    const designPlan = buildAutonomousDesignPlan(input);

    let newRun = createAutonomousDesignRun({
      mode: 'EVERGREEN_COMMERCIAL',
      requestedCount: count,
      sourceEvidence: { marketOpportunityId: evidence.opportunity?.id ?? null, dailyMissionId: evidence.mission?.id ?? null, marketSnapshotId: null },
      constraints: emptyAutopilotConstraints(),
      now,
    });
    newRun = { ...newRun, designPlan };
    newRun = transitionAutonomousDesignRun(newRun, 'PLAN_READY', now, 'Design Plan approved (Mission 8 stress harness).');
    await putAutonomousDesignRun(newRun);

    const prepared = prepareRunForGeneration(newRun);
    await putAutonomousDesignRun(prepared.run);
    await putMarketingDesignHandoff(prepared.marketingHandoff);
    await putCreativeBrief(prepared.brief);
    await putCollectionPlan(prepared.collectionPlan);

    const existingAssets = await loadPortfolioAssets();
    const genStart = performance.now();
    const finalRun = await runAutonomousGeneration({
      run: prepared.run,
      brief: prepared.brief,
      plan: prepared.collectionPlan,
      opportunity: evidence.opportunity,
      existingAssets,
      persistRun: async (r) => {
        await putAutonomousDesignRun(r);
      },
    });
    const generateMs = performance.now() - genStart;

    if (finalRun.status !== 'COMPLETED') {
      const cpuAfter = process.cpuUsage(cpuBefore);
      const mem = process.memoryUsage();
      return {
        count,
        generateMs,
        createdAssetIds: 0,
        finalRunStatus: finalRun.status,
        expandMs: 0,
        drainMs: 0,
        drainIterationsRan: 0,
        statusCounts: {},
        blockedCount: 0,
        exportValidationCompleted: 0,
        exportValidationTotal: 0,
        rssMB: mem.rss / 1024 / 1024,
        heapUsedMB: mem.heapUsed / 1024 / 1024,
        cpuUserMs: cpuAfter.user / 1000,
        cpuSystemMs: cpuAfter.system / 1000,
        crashed: false,
        error: `Generation did not complete (status: ${finalRun.status})`,
      };
    }

    const createdAssetIds = finalRun.items.map((i) => i.portfolioAssetId).filter((id): id is string => id !== null);

    const batchNow = Date.now();
    const { batchId, generateTask } = createFactoryBatch({ count: createdAssetIds.length, params: defaultParams(), now: batchNow });
    const runningGenerateTask = transitionFactoryTask(generateTask, 'RUNNING', batchNow, 'stress run');
    const completedGenerateTask = transitionFactoryTask(runningGenerateTask, 'COMPLETED', batchNow, `Generated ${createdAssetIds.length} real pattern(s).`);

    const expandStart = performance.now();
    const perAssetTasks: FactoryTask[] = expandFactoryBatchForAssets({ generateTask: completedGenerateTask, createdAssetIds, targetMarketplace: evidence.marketplace, now: batchNow });
    const expandMs = performance.now() - expandStart;

    await putFactoryTasks([completedGenerateTask, ...perAssetTasks]);

    const drainStart = performance.now();
    const drainResult = await drainFactoryQueue(batchNow + 1000, 100000);
    const drainMs = performance.now() - drainStart;

    const finalTasks = await loadFactoryTasks();
    const batchTasks = finalTasks.filter((t) => t.batchId === batchId);
    const statusCounts: Record<string, number> = {};
    for (const t of batchTasks) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;

    const exportValidationTasks = batchTasks.filter((t) => t.type === 'exportValidation');
    const exportValidationCompleted = exportValidationTasks.filter((t) => t.status === 'COMPLETED').length;

    const cpuAfter = process.cpuUsage(cpuBefore);
    const mem = process.memoryUsage();

    return {
      count,
      generateMs,
      createdAssetIds: createdAssetIds.length,
      finalRunStatus: finalRun.status,
      expandMs,
      drainMs,
      drainIterationsRan: drainResult.ranTaskIds.length,
      statusCounts,
      blockedCount: batchTasks.filter((t) => t.status === 'BLOCKED').length,
      exportValidationCompleted,
      exportValidationTotal: exportValidationTasks.length,
      rssMB: mem.rss / 1024 / 1024,
      heapUsedMB: mem.heapUsed / 1024 / 1024,
      cpuUserMs: cpuAfter.user / 1000,
      cpuSystemMs: cpuAfter.system / 1000,
      crashed: false,
    };
  } catch (err) {
    const cpuAfter = process.cpuUsage(cpuBefore);
    const mem = process.memoryUsage();
    return {
      count,
      generateMs: -1,
      createdAssetIds: 0,
      finalRunStatus: 'ERROR',
      expandMs: -1,
      drainMs: -1,
      drainIterationsRan: 0,
      statusCounts: {},
      blockedCount: -1,
      exportValidationCompleted: 0,
      exportValidationTotal: 0,
      rssMB: mem.rss / 1024 / 1024,
      heapUsedMB: mem.heapUsed / 1024 / 1024,
      cpuUserMs: cpuAfter.user / 1000,
      cpuSystemMs: cpuAfter.system / 1000,
      crashed: true,
      error: err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
    };
  }
}

async function main(): Promise<void> {
  const argSizes = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const sizes = argSizes.length > 0 ? argSizes : [10, 25, 50, 100, 250, 500, 1000];

  console.log(`Mission 8 Part 2 — Production Batch Stress Test`);
  console.log(`Scales: ${sizes.join(', ')}`);
  console.log(`Node: ${process.version}, gc exposed: ${!!global.gc}\n`);

  const results: ScaleResult[] = [];
  for (const size of sizes) {
    console.log(`--- Running scale ${size} ---`);
    const wallStart = performance.now();
    const r = await runScale(size);
    const wallMs = performance.now() - wallStart;
    results.push(r);
    if (r.crashed) {
      console.log(`  CRASHED: ${r.error}`);
    } else {
      console.log(`  generate (runAutonomousGeneration): ${r.generateMs.toFixed(0)}ms -> run status ${r.finalRunStatus} (${r.createdAssetIds}/${size} assets created)`);
      if (r.error) console.log(`  NOTE: ${r.error}`);
      console.log(`  expand: ${r.expandMs.toFixed(0)}ms`);
      console.log(`  drain: ${r.drainMs.toFixed(0)}ms (${r.drainIterationsRan} tasks ran)`);
      console.log(`  wall total: ${wallMs.toFixed(0)}ms`);
      console.log(`  status counts: ${JSON.stringify(r.statusCounts)}`);
      console.log(`  exportValidation completed: ${r.exportValidationCompleted}/${r.exportValidationTotal}`);
      console.log(`  rss=${r.rssMB.toFixed(1)}MB heapUsed=${r.heapUsedMB.toFixed(1)}MB cpu(user+sys)=${(r.cpuUserMs + r.cpuSystemMs).toFixed(0)}ms`);
    }
    console.log('');
  }

  console.log('\n=== Summary (measured, not estimated) ===');
  console.log('count\tgenMs\texpandMs\tdrainMs\ttotalMs\tmsPerPattern\trssMB\theapMB\tcpuMs\texportOK/exportTotal\tblocked');
  for (const r of results) {
    const totalMs = r.crashed ? -1 : r.generateMs + r.expandMs + r.drainMs;
    console.log(
      `${r.count}\t${r.generateMs.toFixed(0)}\t${r.expandMs.toFixed(0)}\t${r.drainMs.toFixed(0)}\t${totalMs.toFixed(0)}\t${r.crashed ? 'N/A' : (totalMs / r.count).toFixed(1)}\t${r.rssMB.toFixed(1)}\t${r.heapUsedMB.toFixed(1)}\t${(r.cpuUserMs + r.cpuSystemMs).toFixed(0)}\t${r.exportValidationCompleted}/${r.exportValidationTotal}\t${r.blockedCount}`,
    );
  }

  const crashedAny = results.some((r) => r.crashed);
  await import('node:fs').then((fs) => {
    fs.mkdirSync('validation-results/mission8', { recursive: true });
    fs.writeFileSync('validation-results/mission8/productionStress.json', JSON.stringify(results, null, 2));
  });
  console.log('\nWrote validation-results/mission8/productionStress.json');
  if (crashedAny) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
