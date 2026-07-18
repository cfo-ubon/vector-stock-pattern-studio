#!/usr/bin/env -S npx tsx
// Portfolio Manager P2.5 Sprint 1 — Collection validation CLI (Section 9).
//
// Usage (see package.json's `validate:collections*` scripts):
//   tsx scripts/validateCollections.ts [small|medium|large|integrity|benchmark|memory-smoke]
// With no argument, runs the "default" flow: validate config -> generate a
// SMALL dataset -> core service benchmarks -> integrity validation ->
// bounded memory instrumentation -> JSON + Markdown reports.
//
// Installs `fake-indexeddb/auto` before importing any catalog module —
// see `src/catalog/validation/validationDb.ts`'s header comment for why
// this makes every IndexedDB operation below run against an isolated,
// in-memory, per-process store that can never be a real user's browser
// database. Nothing here ever touches a real browser profile.
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
  runBenchmarkSuite,
  scanIntegrity,
  repairAll,
  allIntegrityScenarioNames,
  buildIntegrityScenario,
  MemorySampler,
  toJsonReport,
  toConsoleSummary,
  toMarkdownReport,
  DATASET_GENERATOR_VERSION,
} from '../src/catalog/validation/index.js';
import type { BenchmarkCase } from '../src/catalog/validation/benchmarkRunner.js';
import type { FullValidationReport } from '../src/catalog/validation/benchmarkReport.js';
import type { DatasetPresetName } from '../src/catalog/validation/types.js';
import { loadCollections, countCollections } from '../src/catalog/storage/collectionStore.js';
import { loadPortfolioAssets } from '../src/catalog/storage/portfolioStore.js';
import { assignAssetsToCollections, removeAssetsFromCollections, getAssetsForCollection } from '../src/catalog/services/collectionService.js';
import { searchPortfolioAssets } from '../src/catalog/domain/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'validation-results', 'collections');

function gitInfo(): { commit: string | null; branch: string | null } {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '..', '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: path.resolve(__dirname, '..', '..'), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return { commit, branch };
  } catch {
    return { commit: null, branch: null };
  }
}

function datasetIdentity(preset: DatasetPresetName, assetCount: number, collectionCount: number): string {
  return `${preset}-${assetCount}x${collectionCount}`;
}

async function buildServiceBenchmarkCases(preset: DatasetPresetName): Promise<{ cases: BenchmarkCase[]; datasetLabel: string }> {
  const collections = await loadCollections();
  const assets = await loadPortfolioAssets();
  const activeCollectionIds = collections.filter((c) => !c.isArchived).map((c) => c.id);
  const someAssetIds = assets.slice(0, Math.min(1000, assets.length)).map((a) => a.assetId);
  const someCollectionId = activeCollectionIds[0];
  const bulkTargetCollectionId = activeCollectionIds[Math.min(1, activeCollectionIds.length - 1)] ?? someCollectionId;

  const cases: BenchmarkCase[] = [
    {
      name: 'list-collections',
      category: 'collection-service',
      warmupIterations: 1,
      measuredIterations: 5,
      run: () => loadCollections(),
    },
    {
      name: 'filter-active-archived',
      category: 'collection-service',
      warmupIterations: 1,
      measuredIterations: 5,
      run: async () => {
        const all = await loadCollections();
        return { active: all.filter((c) => !c.isArchived).length, archived: all.filter((c) => c.isArchived).length };
      },
    },
    {
      name: 'open-collection-metadata',
      category: 'collection-service',
      warmupIterations: 1,
      measuredIterations: 5,
      run: () => (someCollectionId ? getAssetsForCollection(someCollectionId) : Promise.resolve([])),
    },
    {
      name: 'collection-count',
      category: 'data-access',
      warmupIterations: 1,
      measuredIterations: 5,
      run: () => countCollections(),
    },
    {
      name: 'search-collection-filter',
      category: 'data-access',
      warmupIterations: 1,
      measuredIterations: 5,
      run: () => searchPortfolioAssets(assets, { collectionId: someCollectionId, collectionMembership: undefined }),
    },
    {
      name: 'bulk-assign-1000',
      category: 'collection-service',
      warmupIterations: 0,
      measuredIterations: 1,
      timeoutMs: 60000,
      run: () => assignAssetsToCollections(someAssetIds, bulkTargetCollectionId ? [bulkTargetCollectionId] : []),
    },
    {
      name: 'bulk-remove-1000',
      category: 'collection-service',
      warmupIterations: 0,
      measuredIterations: 1,
      timeoutMs: 60000,
      run: () => removeAssetsFromCollections(someAssetIds, bulkTargetCollectionId ? [bulkTargetCollectionId] : []),
    },
    {
      name: 'integrity-scan',
      category: 'collection-service',
      warmupIterations: 0,
      measuredIterations: 3,
      timeoutMs: 60000,
      run: () => scanIntegrity(),
    },
  ];
  return { cases, datasetLabel: datasetIdentity(preset, assets.length, collections.length) };
}

async function runIntegrityValidation(): Promise<{ warnings: string[]; failures: string[] }> {
  const warnings: string[] = [];
  const failures: string[] = [];
  for (const name of allIntegrityScenarioNames()) {
    await resetValidationDatabase({ confirmValidationEnvironment: true });
    const scenario = buildIntegrityScenario(name);
    await persistDataset(scenario.collections, scenario.assets, 500, { confirmValidationEnvironment: true });
    const report = await scanIntegrity();
    if (name === 'orphanedMembership' && report.orphanedMemberships.length === 0) failures.push(`orphanedMembership scenario: scanner found 0 orphans (expected > 0)`);
    if (name === 'staleCover' && report.invalidCoverAssetReferences.length === 0) failures.push(`staleCover scenario: scanner found 0 stale covers (expected > 0)`);
    if (name === 'valid' && (report.orphanedMemberships.length > 0 || report.invalidCoverAssetReferences.length > 0)) {
      failures.push(`valid scenario: scanner unexpectedly reported a violation`);
    }
    if (name === 'duplicateCollectionId') {
      warnings.push('duplicateCollectionId scenario: current scanner does not detect this condition (documented, see Technical Debt Register).');
    }
    await repairAll();
    const afterRepair = await scanIntegrity();
    if (afterRepair.orphanedMemberships.length > 0 || afterRepair.invalidCoverAssetReferences.length > 0) {
      failures.push(`${name} scenario: repair did not fully resolve detectable violations`);
    }
  }
  return { warnings, failures };
}

async function runBoundedMemorySmoke(): Promise<{ sampler: MemorySampler; warnings: string[] }> {
  const warnings: string[] = [];
  const sampler = new MemorySampler();
  sampler.sample();
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  const { collections, assets } = generateDataset({ ...presetDatasetConfig('small'), assetCount: 200, collectionCount: 20, avgMembershipsPerAsset: 3 });
  await persistDataset(collections, assets, 100, { confirmValidationEnvironment: true });
  sampler.sample();
  for (let i = 0; i < 10; i++) {
    await loadCollections();
    if (collections[0]) await getAssetsForCollection(collections[0].id);
  }
  sampler.sample();
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  sampler.sample();
  const summary = sampler.summarize();
  if (!summary.supported) warnings.push('Memory sampling unsupported in this environment — reporting sample count only, no byte figures.');
  return { sampler, warnings };
}

function writeReports(report: FullValidationReport, label: string): { jsonPath: string; markdownPath: string } {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `${label}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${label}.md`);
  fs.writeFileSync(jsonPath, toJsonReport(report));
  fs.writeFileSync(markdownPath, toMarkdownReport(report));
  return { jsonPath, markdownPath };
}

async function runPresetFlow(preset: DatasetPresetName, seed?: string): Promise<FullValidationReport> {
  const config = presetDatasetConfig(preset, seed);
  validateDatasetConfig(config);
  console.log(`[validate:collections] Generating ${preset} dataset (${config.assetCount} assets, ${config.collectionCount} collections)...`);

  const generated = generateDataset(config);
  console.log(`[validate:collections] Generation took ${generated.manifest.generationDurationMs.toFixed(1)}ms — ${generated.manifest.membershipCount} memberships.`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  const persistResult = await persistDataset(generated.collections, generated.assets, config.batchSize, { confirmValidationEnvironment: true });
  console.log(`[validate:collections] Persisted in ${persistResult.durationMs.toFixed(1)}ms (${persistResult.collectionBatches} + ${persistResult.assetBatches} batches).`);
  generated.manifest.databaseName = persistResult.databaseName;

  const { cases } = await buildServiceBenchmarkCases(preset);
  const benchmarks = await runBenchmarkSuite(cases);

  const failures: string[] = [];
  for (const r of benchmarks.results) {
    if (r.status !== 'success') failures.push(`${r.category}/${r.name}: ${r.status} — ${r.error}`);
  }

  const { commit, branch } = gitInfo();
  return { generatedAt: Date.now(), gitCommit: commit, branch, manifest: generated.manifest, benchmarks, warnings: [], failures };
}

async function main(): Promise<number> {
  const mode = process.argv[2] ?? 'default';
  const { commit, branch } = gitInfo();
  let exitCode = 0;

  if (mode === 'integrity') {
    console.log('[validate:collections] Running integrity scenario suite...');
    const { warnings, failures } = await runIntegrityValidation();
    const report: FullValidationReport = {
      generatedAt: Date.now(),
      gitCommit: commit,
      branch,
      manifest: null,
      benchmarks: { environment: (await runBenchmarkSuite([])).environment, generatedAt: Date.now(), results: [] },
      warnings,
      failures,
    };
    const { jsonPath, markdownPath } = writeReports(report, 'integrity');
    console.log(toConsoleSummary(report));
    console.log(`\nReports written to:\n  ${jsonPath}\n  ${markdownPath}`);
    exitCode = failures.length > 0 ? 1 : 0;
  } else if (mode === 'memory-smoke') {
    console.log('[validate:collections] Running bounded memory smoke...');
    const { sampler, warnings } = await runBoundedMemorySmoke();
    const summary = sampler.summarize();
    const report: FullValidationReport = {
      generatedAt: Date.now(),
      gitCommit: commit,
      branch,
      manifest: null,
      benchmarks: { environment: (await runBenchmarkSuite([])).environment, generatedAt: Date.now(), results: [] },
      warnings,
      failures: [],
    };
    const { jsonPath, markdownPath } = writeReports({ ...report, warnings: [...warnings, `Memory summary: ${JSON.stringify(summary)}`] }, 'memory-smoke');
    console.log(toConsoleSummary(report));
    console.log(`Memory summary: baseline=${summary.baseline.heapUsedBytes} peak=${summary.peak.heapUsedBytes} final=${summary.final.heapUsedBytes} delta=${summary.deltaHeapUsedBytes}`);
    console.log(`\nReports written to:\n  ${jsonPath}\n  ${markdownPath}`);
  } else if (mode === 'benchmark') {
    const report = await runPresetFlow('small');
    const { jsonPath, markdownPath } = writeReports(report, 'benchmark-small');
    console.log(toConsoleSummary(report));
    console.log(`\nReports written to:\n  ${jsonPath}\n  ${markdownPath}`);
    exitCode = report.failures.length > 0 ? 1 : 0;
  } else if (mode === 'small' || mode === 'medium' || mode === 'large') {
    const report = await runPresetFlow(mode);
    const { jsonPath, markdownPath } = writeReports(report, mode);
    console.log(toConsoleSummary(report));
    console.log(`\nReports written to:\n  ${jsonPath}\n  ${markdownPath}`);
    exitCode = report.failures.length > 0 ? 1 : 0;
  } else if (mode === 'default') {
    console.log(`[validate:collections] Default flow — generator v${DATASET_GENERATOR_VERSION}`);
    const report = await runPresetFlow('small');
    const { warnings: integrityWarnings, failures: integrityFailures } = await runIntegrityValidation();
    const { sampler, warnings: memoryWarnings } = await runBoundedMemorySmoke();
    const summary = sampler.summarize();
    const fullReport: FullValidationReport = {
      ...report,
      warnings: [...report.warnings, ...integrityWarnings, ...memoryWarnings, `Memory summary: baseline=${summary.baseline.heapUsedBytes} peak=${summary.peak.heapUsedBytes} final=${summary.final.heapUsedBytes} delta=${summary.deltaHeapUsedBytes}`],
      failures: [...report.failures, ...integrityFailures],
    };
    const { jsonPath, markdownPath } = writeReports(fullReport, 'default');
    console.log(toConsoleSummary(fullReport));
    console.log(`\nReports written to:\n  ${jsonPath}\n  ${markdownPath}`);
    exitCode = fullReport.failures.length > 0 ? 1 : 0;
  } else {
    console.error(`Unknown mode "${mode}". Expected one of: default, small, medium, large, integrity, benchmark, memory-smoke.`);
    exitCode = 1;
  }

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[validate:collections] Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
