import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTile } from '../src/engine/tile';
import { defaultParams } from '../src/engine/defaults';
import type { GenerateParams, LayoutId } from '../src/engine/types';
import { computeMetrics, computeOverallScore, computeHeroVisibilityScore, SOFT_PENALTY_RULES, type CompositionMetrics } from '../src/engine/scoring';
import { computePatternReadability, type PatternReadabilityResult } from '../src/engine/patternReadability';
import { detectVisualIssues, type VisualIssueId } from '../src/critic/visualAnalysis';
import { STYLE_DNA_PRESETS, resolveStyleDna, computeStyleDnaConsistency } from '../src/engine/styleDna';
import { evaluateProductTargets } from '../src/collection/productTargets';
import { countNodes } from '../src/engine/svgGeometry';
import { GENERATORS } from '../src/generators';

// Build 002, Section 1 — Reporting Harness Foundation. A permanent,
// committed, re-runnable measurement tool (not a throwaway scratch
// script) over two FROZEN, reproducible input sets:
//
//   1. The 30-scenario suite: 10 fixed layout x category combinations,
//      each run at 3 fixed seeds ('ba-1'/'ba-2'/'ba-3') = 30 tiles.
//   2. The 100-pattern portfolio: all 15 STYLE_DNA_PRESETS (in the exact
//      order STYLE_DNA_PRESETS declares them — a plain JS object literal,
//      so key order is fixed insertion order) x 7 fixed seeds ('p-1'..
//      'p-7') = 105 pairs, deterministically trimmed to the first 100 in
//      preset-major order (so the last preset, softWatercolorInspired,
//      only contributes its first 2 seeds — the 5 dropped pairs are
//      recorded explicitly in the output's `portfolio.droppedPairs`, never
//      silently discarded).
//
// Every reported score comes from real, already-implemented engine code
// (engine/scoring.ts, engine/patternReadability.ts, critic/visualAnalysis.ts,
// engine/styleDna.ts, collection/productTargets.ts, engine/svgGeometry.ts) —
// this script performs no new geometry or scoring math of its own beyond
// stats() (mean/median/p10/p90/min/max) and named-rate aggregation.
//
// Two commercial scores per pattern, per Build 002 Section 8's explicit
// separation requirement:
//   - Absolute Commercial Quality: computeOverallScore(metrics, 'stockClean').
//     'stockClean' is used for every single pattern regardless of which
//     Style DNA (if any) produced it — a fixed, style-blind weighting is
//     what makes this number comparable across every preset, per the
//     brief's explicit requirement ("must remain comparable across all
//     Style DNA presets").
//   - Style-Fit Quality: computeStyleDnaConsistency(metrics, dna) — only
//     defined for portfolio patterns (each tied to one real Style DNA);
//     secondary/diagnostic only, never blended into the Absolute score.
//
// "Failure" for a per-pattern principal metric reuses GATE_MIN_OVERALL /
// READABILITY_FLOOR / computeOverallScore's own penaltyReasons cutoff — all
// already the same real "50" threshold this codebase already established
// elsewhere (critic/qualityGate.ts, engine/patternReadability.ts,
// engine/scoring.ts) — not a new number invented for this report.
const METRIC_FAILURE_FLOOR = 50;

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const at = (p: number) => (n === 0 ? 0 : sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))]);
  const mean = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    n,
    mean: round2(mean),
    median: round2(at(0.5)),
    p10: round2(at(0.1)),
    p90: round2(at(0.9)),
    min: round2(n > 0 ? sorted[0] : 0),
    max: round2(n > 0 ? sorted[n - 1] : 0),
    failureRate: n > 0 ? round2((values.filter((v) => v < METRIC_FAILURE_FLOOR).length / n) * 100) : 0,
  };
}

const PRINCIPAL_METRIC_KEYS: Array<keyof CompositionMetrics> = [
  'composition', 'spacing', 'quadrantBalance', 'horizontalBalance', 'verticalBalance', 'visualCenterOffset',
  'occupancyRatio', 'densityVariance', 'largestEmptyRegion', 'hierarchy', 'scaleDiversity', 'rotationDiversity',
  'colorBalance', 'paletteContrast', 'overlapQuality', 'heroSeparation', 'edgeDensity', 'adjacencyRepetition',
  'seamlessIntegrity', 'svgHealth', 'flowCoherence', 'rhythmRegularity', 'motifShapeDiversity', 'cornerContinuity',
  'heroDetailRatio', 'isolationScore', 'clusterCohesion', 'gridAppearanceScore', 'spacingUniformity',
];

interface EvalResult {
  label: string;
  layoutId: LayoutId;
  categoryId: string;
  seed: string;
  styleDnaId?: string;
  metrics: CompositionMetrics;
  absoluteCommercialQuality: number;
  heroVisibility: number;
  readability: PatternReadabilityResult;
  nodeCount: number;
  issues: Record<VisualIssueId, boolean>;
  styleFitQuality?: number;
  productTargetFit?: number;
}

function evaluate(label: string, params: GenerateParams, styleDnaId?: string): EvalResult {
  const tile = buildTile(params);
  const metrics = computeMetrics(tile);
  const absoluteCommercialQuality = computeOverallScore(metrics, 'stockClean').score;
  const heroVisibility = computeHeroVisibilityScore(metrics);
  const readability = computePatternReadability(tile, metrics);
  const nodeCount = countNodes(tile.svg);
  const issueList = detectVisualIssues(tile, metrics);
  const issues = Object.fromEntries(issueList.map((i) => [i.id, i.detected])) as Record<VisualIssueId, boolean>;

  let styleFitQuality: number | undefined;
  let productTargetFit: number | undefined;
  if (styleDnaId) {
    const dna = STYLE_DNA_PRESETS[styleDnaId];
    styleFitQuality = computeStyleDnaConsistency(metrics, dna);
    const evaluations = evaluateProductTargets({ categoryId: params.categoryId, tileSize: params.tileSize, density: params.density, keywordText: dna.label });
    productTargetFit = Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length);
  }

  return { label, layoutId: params.layoutId, categoryId: params.categoryId, seed: params.seed, styleDnaId, metrics, absoluteCommercialQuality, heroVisibility, readability, nodeCount, issues, styleFitQuality, productTargetFit };
}

// ---- Frozen 30-scenario suite ----
const SCENARIO_SUITE: Array<{ layoutId: LayoutId; categoryId: string }> = [
  { layoutId: 'scatter', categoryId: 'botanical' },
  { layoutId: 'scatter', categoryId: 'geometric' },
  { layoutId: 'bouquet', categoryId: 'botanical' },
  { layoutId: 'toss', categoryId: 'tropical' },
  { layoutId: 'sCurve', categoryId: 'botanical' },
  { layoutId: 'heroFlow', categoryId: 'geometric' },
  { layoutId: 'heroScatter', categoryId: 'mandala' },
  { layoutId: 'densePremium', categoryId: 'botanical' },
  { layoutId: 'radial', categoryId: 'mandala' },
  { layoutId: 'airy', categoryId: 'botanical' },
];
const SCENARIO_SEEDS = ['ba-1', 'ba-2', 'ba-3'];

function buildScenarioParams(layoutId: LayoutId, categoryId: string, seed: string): GenerateParams {
  const generator = GENERATORS[categoryId];
  return { ...defaultParams(), categoryId, layoutId, motifSize: generator.defaultMotifSize, seed };
}

function runScenarioSuite(): EvalResult[] {
  const results: EvalResult[] = [];
  for (const { layoutId, categoryId } of SCENARIO_SUITE) {
    for (const seed of SCENARIO_SEEDS) {
      results.push(evaluate(`${layoutId}/${categoryId}@${seed}`, buildScenarioParams(layoutId, categoryId, seed)));
    }
  }
  return results;
}

// ---- Frozen 100-pattern portfolio ----
const PORTFOLIO_SEEDS = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7'];
const STYLE_IDS = Object.keys(STYLE_DNA_PRESETS);

function buildPortfolioPairs(): Array<{ styleId: string; seed: string }> {
  const all: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of PORTFOLIO_SEEDS) all.push({ styleId, seed });
  return all;
}

function buildPortfolioParams(styleId: string, seed: string): GenerateParams {
  const dna = STYLE_DNA_PRESETS[styleId];
  const resolved = resolveStyleDna(dna, seed);
  return { ...defaultParams(), ...resolved, seed };
}

function runPortfolio(): { results: EvalResult[]; droppedPairs: Array<{ styleId: string; seed: string }> } {
  const allPairs = buildPortfolioPairs();
  const kept = allPairs.slice(0, 100);
  const droppedPairs = allPairs.slice(100);
  const results = kept.map(({ styleId, seed }) => evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
  return { results, droppedPairs };
}

// ---- Aggregation ----
function aggregateMetrics(results: EvalResult[]) {
  const perMetric: Record<string, ReturnType<typeof stats>> = {};
  for (const key of PRINCIPAL_METRIC_KEYS) {
    perMetric[key] = stats(results.map((r) => r.metrics[key]));
  }
  perMetric.absoluteCommercialQuality = stats(results.map((r) => r.absoluteCommercialQuality));
  perMetric.heroVisibility = stats(results.map((r) => r.heroVisibility));
  perMetric.readabilityThumbnail200 = stats(results.map((r) => r.readability.thumbnail200));
  perMetric.readabilityThumbnail400 = stats(results.map((r) => r.readability.thumbnail400));
  perMetric.readabilityZoom800 = stats(results.map((r) => r.readability.zoom800));
  perMetric.nodeCount = stats(results.map((r) => r.nodeCount));
  const withStyleFit = results.filter((r) => r.styleFitQuality !== undefined);
  if (withStyleFit.length > 0) {
    perMetric.styleFitQuality = stats(withStyleFit.map((r) => r.styleFitQuality!));
    perMetric.productTargetFit = stats(withStyleFit.map((r) => r.productTargetFit!));
  }
  return perMetric;
}

function namedPenaltyRates(results: EvalResult[]) {
  const rates: Record<string, number> = {};
  for (const rule of SOFT_PENALTY_RULES) {
    const triggered = results.filter((r) => rule.check(r.metrics)).length;
    rates[rule.id] = Math.round((triggered / results.length) * 10000) / 100;
  }
  return rates;
}

function visualIssueRates(results: EvalResult[]) {
  const rates: Record<string, number> = {};
  const ids = Object.keys(results[0]?.issues ?? {}) as VisualIssueId[];
  for (const id of ids) {
    const triggered = results.filter((r) => r.issues[id]).length;
    rates[id] = Math.round((triggered / results.length) * 10000) / 100;
  }
  return rates;
}

function groupBy<T, K extends string>(items: T[], keyFn: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = keyFn(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

function breakdownBy<K extends string>(results: EvalResult[], keyFn: (r: EvalResult) => K) {
  const groups = groupBy(results, keyFn);
  const out: Record<string, ReturnType<typeof aggregateMetrics> & { namedPenaltyRates: Record<string, number>; visualIssueRates: Record<string, number>; n: number }> = {};
  for (const [k, items] of Object.entries(groups) as Array<[string, EvalResult[]]>) {
    out[k] = { ...aggregateMetrics(items), namedPenaltyRates: namedPenaltyRates(items), visualIssueRates: visualIssueRates(items), n: items.length };
  }
  return out;
}

const NODE_BUDGET = 8000;

function main() {
  const outArg = process.argv[2] ?? 'baseline';
  const startedAt = Date.now();

  const scenarioResults = runScenarioSuite();
  const { results: portfolioResults, droppedPairs } = runPortfolio();
  const elapsedMs = Date.now() - startedAt;

  const report = {
    generatedAt: new Date().toISOString(),
    label: outArg,
    generationTimeMs: elapsedMs,
    scenarioSuite: {
      seeds: SCENARIO_SEEDS,
      scenarios: SCENARIO_SUITE,
      count: scenarioResults.length,
      aggregate: aggregateMetrics(scenarioResults),
      namedPenaltyRates: namedPenaltyRates(scenarioResults),
      visualIssueRates: visualIssueRates(scenarioResults),
      byLayout: breakdownBy(scenarioResults, (r) => r.layoutId),
      byCategory: breakdownBy(scenarioResults, (r) => r.categoryId),
      results: scenarioResults,
      nodeBudgetFailures: scenarioResults.filter((r) => r.nodeCount > NODE_BUDGET).map((r) => ({ label: r.label, nodeCount: r.nodeCount })),
    },
    portfolio: {
      seeds: PORTFOLIO_SEEDS,
      styleIds: STYLE_IDS,
      count: portfolioResults.length,
      droppedPairs,
      aggregate: aggregateMetrics(portfolioResults),
      namedPenaltyRates: namedPenaltyRates(portfolioResults),
      visualIssueRates: visualIssueRates(portfolioResults),
      byStyleDna: breakdownBy(portfolioResults, (r) => r.styleDnaId ?? 'unknown'),
      byLayout: breakdownBy(portfolioResults, (r) => r.layoutId),
      byCategory: breakdownBy(portfolioResults, (r) => r.categoryId),
      results: portfolioResults,
      nodeBudgetFailures: portfolioResults.filter((r) => r.nodeCount > NODE_BUDGET).map((r) => ({ label: r.label, nodeCount: r.nodeCount })),
    },
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${outArg}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`Scenario suite (n=${scenarioResults.length}): Absolute Commercial Quality mean=${report.scenarioSuite.aggregate.absoluteCommercialQuality.mean}, median=${report.scenarioSuite.aggregate.absoluteCommercialQuality.median}`);
  console.log(`Portfolio (n=${portfolioResults.length}): Absolute Commercial Quality mean=${report.portfolio.aggregate.absoluteCommercialQuality.mean}, median=${report.portfolio.aggregate.absoluteCommercialQuality.median}`);
  console.log(`Portfolio Palette Contrast mean=${report.portfolio.aggregate.paletteContrast.mean}`);
  console.log(`Portfolio Hero Visibility mean=${report.portfolio.aggregate.heroVisibility.mean}`);
  console.log(`Portfolio Readability@200px mean=${report.portfolio.aggregate.readabilityThumbnail200.mean}`);
  console.log(`Portfolio repeatedScale rate=${report.portfolio.visualIssueRates.repeatedScale}%`);
  console.log(`Generation time: ${elapsedMs}ms`);
}

main();
