#!/usr/bin/env -S npx tsx
// Mission 8 — one-off probe (not part of the stress suite) to capture the
// exact `blockedReason` text on exportValidation tasks after a small real
// Generate Now run, so the certification report can cite the real safety-
// threshold gate output verbatim instead of guessing why export blocks.
import 'fake-indexeddb/auto';

import { createFactoryBatch, expandFactoryBatchForAssets } from '../src/factory/batchController';
import { transitionFactoryTask } from '../src/factory/domain/factoryTask';
import { drainFactoryQueue } from '../src/factory/scheduler';
import { putFactoryTasks, loadFactoryTasks } from '../src/factory/storage/factoryQueueStore';
import { loadPortfolioAssets } from '../src/catalog/storage/portfolioStore';
import { defaultParams } from '../src/engine/defaults';
import { selectEvidence, buildAutonomousDesignPlan, type DecisionEngineInput } from '../src/autopilot/decisionEngine';
import { emptyAutopilotConstraints } from '../src/autopilot/domain/constraints';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../src/autopilot/domain/autonomousDesignRun';
import { prepareRunForGeneration } from '../src/autopilot/runPreparation';
import { runAutonomousGeneration } from '../src/autopilot/generationOrchestrator';
import { putAutonomousDesignRun } from '../src/autopilot/storage/autonomousDesignRunStore';
import { putMarketingDesignHandoff } from '../src/design-director/storage/marketingDesignHandoffStore';
import { putCreativeBrief } from '../src/design-director/storage/creativeBriefStore';
import { putCollectionPlan } from '../src/design-director/storage/collectionPlanStore';
import { loadQualitySnapshots } from '../src/catalog/quality/qualitySnapshotStore';
import type { FactoryTask } from '../src/factory/domain/types';

async function main() {
  const count = 5;
  const now = 1_700_000_000_000;
  const portfolioAssets = await loadPortfolioAssets();
  const input: DecisionEngineInput = {
    mode: 'EVERGREEN_COMMERCIAL', requestedCount: count, colorwayCount: 3, marketplacePreference: null,
    productionGoal: 'auto', constraints: emptyAutopilotConstraints(), opportunities: [], missions: [], seasonalEvents: [],
    portfolioAssets, offline: { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: '' }, now,
  };
  const evidence = selectEvidence(input);
  const designPlan = buildAutonomousDesignPlan(input);
  let newRun = createAutonomousDesignRun({ mode: 'EVERGREEN_COMMERCIAL', requestedCount: count, sourceEvidence: { marketOpportunityId: null, dailyMissionId: null, marketSnapshotId: null }, constraints: emptyAutopilotConstraints(), now });
  newRun = { ...newRun, designPlan };
  newRun = transitionAutonomousDesignRun(newRun, 'PLAN_READY', now, 'probe');
  await putAutonomousDesignRun(newRun);
  const prepared = prepareRunForGeneration(newRun);
  await putAutonomousDesignRun(prepared.run);
  await putMarketingDesignHandoff(prepared.marketingHandoff);
  await putCreativeBrief(prepared.brief);
  await putCollectionPlan(prepared.collectionPlan);
  const existingAssets = await loadPortfolioAssets();
  const finalRun = await runAutonomousGeneration({ run: prepared.run, brief: prepared.brief, plan: prepared.collectionPlan, opportunity: evidence.opportunity, existingAssets, persistRun: async (r) => { await putAutonomousDesignRun(r); } });
  console.log('run status:', finalRun.status, 'ready:', finalRun.readyCount, 'review:', finalRun.reviewCount, 'reject:', finalRun.rejectCount);

  const snapshots = await loadQualitySnapshots();
  for (const s of snapshots) {
    console.log(`  snapshot ${s.assetId}: decision=${s.decision} beauty=${s.beautyScore} commercial=${s.commercialScore}`);
  }

  const createdAssetIds = finalRun.items.map((i) => i.portfolioAssetId).filter((id): id is string => id !== null);
  const batchNow = Date.now();
  const { batchId, generateTask } = createFactoryBatch({ count: createdAssetIds.length, params: defaultParams(), now: batchNow });
  const running = transitionFactoryTask(generateTask, 'RUNNING', batchNow, 'probe');
  const completed = transitionFactoryTask(running, 'COMPLETED', batchNow, 'probe generated');
  const perAssetTasks: FactoryTask[] = expandFactoryBatchForAssets({ generateTask: completed, createdAssetIds, targetMarketplace: evidence.marketplace, now: batchNow });
  await putFactoryTasks([completed, ...perAssetTasks]);
  await drainFactoryQueue(batchNow + 1000, 10000);

  const finalTasks = await loadFactoryTasks();
  const batchTasks = finalTasks.filter((t) => t.batchId === batchId);
  for (const t of batchTasks) {
    console.log(`  [${t.type}] ${t.assetId ?? ''} status=${t.status} reason=${t.blockedReason ?? ''}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
