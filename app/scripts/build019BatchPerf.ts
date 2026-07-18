import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'fake-indexeddb/auto';
import { File as NodeFile } from 'node:buffer';
(globalThis as any).File = NodeFile;

import { generateBatchToPortfolio } from '../src/batch/batchProductionService';
import { clearPortfolioStores } from '../src/catalog/storage/portfolioStore';
import { defaultParams } from '../src/engine/defaults';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';

// Build 019 ("Visual Commercial Upgrade"), Priority 6 (Batch Integration)
// validation: measures real Batch Generate (10/20/50/100) performance,
// retry rate, failure rate and structural diversity through the actual
// `generateBatchToPortfolio` service (Build 018) -- the same function the
// UI's "Batch Generate" button calls -- with no mocking of the retry gate
// or diversity engine. Two runs, matching the two real ways Batch Generate
// gets invoked:
//   - `withStyleDna`: an active Style DNA preset constrains the diversity
//     pool to that preset's own declared families/zones (the common case
//     when a user has picked a look before batch-producing).
//   - `noStyleDna`: no active preset, the full diversity space, and each
//     item's structural params come from `randomizedParams` (Build 018's
//     own documented fallback) rather than `resolveStyleDna` -- a
//     different, non-deterministic-per-structure code path, included here
//     so this script's own numbers don't silently omit it.
// Needs `fake-indexeddb` + Node's real `File` (not jsdom's) for the exact
// same reason `batch/batchProductionService.test.ts` does -- see that
// file's own header comment.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

interface BatchPerfRow {
  count: number;
  elapsedMs: number;
  msPerItem: number;
  generatedCount: number;
  importedCount: number;
  possibleDuplicateCount: number;
  blockedDuplicateCount: number;
  errorCount: number;
  failureRate: number;
  retryRate: number;
  meanAttempts: number;
  distinctBotanicalFamilies: number;
  distinctCompositionZones: number;
}

async function runBatch(count: number, dnaId?: string): Promise<BatchPerfRow> {
  await clearPortfolioStores();
  const dna = dnaId ? STYLE_DNA_PRESETS[dnaId] : undefined;
  const params = { ...defaultParams(), categoryId: 'botanical' as const };
  const start = Date.now();
  const result = await generateBatchToPortfolio({
    count,
    params,
    activeDna: dna,
    existingAssets: [],
    seedForItem: (i) => `perf-${dnaId ?? 'no-dna'}-${count}-${i}`,
    diversityRngSeed: `perf-diversity-${dnaId ?? 'no-dna'}-${count}`,
  });
  const elapsedMs = Date.now() - start;
  const families = new Set(result.items.map((it) => it.variantParams.botanicalFamily));
  const zones = new Set(result.items.map((it) => it.variantParams.compositionZone));
  return {
    count,
    elapsedMs,
    msPerItem: Math.round((elapsedMs / count) * 100) / 100,
    generatedCount: result.generatedCount,
    importedCount: result.importedCount,
    possibleDuplicateCount: result.possibleDuplicateCount,
    blockedDuplicateCount: result.blockedDuplicateCount,
    errorCount: result.errorCount,
    failureRate: Math.round((result.errorCount / result.generatedCount) * 10000) / 100,
    retryRate: result.retryRate,
    meanAttempts: result.meanAttempts,
    distinctBotanicalFamilies: families.size,
    distinctCompositionZones: zones.size,
  };
}

async function main() {
  const label = process.argv[2] ?? 'run';
  const withStyleDna: BatchPerfRow[] = [];
  const noStyleDna: BatchPerfRow[] = [];
  for (const count of [10, 20, 50, 100]) {
    withStyleDna.push(await runBatch(count, 'editorialBotanical'));
  }
  for (const count of [10, 20, 50, 100]) {
    noStyleDna.push(await runBatch(count));
  }

  const report = { label, withStyleDna, noStyleDna };
  console.log(JSON.stringify(report, null, 2));

  const __dirname = __dirnameFromUrl();
  const outDir = path.join(__dirname, '..', '..', 'docs', 'build_reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `BUILD_019_BATCH_PERF_${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
}

main();
