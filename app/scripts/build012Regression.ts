import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildTileWithHeroRetry } from '../src/engine/heroDetector';
import { computeMetrics, computeOverallScore, type QualityPresetId } from '../src/engine/scoring';
import { computeOverallScoreV2 } from '../src/engine/scoringV2';
import { layoutEvaluationClass } from '../src/engine/layoutEvaluation';
import { computeStyleEvaluationProfile } from '../src/engine/styleEvaluation';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';
import {
  buildPortfolioParams, buildScenarioParams, STYLE_IDS,
  SCENARIO_SUITE, SCENARIO_SEEDS, XL_PORTFOLIO_SEEDS,
} from './qualityReport';

// Build 012, Section 8 (Regression Validation) + Section 9 (Commercial
// Validation). Re-scores the exact same 4 frozen tiers Build 011/011.5
// already established (30-scenario suite, 100-pattern portfolio, 500-pattern
// XL portfolio, 1500-pattern commercial reality check — same seeds, same
// `buildPortfolioParams`/`buildScenarioParams` pipeline) with BOTH the V1
// score (`computeOverallScore`, unchanged) and the new V2 score
// (`computeOverallScoreV2`, Build 012 Sections 2/5) side by side, so every
// score change this build produces is directly measured against a real
// baseline rather than asserted. No tile is regenerated differently between
// V1 and V2 — the exact same `CompositionMetrics` feeds both scores, so any
// difference is attributable entirely to the scoring-layer change, not to
// generation drift.

const METRIC_FAILURE_FLOOR = 50;

interface TileScorePair {
  label: string;
  layoutClass: string;
  v1: number;
  v2: number;
}

function stats(values: number[]) {
  const n = values.length;
  const mean = n > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / n) * 100) / 100 : 0;
  const failureRate = n > 0 ? Math.round((values.filter((v) => v < METRIC_FAILURE_FLOOR).length / n) * 10000) / 100 : 0;
  return { n, mean, failureRate };
}

function scoreTile(layoutId: Parameters<typeof layoutEvaluationClass>[0], metrics: ReturnType<typeof computeMetrics>, presetId: QualityPresetId = 'stockClean') {
  const v1 = computeOverallScore(metrics, presetId).score;
  const v2 = computeOverallScoreV2(metrics, presetId, { layoutClass: layoutEvaluationClass(layoutId) }).score;
  return { v1, v2 };
}

// ---- Tier 1: 30-scenario suite ----
function runScenarioTier(): TileScorePair[] {
  const out: TileScorePair[] = [];
  for (const { layoutId, categoryId } of SCENARIO_SUITE) {
    for (const seed of SCENARIO_SEEDS) {
      const params = buildScenarioParams(layoutId, categoryId, seed);
      const { tileData } = buildTileWithHeroRetry(params);
      const metrics = computeMetrics(tileData);
      const { v1, v2 } = scoreTile(layoutId, metrics);
      out.push({ label: `${layoutId}/${categoryId}@${seed}`, layoutClass: layoutEvaluationClass(layoutId), v1, v2 });
    }
  }
  return out;
}

// ---- Tier 2: 100-pattern portfolio (7 seeds x 15 presets, trimmed to 100) ----
const PORTFOLIO_SEEDS_012 = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7'];
function runPortfolioTier(): Record<string, TileScorePair[]> {
  const byPreset: Record<string, TileScorePair[]> = {};
  const allPairs: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of PORTFOLIO_SEEDS_012) allPairs.push({ styleId, seed });
  for (const { styleId, seed } of allPairs.slice(0, 100)) {
    const params = buildPortfolioParams(styleId, seed);
    const { tileData } = buildTileWithHeroRetry(params);
    const metrics = computeMetrics(tileData);
    const { v1, v2 } = scoreTile(params.layoutId, metrics);
    (byPreset[styleId] ??= []).push({ label: `${styleId}@${seed}`, layoutClass: layoutEvaluationClass(params.layoutId), v1, v2 });
  }
  return byPreset;
}

// ---- Tier 3: 500-pattern XL portfolio (34 seeds x 15 presets, trimmed to 500) ----
function runXlTier(): Record<string, TileScorePair[]> {
  const byPreset: Record<string, TileScorePair[]> = {};
  const allPairs: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of XL_PORTFOLIO_SEEDS) allPairs.push({ styleId, seed });
  for (const { styleId, seed } of allPairs.slice(0, 500)) {
    const params = buildPortfolioParams(styleId, seed);
    const { tileData } = buildTileWithHeroRetry(params);
    const metrics = computeMetrics(tileData);
    const { v1, v2 } = scoreTile(params.layoutId, metrics);
    (byPreset[styleId] ??= []).push({ label: `${styleId}@${seed}`, layoutClass: layoutEvaluationClass(params.layoutId), v1, v2 });
  }
  return byPreset;
}

// ---- Tier 4: 1500-pattern commercial reality check (100 seeds x 15 presets)
// -- same `cr-1`..`cr-100` seed convention `scripts/commercialRealityCheck.ts`
// used, so this tier's numbers are directly comparable to the stored
// BUILD_011_5_commercial_reality_check.json baseline.
const CR_SEEDS_012 = Array.from({ length: 100 }, (_, i) => `cr-${i + 1}`);
function run1500Tier(): Record<string, TileScorePair[]> {
  const byPreset: Record<string, TileScorePair[]> = {};
  for (const styleId of STYLE_IDS) {
    for (const seed of CR_SEEDS_012) {
      const params = buildPortfolioParams(styleId, seed);
      const { tileData } = buildTileWithHeroRetry(params);
      const metrics = computeMetrics(tileData);
      const { v1, v2 } = scoreTile(params.layoutId, metrics);
      (byPreset[styleId] ??= []).push({ label: `${styleId}@${seed}`, layoutClass: layoutEvaluationClass(params.layoutId), v1, v2 });
    }
  }
  return byPreset;
}

function summarizeByPreset(byPreset: Record<string, TileScorePair[]>) {
  const out: Record<string, { v1: ReturnType<typeof stats>; v2: ReturnType<typeof stats>; delta: number }> = {};
  for (const [styleId, tiles] of Object.entries(byPreset)) {
    const v1Stats = stats(tiles.map((t) => t.v1));
    const v2Stats = stats(tiles.map((t) => t.v2));
    out[styleId] = { v1: v1Stats, v2: v2Stats, delta: Math.round((v2Stats.mean - v1Stats.mean) * 100) / 100 };
  }
  return out;
}

function main() {
  const startedAt = Date.now();
  console.log('Build 012 Regression Validation — running all 4 tiers...');

  const scenarioTiles = runScenarioTier();
  console.log(`Tier 1 (30-scenario suite) done: n=${scenarioTiles.length}`);

  const portfolioByPreset = runPortfolioTier();
  console.log('Tier 2 (100-pattern portfolio) done');

  const xlByPreset = runXlTier();
  console.log('Tier 3 (500-pattern XL portfolio) done');

  const crByPreset = run1500Tier();
  console.log('Tier 4 (1500-pattern commercial reality check) done');

  const elapsedMs = Date.now() - startedAt;

  const scenarioV1 = stats(scenarioTiles.map((t) => t.v1));
  const scenarioV2 = stats(scenarioTiles.map((t) => t.v2));
  const scenarioByLayoutClass: Record<string, { v1: ReturnType<typeof stats>; v2: ReturnType<typeof stats> }> = {};
  for (const cls of ['lattice', 'organic'] as const) {
    const subset = scenarioTiles.filter((t) => t.layoutClass === cls);
    scenarioByLayoutClass[cls] = { v1: stats(subset.map((t) => t.v1)), v2: stats(subset.map((t) => t.v2)) };
  }

  const portfolioSummary = summarizeByPreset(portfolioByPreset);
  const xlSummary = summarizeByPreset(xlByPreset);
  const crSummary = summarizeByPreset(crByPreset);

  const allPortfolioTiles = Object.values(portfolioByPreset).flat();
  const allXlTiles = Object.values(xlByPreset).flat();
  const allCrTiles = Object.values(crByPreset).flat();

  const report = {
    generatedAt: new Date().toISOString(),
    label: 'BUILD_012_regression',
    generationTimeMs: elapsedMs,
    scenarioSuite: {
      n: scenarioTiles.length,
      v1: scenarioV1,
      v2: scenarioV2,
      byLayoutClass: scenarioByLayoutClass,
    },
    portfolio100: {
      n: allPortfolioTiles.length,
      overallV1: stats(allPortfolioTiles.map((t) => t.v1)),
      overallV2: stats(allPortfolioTiles.map((t) => t.v2)),
      byStyleDna: portfolioSummary,
    },
    xlPortfolio500: {
      n: allXlTiles.length,
      overallV1: stats(allXlTiles.map((t) => t.v1)),
      overallV2: stats(allXlTiles.map((t) => t.v2)),
      byStyleDna: xlSummary,
    },
    commercialRealityCheck1500: {
      n: allCrTiles.length,
      overallV1: stats(allCrTiles.map((t) => t.v1)),
      overallV2: stats(allCrTiles.map((t) => t.v2)),
      byStyleDna: crSummary,
    },
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'BUILD_012_regression.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);

  console.log(`\n--- Section 9: Commercial Validation (target presets) ---`);
  for (const id of ['minimalBotanical', 'boutiquePackaging', 'premiumTextile']) {
    const s = crSummary[id];
    console.log(`${id}: V1 mean=${s.v1.mean} (fail ${s.v1.failureRate}%) -> V2 mean=${s.v2.mean} (fail ${s.v2.failureRate}%), delta=+${s.delta}`);
  }
  console.log(`\n--- All 15 presets (1500-pattern tier) ---`);
  for (const styleId of STYLE_IDS) {
    const s = crSummary[styleId];
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS[styleId]);
    console.log(`${styleId} (${profile.regularityClass}): V1=${s.v1.mean} (fail ${s.v1.failureRate}%) -> V2=${s.v2.mean} (fail ${s.v2.failureRate}%), delta=+${s.delta}`);
  }
  console.log(`\nGeneration time: ${elapsedMs}ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
