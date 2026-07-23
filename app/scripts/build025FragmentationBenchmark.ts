// Build 025, Phase 9 (Fragmentation Benchmark). Empirically measures the
// experimental Luxury Floral Composition Engine (Phases 2-8, gated behind
// `params.luxuryComposition`, shipped OFF by default per BUILD_025_AUDIT.md's
// Section 6 finding) against the current production baseline (the same
// `luxuryFloral` code path this app already ships, unchanged by this build).
//
// Paired design: baseline and experimental runs use the IDENTICAL seed set
// for `luxuryFloral`, so per-seed deltas are directly attributable to the
// new engine, not seed variance. 3 additional `premiumHero` presets
// (bohoFloral, darkBotanical, editorialBotanical) plus the Build 023-established
// "strong non-premium control" (scandinavianOrganic) are measured once each
// (baseline only -- `luxuryComposition` is never set true for them, by
// construction, so there is no experimental variant to compare) purely to
// confirm this build's wiring changes (Placement.isPrimaryCluster,
// LayoutParams.luxuryComposition/productTarget, tile.ts's conditional Repair
// Engine V2 call) introduce zero measurable drift on any style that doesn't
// opt in.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateWithTile, buildPortfolioParams, stats, visualIssueRates } from './qualityReport';
import type { EvalResult } from './qualityReport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LUXURY_SEED_COUNT = 300;
const CONTROLS: Array<{ styleId: string; count: number }> = [
  { styleId: 'scandinavianOrganic', count: 100 },
  { styleId: 'bohoFloral', count: 50 },
  { styleId: 'darkBotanical', count: 50 },
  { styleId: 'editorialBotanical', count: 50 },
];

function seedList(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
}

function run(styleId: string, seeds: string[], luxuryComposition?: boolean): EvalResult[] {
  return seeds.map((seed) => {
    const params = buildPortfolioParams(styleId, seed);
    const finalParams = luxuryComposition ? { ...params, luxuryComposition: true } : params;
    const { result } = evaluateWithTile(`${styleId}@${seed}${luxuryComposition ? '+lux' : ''}`, finalParams, styleId);
    return result;
  });
}

function summarize(label: string, results: EvalResult[]) {
  const issueRates = visualIssueRates(results);
  const commercial = stats(results.map((r) => r.absoluteCommercialQuality));
  const commercialV2 = stats(results.map((r) => r.absoluteCommercialQualityV2));
  return {
    label,
    n: results.length,
    fragmentedSilhouetteRate: issueRates.fragmentedSilhouette,
    deadSpaceRate: issueRates.deadSpace,
    allIssueRates: issueRates,
    commercialQualityMean: commercial.mean,
    commercialQualityV2Mean: commercialV2.mean,
    nodeCount: stats(results.map((r) => r.nodeCount)),
  };
}

function main() {
  const t0 = Date.now();
  const luxurySeeds = seedList('m25', LUXURY_SEED_COUNT);

  console.log(`Running luxuryFloral baseline (${LUXURY_SEED_COUNT} seeds)...`);
  const luxuryBaseline = run('luxuryFloral', luxurySeeds, false);
  console.log(`Running luxuryFloral experimental / luxuryComposition=true (${LUXURY_SEED_COUNT} seeds)...`);
  const luxuryExperimental = run('luxuryFloral', luxurySeeds, true);

  const controlResults: Record<string, EvalResult[]> = {};
  for (const { styleId, count } of CONTROLS) {
    console.log(`Running control ${styleId} baseline (${count} seeds)...`);
    controlResults[styleId] = run(styleId, seedList(`m25c-${styleId}`, count), false);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    luxuryFloral: {
      baseline: summarize('luxuryFloral baseline (production, luxuryComposition off)', luxuryBaseline),
      experimental: summarize('luxuryFloral experimental (luxuryComposition on)', luxuryExperimental),
      pairedDelta: {
        fragmentedSilhouetteRateDelta:
          summarize('exp', luxuryExperimental).fragmentedSilhouetteRate - summarize('base', luxuryBaseline).fragmentedSilhouetteRate,
        deadSpaceRateDelta: summarize('exp', luxuryExperimental).deadSpaceRate - summarize('base', luxuryBaseline).deadSpaceRate,
        commercialQualityMeanDelta:
          summarize('exp', luxuryExperimental).commercialQualityMean - summarize('base', luxuryBaseline).commercialQualityMean,
      },
    },
    controls: Object.fromEntries(
      Object.entries(controlResults).map(([styleId, results]) => [styleId, summarize(`${styleId} (control, unaffected by construction)`, results)]),
    ),
  };

  const outDir = path.join(__dirname, '..', '..', 'reports', 'build_025');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fragmentation_benchmark.json'), JSON.stringify(report, null, 2));

  console.log('\n=== Build 025 Fragmentation Benchmark ===');
  console.log(`luxuryFloral baseline (n=${luxuryBaseline.length}): fragmentedSilhouette=${report.luxuryFloral.baseline.fragmentedSilhouetteRate}% deadSpace=${report.luxuryFloral.baseline.deadSpaceRate}% commercial=${report.luxuryFloral.baseline.commercialQualityMean.toFixed(2)}`);
  console.log(`luxuryFloral experimental (n=${luxuryExperimental.length}): fragmentedSilhouette=${report.luxuryFloral.experimental.fragmentedSilhouetteRate}% deadSpace=${report.luxuryFloral.experimental.deadSpaceRate}% commercial=${report.luxuryFloral.experimental.commercialQualityMean.toFixed(2)}`);
  console.log('Paired delta (experimental - baseline):', report.luxuryFloral.pairedDelta);
  for (const [styleId, s] of Object.entries(report.controls)) {
    console.log(`control ${styleId} (n=${s.n}): fragmentedSilhouette=${s.fragmentedSilhouetteRate}% deadSpace=${s.deadSpaceRate}% commercial=${s.commercialQualityMean.toFixed(2)}`);
  }
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Wrote reports/build_025/fragmentation_benchmark.json`);
}

main();
