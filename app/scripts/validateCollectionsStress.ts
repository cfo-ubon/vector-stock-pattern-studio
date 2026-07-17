#!/usr/bin/env -S npx tsx
// Portfolio Manager P2.5 Sprint 2 — stress/soak/baseline-compare CLI.
//
// A separate orchestrator script from Sprint 1's
// `validateCollections.ts` (kept untouched) — both import the same
// shared `src/catalog/validation/` library; this file only adds the
// Sprint 2 soak/stress/consistency/baseline-comparison orchestration on
// top, per the brief's "extend, do not create a competing framework"
// (the framework being the validation *library*, not any one script).
//
// Usage:
//   tsx scripts/validateCollectionsStress.ts stress
//   tsx scripts/validateCollectionsStress.ts soak-smoke
//   tsx scripts/validateCollectionsStress.ts soak-30m
//   tsx scripts/validateCollectionsStress.ts soak-60m [--max-minutes=N]
//   tsx scripts/validateCollectionsStress.ts baseline-compare
import 'fake-indexeddb/auto';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  presetDatasetConfig,
  generateDataset,
  validateDatasetConfig,
  persistDataset,
  resetValidationDatabase,
  scanIntegrity,
  analyzeMemoryTrend,
  computeLatencyDrift,
  runStressPlan,
  runSoak,
  latencySeriesFor,
  captureConsistencySnapshot,
  diffConsistencySnapshots,
  compareBatchAgainstSprint1,
  toMarkdownComparisonTable,
  currentEnvironmentDescription,
  computeStats,
  SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME,
} from '../src/catalog/validation/index.js';
import type { SoakOperationSpec, SoakRunResult, SoakOperationName, SoakCancelSignal } from '../src/catalog/validation/soakRunner.js';
import type { CurrentMeasurement } from '../src/catalog/validation/baselinePolicy.js';
import { loadCollections, searchCollectionsByName } from '../src/catalog/storage/collectionStore.js';
import { loadPortfolioAssets } from '../src/catalog/storage/portfolioStore.js';
import {
  assignAssetsToCollections,
  removeAssetsFromCollections,
  getAssetsForCollection,
  createCollectionService,
  renameCollection,
  archiveCollection,
  unarchiveCollection,
  deleteCollectionSafely,
} from '../src/catalog/services/collectionService.js';
import { createRng, rngInt } from '../src/engine/rng.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'validation-results', 'collections');

function gitInfo(): { commit: string | null; branch: string | null } {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { commit, branch };
  } catch {
    return { commit: null, branch: null };
  }
}

function writeJson(label: string, data: unknown): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const p = path.join(OUTPUT_DIR, `${label}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

function writeText(label: string, ext: string, text: string): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const p = path.join(OUTPUT_DIR, `${label}.${ext}`);
  fs.writeFileSync(p, text);
  return p;
}

interface OperationPools {
  refresh: () => Promise<void>;
  activeCollectionIds: string[];
  allCollectionIds: string[];
  assetIds: string[];
}

function buildOperations(seed: string, pools: OperationPools): SoakOperationSpec[] {
  const rng = createRng(`${seed}-ops`);

  function pickCollectionId(): string | undefined {
    return pools.activeCollectionIds.length ? pools.activeCollectionIds[rngInt(rng, 0, pools.activeCollectionIds.length - 1)] : undefined;
  }
  function pickAssetSlice(n: number): string[] {
    if (pools.assetIds.length === 0) return [];
    const size = Math.min(n, pools.assetIds.length);
    const start = rngInt(rng, 0, Math.max(0, pools.assetIds.length - size));
    return pools.assetIds.slice(start, start + size);
  }

  return [
    { name: 'searchCollections', weight: 10, run: async () => { await searchCollectionsByName('Validation'); } },
    { name: 'filterActive', weight: 8, run: async () => { const all = await loadCollections(); return all.filter((c) => !c.isArchived).length; } },
    { name: 'filterArchived', weight: 8, run: async () => { const all = await loadCollections(); return all.filter((c) => c.isArchived).length; } },
    { name: 'openCollection', weight: 10, run: async () => { const id = pickCollectionId(); if (id) await getAssetsForCollection(id); } },
    {
      name: 'switchCollection',
      weight: 10,
      run: async () => {
        const a = pickCollectionId();
        const b = pickCollectionId();
        if (a) await getAssetsForCollection(a);
        if (b) await getAssetsForCollection(b);
      },
    },
    { name: 'retrieveMembers', weight: 6, run: async () => { const id = pickCollectionId(); if (id) await getAssetsForCollection(id); } },
    {
      name: 'bulkAssign',
      weight: 2,
      run: async () => {
        const id = pickCollectionId();
        const ids = pickAssetSlice(1000);
        if (id && ids.length) await assignAssetsToCollections(ids, [id]);
      },
    },
    {
      name: 'bulkRemove',
      weight: 2,
      run: async () => {
        const id = pickCollectionId();
        const ids = pickAssetSlice(1000);
        if (id && ids.length) await removeAssetsFromCollections(ids, [id]);
      },
    },
    { name: 'integrityScan', weight: 1, run: async () => { await scanIntegrity(); } },
    {
      name: 'tempCollectionCycle',
      weight: 3,
      run: async (ctx) => {
        // create -> rename -> archive -> unarchive -> delete, always
        // cleaned up within the same cycle (Section 4's "100
        // create/rename/archive/unarchive/delete temporary-collection
        // cycles" — these five steps are inherently sequential, so they
        // are bundled into one operation rather than five independently
        // randomly-orderable ones; see docs/portfolio/P2_5_SOAK_REPORT.md).
        const created = await createCollectionService({ name: `Stress Temp ${ctx.cycle}-${Date.now()}` });
        await renameCollection(created.id, `Stress Temp Renamed ${ctx.cycle}`);
        await archiveCollection(created.id);
        await unarchiveCollection(created.id);
        await deleteCollectionSafely(created.id);
      },
    },
  ];
}

async function makePools(): Promise<OperationPools> {
  const pools: OperationPools = { refresh: async () => {}, activeCollectionIds: [], allCollectionIds: [], assetIds: [] };
  pools.refresh = async () => {
    const [collections, assets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
    pools.allCollectionIds = collections.map((c) => c.id);
    pools.activeCollectionIds = collections.filter((c) => !c.isArchived).map((c) => c.id);
    pools.assetIds = assets.map((a) => a.assetId);
  };
  await pools.refresh();
  return pools;
}

function datasetIdentityFor(preset: string, assetCount: number, collectionCount: number): string {
  return `${preset}-${assetCount}x${collectionCount}`;
}

async function seedDataset(preset: 'small' | 'medium' | 'large', seed: string) {
  const config = presetDatasetConfig(preset, seed);
  validateDatasetConfig(config);
  console.log(`[stress] Generating ${preset} dataset (${config.assetCount} assets, ${config.collectionCount} collections)...`);
  const generated = generateDataset(config);
  console.log(`[stress] Generation took ${generated.manifest.generationDurationMs.toFixed(1)}ms — ${generated.manifest.membershipCount} memberships.`);
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  const persistResult = await persistDataset(generated.collections, generated.assets, config.batchSize, { confirmValidationEnvironment: true });
  console.log(`[stress] Persisted in ${persistResult.durationMs.toFixed(1)}ms.`);
  return { generated, persistResult, datasetIdentity: datasetIdentityFor(preset, generated.assets.length, generated.collections.length) };
}

function summarizeCounts(result: SoakRunResult): string {
  const lines: string[] = [];
  for (const [op, counts] of Object.entries(result.countsByOperation)) {
    lines.push(`  ${op}: success=${counts.success} failure=${counts.failure} timeout=${counts.timeout}`);
  }
  return lines.join('\n');
}

function latencyDriftReport(result: SoakRunResult): Record<string, ReturnType<typeof computeLatencyDrift>> {
  const ops = new Set(result.results.map((r) => r.operation));
  const drift: Record<string, ReturnType<typeof computeLatencyDrift>> = {};
  for (const op of ops) {
    drift[op] = computeLatencyDrift(latencySeriesFor(result, op as SoakOperationName), op);
  }
  return drift;
}

function baselineComparisonForResult(result: SoakRunResult, datasetIdentity: string): ReturnType<typeof compareBatchAgainstSprint1> {
  const env = currentEnvironmentDescription();
  const measurements: CurrentMeasurement[] = [];
  for (const [op, baselineName] of Object.entries(SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME)) {
    if (!baselineName) continue;
    const series = latencySeriesFor(result, op as SoakOperationName);
    if (series.length === 0) continue;
    const stats = computeStats(series);
    measurements.push({ benchmarkName: baselineName, datasetIdentity, medianMs: stats.medianMs, environmentDescription: env });
  }
  return compareBatchAgainstSprint1(measurements);
}

async function runStressMode(): Promise<number> {
  const seed = 'p2.5-sprint2-stress';
  const { generated, datasetIdentity } = await seedDataset('large', seed);
  const before = await captureConsistencySnapshot();
  const pools = await makePools();
  const operations = buildOperations(seed, pools);

  const targetCounts: Partial<Record<SoakOperationName, number>> = {
    searchCollections: 100,
    filterActive: 100,
    filterArchived: 100,
    openCollection: 100,
    switchCollection: 100,
    retrieveMembers: 50,
    bulkAssign: 20,
    bulkRemove: 20,
    integrityScan: 20,
    tempCollectionCycle: 100,
  };

  console.log('[stress] Running LARGE stress plan with required minimum operation counts...');
  const result = await runStressPlan(operations, {
    seed,
    targetCounts,
    operationTimeoutMs: 60000,
    sampleEveryNOperations: 20,
    onProgress: (completed, total) => {
      if (completed % 50 === 0 || completed === total) console.log(`[stress] progress: ${completed}/${total}`);
    },
  });

  const after = await captureConsistencySnapshot();
  const diff = diffConsistencySnapshots(before, after, { assetCountDelta: 0, collectionCountDelta: 0 });

  const drift = latencyDriftReport(result);
  const memoryTrend = analyzeMemoryTrend(result.samples.map((s) => s.memory));
  const comparison = baselineComparisonForResult(result, datasetIdentity);

  const totalFailures = Object.values(result.countsByOperation).reduce((a, c) => a + c.failure + c.timeout, 0);
  const failures: string[] = [];
  if (totalFailures > 0) failures.push(`${totalFailures} operation(s) failed or timed out during the stress run.`);
  if (diff.unexplainedAssetCountMismatch) failures.push('Unexplained asset count mismatch after stress run.');
  if (diff.unexplainedCollectionCountMismatch) failures.push('Unexplained collection count mismatch after stress run (temp collections not fully cleaned up).');
  if (diff.newOrphansIntroduced) failures.push('Stress run introduced new orphaned memberships.');
  if (diff.newStaleCoversIntroduced) failures.push('Stress run introduced new stale cover references.');

  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: 'stress' as const,
    datasetIdentity,
    manifest: generated.manifest,
    countsByOperation: result.countsByOperation,
    totalDurationMs: result.totalDurationMs,
    latencyDrift: drift,
    memoryTrend,
    consistency: { before, after, diff },
    baselineComparison: comparison,
    failures,
  };

  console.log(summarizeCounts(result));
  console.log(`[stress] total duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`[stress] memory trend: ${memoryTrend.classification}`);
  console.log(`[stress] consistency: assetDelta=${diff.assetCountDelta} collectionDelta=${diff.collectionCountDelta} newOrphans=${diff.orphanCountDelta} newStaleCovers=${diff.staleCoverCountDelta}`);
  const jsonPath = writeJson('stress', report);
  const mdPath = writeText(
    'stress',
    'md',
    [
      '# Stress Report',
      '',
      `Dataset: ${datasetIdentity}`,
      `Total duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`,
      '',
      '## Operation counts',
      '```',
      summarizeCounts(result),
      '```',
      '',
      '## Baseline comparison',
      '',
      toMarkdownComparisonTable(comparison),
    ].join('\n'),
  );
  console.log(`Reports written to:\n  ${jsonPath}\n  ${mdPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return failures.length > 0 ? 1 : 0;
}

async function runSoakMode(profile: 'smoke' | 'standard' | 'extended', durationMsOverride?: number): Promise<number> {
  const durations = { smoke: 5 * 60_000, standard: 30 * 60_000, extended: 60 * 60_000 };
  const durationMs = durationMsOverride ?? durations[profile];
  const dataset = profile === 'smoke' ? 'medium' : 'large';
  const seed = `p2.5-sprint2-soak-${profile}`;

  const { generated, datasetIdentity } = await seedDataset(dataset, seed);
  const before = await captureConsistencySnapshot();
  const pools = await makePools();
  const operations = buildOperations(seed, pools);

  const signal: SoakCancelSignal = { cancelled: false };
  let stoppedForExternalLimit = false;
  process.once('SIGINT', () => {
    console.log('\n[soak] SIGINT received — cancelling cleanly and writing a partial report...');
    signal.cancelled = true;
    signal.reason = 'SIGINT';
  });
  process.once('SIGTERM', () => {
    console.log('\n[soak] SIGTERM received — cancelling cleanly and writing a partial report...');
    signal.cancelled = true;
    signal.reason = 'SIGTERM';
    stoppedForExternalLimit = true;
  });

  console.log(`[soak:${profile}] Running for ${(durationMs / 60000).toFixed(1)} minutes against ${datasetIdentity}...`);
  const startWallClock = Date.now();
  const result = await runSoak(operations, {
    seed,
    durationMs,
    operationTimeoutMs: 60000,
    sampleIntervalMs: Math.max(5000, Math.floor(durationMs / 60)),
    onProgress: (elapsedMs, total, cycle) => {
      if (cycle % 100 === 0) console.log(`[soak:${profile}] ${(elapsedMs / 1000).toFixed(0)}s / ${(total / 1000).toFixed(0)}s — cycle ${cycle}`);
    },
    onSample: (sample) => {
      console.log(
        `[soak:${profile}] sample @cycle ${sample.atCycle}: heapUsed=${sample.memory.heapUsedBytes ?? 'n/a'} rss=${sample.memory.rssBytes ?? 'n/a'}`,
      );
    },
    signal,
  });

  const actualDurationMs = Date.now() - startWallClock;
  const after = await captureConsistencySnapshot();
  const diff = diffConsistencySnapshots(before, after, { assetCountDelta: 0, collectionCountDelta: 0 });
  const drift = latencyDriftReport(result);
  const memoryTrend = analyzeMemoryTrend(result.samples.map((s) => s.memory));
  const comparison = baselineComparisonForResult(result, datasetIdentity);

  const shortfallMs = durationMs - actualDurationMs;
  const externallyLimited = result.cancelled && (result.cancelReason === 'SIGTERM' || stoppedForExternalLimit);

  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: `soak-${profile}` as const,
    requestedDurationMs: durationMs,
    actualDurationMs,
    cancelled: result.cancelled,
    cancelReason: result.cancelReason,
    externallyLimited,
    datasetIdentity,
    manifest: generated.manifest,
    countsByOperation: result.countsByOperation,
    latencyDrift: drift,
    memoryTrend,
    consistency: { before, after, diff },
    baselineComparison: comparison,
    cycleCount: result.results.length,
  };

  console.log(summarizeCounts(result));
  console.log(`[soak:${profile}] actual duration: ${(actualDurationMs / 1000 / 60).toFixed(2)} minutes (requested ${(durationMs / 60000).toFixed(1)} minutes)`);
  if (result.cancelled) {
    console.log(`[soak:${profile}] run was cancelled early (reason: ${result.cancelReason}). Shortfall: ${(shortfallMs / 1000).toFixed(0)}s. This is reported honestly as a partial/externally-limited run, not relabeled as complete.`);
  }
  console.log(`[soak:${profile}] memory trend: ${memoryTrend.classification} (${memoryTrend.sampleCount} samples)`);
  const jsonPath = writeJson(`soak-${profile}`, report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  // A cancelled/externally-limited run is reported honestly but is not
  // itself a validation "failure" exit — only real defects are.
  return diff.unexplainedAssetCountMismatch || diff.unexplainedCollectionCountMismatch || diff.newOrphansIntroduced || diff.newStaleCoversIntroduced ? 1 : 0;
}

async function runBaselineCompareMode(): Promise<number> {
  const { datasetIdentity } = await seedDataset('small', 'p2.5-sprint2-baseline-compare');
  const pools = await makePools();
  const operations = buildOperations('baseline-compare', pools);
  const result = await runStressPlan(operations, {
    seed: 'baseline-compare',
    targetCounts: { searchCollections: 10, filterActive: 10, openCollection: 10, bulkAssign: 3, bulkRemove: 3, integrityScan: 3 },
  });
  const comparison = baselineComparisonForResult(result, datasetIdentity);
  console.log(toMarkdownComparisonTable(comparison));
  writeJson('baseline-compare', { generatedAt: Date.now(), datasetIdentity, comparison });
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  const anyRegression = comparison.some((r) => r.classification === 'regression');
  return anyRegression ? 1 : 0;
}

async function main(): Promise<number> {
  const mode = process.argv[2] ?? '';
  const maxMinutesArg = process.argv.find((a) => a.startsWith('--max-minutes='));
  const maxMinutesOverride = maxMinutesArg ? Number(maxMinutesArg.split('=')[1]) * 60_000 : undefined;

  if (mode === 'stress') return runStressMode();
  if (mode === 'soak-smoke') return runSoakMode('smoke', maxMinutesOverride);
  if (mode === 'soak-30m') return runSoakMode('standard', maxMinutesOverride);
  if (mode === 'soak-60m') return runSoakMode('extended', maxMinutesOverride);
  if (mode === 'baseline-compare') return runBaselineCompareMode();

  console.error(`Unknown mode "${mode}". Expected one of: stress, soak-smoke, soak-30m, soak-60m, baseline-compare.`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[validateCollectionsStress] Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
