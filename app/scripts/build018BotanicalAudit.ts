import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stats } from './qualityReport';
import { defaultParams } from '../src/engine/defaults';
import { createRng } from '../src/engine/rng';
import { assignPortfolioDiversity } from '../src/engine/portfolioVariety';
import { HIERARCHY_PRESETS } from '../src/engine/hierarchy';
import { buildTileForGenerate } from '../src/engine/heroDetector';
import { computeBotanicalBeautyMetrics, BOTANICAL_BEAUTY_DIMENSIONS } from '../src/engine/botanicalBeautyMetrics';
import type { GenerateParams } from '../src/engine/types';

// Build 018 ("Revenue First", Priority 4 — improve Botanical composition).
// Reuses `engine/portfolioVariety.ts`'s `assignPortfolioDiversity` (the
// same diversity engine `batch/batchProductionService.ts` uses),
// `engine/heroDetector.ts`'s `buildTileForGenerate` (the same quality-
// retry path every real generation call goes through), and
// `engine/botanicalBeautyMetrics.ts`'s existing, unmodified
// `computeBotanicalBeautyMetrics` — no new scoring logic — to generate a
// representative, diverse sample of botanical patterns and find the
// real, current weakest-scoring dimension (Build 004, Section 10 — an
// already-shipped 11-dimension metric this script only *reads*) — the
// evidence this build's one targeted fix is based on, in the same style
// Build 001.1's own evidence-first fixes used. `qualityReport.ts`'s
// `EvalResult` does not expose the raw `BotanicalBeautyMetrics` object
// (only derived `illustrationQuality`/`visualRichness` summaries), so
// this script calls `computeBotanicalBeautyMetrics` directly on the same
// tile+metrics `evaluateWithTile` itself would have produced, rather
// than modifying that shared, frozen evaluation harness.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

const SAMPLE_SIZE = 60;

function buildBotanicalSample(): GenerateParams[] {
  const rng = createRng('build018-botanical-audit');
  const assignments = assignPortfolioDiversity(rng, SAMPLE_SIZE);
  return assignments.map((a, i) => ({
    ...defaultParams(),
    categoryId: 'botanical',
    seed: `b018-audit-${i}`,
    compositionZone: a.compositionZone,
    botanicalFamily: a.botanicalFamily,
    clusterArchetypes: [a.clusterType],
    hierarchy: HIERARCHY_PRESETS[a.heroStructure].value,
    heroArchetype: a.heroSilhouette,
  }));
}

function main() {
  const label = process.argv[2] ?? 'run';
  const __dirname = __dirnameFromUrl();
  const outDir = path.join(__dirname, '..', '..', 'docs', 'build_reports');
  fs.mkdirSync(outDir, { recursive: true });

  const sample = buildBotanicalSample();
  const perDimension: Record<string, number[]> = {};
  for (const dim of BOTANICAL_BEAUTY_DIMENSIONS) perDimension[dim.key] = [];
  const overall: number[] = [];

  for (const params of sample) {
    const { tileData, metrics } = buildTileForGenerate(params);
    const botanical = computeBotanicalBeautyMetrics(tileData, metrics);
    for (const dim of BOTANICAL_BEAUTY_DIMENSIONS) perDimension[dim.key].push(botanical[dim.key]);
    overall.push(botanical.overall);
  }

  const report = {
    label,
    sampleSize: sample.length,
    scored: overall.length,
    overall: stats(overall),
    dimensions: Object.fromEntries(BOTANICAL_BEAUTY_DIMENSIONS.map((d) => [d.key, { label: d.label, ...stats(perDimension[d.key]) }])),
  };

  const weakest = [...BOTANICAL_BEAUTY_DIMENSIONS].sort((a, b) => report.dimensions[a.key].mean - report.dimensions[b.key].mean)[0];
  console.log(`Weakest dimension (lowest mean): ${weakest.label} (${weakest.key}) — mean ${report.dimensions[weakest.key].mean}, min ${report.dimensions[weakest.key].min}`);
  console.log('Full per-dimension means:', Object.fromEntries(BOTANICAL_BEAUTY_DIMENSIONS.map((d) => [d.label, report.dimensions[d.key].mean])));

  const outFile = path.join(outDir, `BUILD_018_BOTANICAL_AUDIT_${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
}

main();
