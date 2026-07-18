import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildTileWithHeroRetry } from '../src/engine/heroDetector';
import { defaultParams } from '../src/engine/defaults';
import type { GenerateParams, LayoutId, TileData } from '../src/engine/types';
import { computeOverallScore, computeHeroVisibilityScore, SOFT_PENALTY_RULES, type CompositionMetrics } from '../src/engine/scoring';
import { computePatternBeautyScore } from '../src/engine/patternBeautyScore';
import { computePatternReadability, type PatternReadabilityResult } from '../src/engine/patternReadability';
import { detectVisualIssues, type VisualIssueId } from '../src/critic/visualAnalysis';
import { STYLE_DNA_PRESETS, resolveStyleDna, computeStyleDnaConsistency } from '../src/engine/styleDna';
import { evaluateProductTargets } from '../src/collection/productTargets';
import { countNodes, extractInstances } from '../src/engine/svgGeometry';
import { computeLuxuryCompositionScore, type LuxuryCompositionScore } from '../src/engine/luxuryComposition';
import { GENERATORS } from '../src/generators';
import { computeBotanicalBeautyMetrics } from '../src/engine/botanicalBeautyMetrics';
import { computeIllustrationQualityV2, type IllustrationQualityV2 } from '../src/engine/illustrationQualityV2';
import {
  computeIllustrationQuality,
  computeVisualRichness,
  computeSpeciesDiversity,
  computeCompositionDiversity,
  computeClusterDiversity,
  computeHeroDiversity,
  computeHeroArchetypeDiversity,
  computeSignatureFingerprintDistinctness,
  computePortfolioConsistency,
  detectSequentialStyleDrift,
} from '../src/engine/portfolioQuality';
import type { BotanicalFamily } from '../src/generators/botanicalFamilies';
import { LAYOUTS } from '../src/layouts';
import { evaluateCommercialPatternCritique, type CommercialPatternCritique } from '../src/critic/commercialPatternCritic';
import { computeCommercialStyleAnalysis, type CommercialStyleAnalysis } from '../src/engine/commercialStyleAnalysis';
import { computeCommercialAppealScoreV2, type CommercialAppealScoreV2 } from '../src/critic/commercialAppealScore';

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

export function stats(values: number[]) {
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

export interface EvalResult {
  label: string;
  layoutId: LayoutId;
  categoryId: string;
  seed: string;
  styleDnaId?: string;
  metrics: CompositionMetrics;
  absoluteCommercialQuality: number;
  heroVisibility: number;
  patternBeautyScore: number;
  readability: PatternReadabilityResult;
  nodeCount: number;
  issues: Record<VisualIssueId, boolean>;
  styleFitQuality?: number;
  productTargetFit?: number;
  /** Build 005, Section 9: only meaningful for the botanical generator —
   * undefined for every other category, same convention as
   * GenerateParams.botanicalFamily itself. */
  botanicalFamily?: BotanicalFamily;
  illustrationQuality?: number;
  visualRichness?: number;
  /** Build 009, Section 6 (Silhouette Optimization): only set for tiles
   * that actually built one or more premium heroes -- see
   * `TileData.premiumHeroArchetypes`'s own doc comment. */
  premiumHeroArchetypes?: string[];
  /** Build 007, Section 8 (Illustration Quality Score V2): same category
   * gating as illustrationQuality/visualRichness above -- only meaningful
   * for a botanical tile. */
  illustrationQualityV2?: IllustrationQualityV2;
  /** Build 006, Section 8: always computed (unlike illustrationQuality/
   * visualRichness, no category-gating needed — every dimension here
   * already handles a missing botanical input honestly). */
  commercialPatternCritique: CommercialPatternCritique;
  /** Build 006, Section 1: same "always real, never padded" convention —
   * `computeCommercialStyleAnalysis` itself only scores dimensions whose
   * real input was actually provided. */
  commercialStyleAnalysis: CommercialStyleAnalysis;
  /** Build 009, Section 7 (Luxury Composition Rules): always computed,
   * same "no category gating needed" convention as commercialPatternCritique
   * -- every dimension already handles a missing hero honestly (see
   * `computeGoldenBalance`'s own doc comment). */
  luxuryComposition: LuxuryCompositionScore;
  /** Build 011, Section 9 (Commercial Appeal Score V2): the umbrella
   * combining all 6 brief-named commercial-evaluation dimensions from
   * already-real sub-scores this tile already computed above.
   * `collectionConsistency` stays undefined here (a single-tile
   * evaluation, not a portfolio one) -- see runConsistencyPortfolio below
   * for where that 6th dimension gets attached at the portfolio level. */
  commercialAppealScoreV2: CommercialAppealScoreV2;
}

/** Build 013, Section 4 (Large Portfolio Generation): the Portfolio
 * Intelligence generation script needs the raw `TileData` too (for the
 * similarity fingerprint's shape-signature component, `src/portfolio/
 * fingerprint.ts`) — `evaluate()`'s own public contract (just `EvalResult`)
 * stays exactly as every existing caller/test already depends on; this
 * sibling function factors out the identical computation once and adds the
 * tile alongside it, so a portfolio-generation caller never pays for a
 * second `buildTileWithHeroRetry` call just to get the SVG tree `evaluate()`
 * already had in hand internally. */
export function evaluateWithTile(label: string, params: GenerateParams, styleDnaId?: string): { result: EvalResult; tile: TileData } {
  // Build 003, Part 11 (Hero Detector): measures the real, shipped
  // behavior — see engine/heroDetector.ts — rather than a raw single
  // buildTile call the app itself no longer makes for a fresh generation.
  // Reuses the metrics it already computed internally instead of paying
  // for a second full computeMetrics pass over the same tile.
  const { tileData: tile, metrics } = buildTileWithHeroRetry(params);
  const absoluteCommercialQuality = computeOverallScore(metrics, 'stockClean').score;
  const heroVisibility = computeHeroVisibilityScore(metrics);
  const patternBeautyScore = computePatternBeautyScore(metrics).overall;
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

  let illustrationQuality: number | undefined;
  let visualRichness: number | undefined;
  let illustrationQualityV2: IllustrationQualityV2 | undefined;
  let botanicalMetrics: ReturnType<typeof computeBotanicalBeautyMetrics> | undefined;
  if (params.categoryId === 'botanical') {
    botanicalMetrics = computeBotanicalBeautyMetrics(tile, metrics);
    illustrationQuality = computeIllustrationQuality(botanicalMetrics);
    visualRichness = computeVisualRichness(botanicalMetrics);
    illustrationQualityV2 = computeIllustrationQualityV2(tile, metrics, botanicalMetrics);
  }

  // Build 006, Section 8 (Commercial Pattern Critic): reuses the exact
  // same keywordText convention this file's own pre-existing
  // productTargetFit block already established (Style DNA label when one
  // was used, else the plain category label) — never a fabricated intent
  // string.
  const keywordText = styleDnaId ? STYLE_DNA_PRESETS[styleDnaId].label : params.categoryId;
  const commercialPatternCritique = evaluateCommercialPatternCritique({
    metrics, categoryId: params.categoryId, tileSize: params.tileSize, density: params.density, keywordText, heroVisibility, botanical: botanicalMetrics,
  });
  // Build 006, Section 1 (Commercial Style Analysis Engine).
  const commercialStyleAnalysis = computeCommercialStyleAnalysis({
    metrics, heroVisibility, botanical: botanicalMetrics, visualRichness,
  });
  // Build 009, Section 7 (Luxury Composition Rules).
  const luxuryComposition = computeLuxuryCompositionScore(extractInstances(tile), params.tileSize, metrics);
  // Build 011, Section 9 (Commercial Appeal Score V2).
  const commercialAppealScoreV2 = computeCommercialAppealScoreV2({ critique: commercialPatternCritique, heroVisibility });

  const result: EvalResult = {
    label,
    layoutId: params.layoutId,
    categoryId: params.categoryId,
    seed: params.seed,
    styleDnaId,
    metrics,
    absoluteCommercialQuality,
    heroVisibility,
    patternBeautyScore,
    commercialPatternCritique,
    commercialStyleAnalysis,
    luxuryComposition,
    commercialAppealScoreV2,
    readability,
    nodeCount,
    issues,
    styleFitQuality,
    productTargetFit,
    botanicalFamily: params.botanicalFamily,
    illustrationQuality,
    visualRichness,
    illustrationQualityV2,
    premiumHeroArchetypes: tile.premiumHeroArchetypes,
  };
  return { result, tile };
}

/** Original public entrypoint, unchanged in behavior/shape for every
 * existing caller — now a one-line wrapper over `evaluateWithTile`. */
export function evaluate(label: string, params: GenerateParams, styleDnaId?: string): EvalResult {
  return evaluateWithTile(label, params, styleDnaId).result;
}

// ---- Frozen 30-scenario suite ----
export const SCENARIO_SUITE: Array<{ layoutId: LayoutId; categoryId: string }> = [
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
export const SCENARIO_SEEDS = ['ba-1', 'ba-2', 'ba-3'];

export function buildScenarioParams(layoutId: LayoutId, categoryId: string, seed: string): GenerateParams {
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
export const STYLE_IDS = Object.keys(STYLE_DNA_PRESETS);

function buildPortfolioPairs(): Array<{ styleId: string; seed: string }> {
  const all: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of PORTFOLIO_SEEDS) all.push({ styleId, seed });
  return all;
}

export function buildPortfolioParams(styleId: string, seed: string): GenerateParams {
  const dna = STYLE_DNA_PRESETS[styleId];
  const resolved = resolveStyleDna(dna, seed);
  return { ...defaultParams(), ...resolved, seed };
}

// Build 010, Section 9 (Commercial Validation Suite): the Signature Style
// Engine's (Section 8) 3 new resolved fields (depthStrength/
// professionalRules/hierarchy.premiumRhythm) are all derived deterministically
// from each Style DNA preset's own already-declared `hierarchyPreset`/
// `premiumHero` fields (see styleDna.ts) -- not seed-dependent -- so this is
// computed once per preset (any fixed seed) rather than once per
// portfolio/large-portfolio tile, following `computeSignatureFingerprintDistinctness`'s
// own doc comment on what it measures.
export function computeSignatureFingerprints() {
  return STYLE_IDS.map((styleId) => {
    const patch = resolveStyleDna(STYLE_DNA_PRESETS[styleId], 'signature-fingerprint-check');
    return { depthStrength: patch.depthStrength, professionalRules: patch.professionalRules, premiumRhythm: patch.hierarchy?.premiumRhythm };
  });
}

function runPortfolio(): { results: EvalResult[]; droppedPairs: Array<{ styleId: string; seed: string }> } {
  const allPairs = buildPortfolioPairs();
  const kept = allPairs.slice(0, 100);
  const droppedPairs = allPairs.slice(100);
  const results = kept.map(({ styleId, seed }) => evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
  return { results, droppedPairs };
}

// ---- Build 006, Section 9: frozen 300-pattern Large Portfolio ----
// 15 STYLE_DNA_PRESETS x 20 fixed seeds = exactly 300, no trimming needed
// (unlike the 100-pattern portfolio's 105->100 trim) -- reuses the exact
// same `buildPortfolioParams`/`evaluate` pipeline, just over more seeds,
// so every number here is directly comparable to the 100-pattern
// portfolio's own numbers. Gated behind an explicit CLI flag (see `main`)
// since it roughly triples this script's own runtime -- routine label runs
// (Sections 1-8's own before/after passes) don't pay for it.
const LARGE_PORTFOLIO_SEEDS = Array.from({ length: 20 }, (_, i) => `l-${i + 1}`);

function buildLargePortfolioPairs(): Array<{ styleId: string; seed: string }> {
  const all: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of LARGE_PORTFOLIO_SEEDS) all.push({ styleId, seed });
  return all;
}

function runLargePortfolio(): EvalResult[] {
  return buildLargePortfolioPairs().map(({ styleId, seed }) => evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
}

// ---- Build 010, Section 10: frozen 500-pattern XL Portfolio ----
// The brief asks specifically for a 500-pattern evaluation (larger than
// Build 006-009's own established 300-pattern Large Portfolio, which stays
// exactly as-is above so every prior build's stored baseline JSON remains
// comparable to future `large` runs) -- this is an additive third tier,
// not a resize of the existing one, following the exact same "extend,
// don't redefine" discipline this whole build applied to every reused
// engine. 15 STYLE_DNA_PRESETS x 34 seeds = 510, deterministically trimmed
// to the first 500 in preset-major order -- the exact same trim/
// droppedPairs convention `runPortfolio` already established for its own
// 105->100 trim, never silently dropped.
export const XL_PORTFOLIO_SEEDS = Array.from({ length: 34 }, (_, i) => `xl-${i + 1}`);

function buildXlPortfolioPairs(): Array<{ styleId: string; seed: string }> {
  const all: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of XL_PORTFOLIO_SEEDS) all.push({ styleId, seed });
  return all;
}

function runXlPortfolio(): { results: EvalResult[]; droppedPairs: Array<{ styleId: string; seed: string }> } {
  const allPairs = buildXlPortfolioPairs();
  const kept = allPairs.slice(0, 500);
  const droppedPairs = allPairs.slice(500);
  const results = kept.map(({ styleId, seed }) => evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
  return { results, droppedPairs };
}

// ---- Build 011, Section 8/10: frozen 1000-pattern Consistency Portfolio ----
// The brief asks specifically for a "1000 Pattern Consistency Portfolio" —
// a fourth, additive tier (same "extend, don't redefine" discipline the
// 500-pattern XL Portfolio above already established over the 300-pattern
// Large Portfolio) whose whole purpose is answering Section 8's own brief
// question per preset: "do these many independent generations of one
// Style DNA preset feel like one coherent premium brand?" — not just a
// bigger sample for the same aggregate stats every other tier already
// reports. 15 STYLE_DNA_PRESETS x 67 seeds = 1005, trimmed to the first
// 1000 in preset-major order, the same trim/droppedPairs convention every
// other tier already uses.
const CONSISTENCY_PORTFOLIO_SEEDS = Array.from({ length: 67 }, (_, i) => `c-${i + 1}`);

function buildConsistencyPortfolioPairs(): Array<{ styleId: string; seed: string }> {
  const all: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) for (const seed of CONSISTENCY_PORTFOLIO_SEEDS) all.push({ styleId, seed });
  return all;
}

function runConsistencyPortfolio(): { results: EvalResult[]; droppedPairs: Array<{ styleId: string; seed: string }> } {
  const allPairs = buildConsistencyPortfolioPairs();
  const kept = allPairs.slice(0, 1000);
  const droppedPairs = allPairs.slice(1000);
  const results = kept.map(({ styleId, seed }) => evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
  return { results, droppedPairs };
}

/** Per-preset Portfolio Consistency (`computePortfolioConsistency`,
 * engine/portfolioQuality.ts) and Sequential Style Drift
 * (`detectSequentialStyleDrift`) over one preset's own slice of the
 * Consistency Portfolio -- `CONSISTENCY_PORTFOLIO_SEEDS`' fixed `c-1..c-N`
 * ordering is the real generation order `detectSequentialStyleDrift`
 * compares first-half-vs-second-half over, not an arbitrary resort. */
export function computeConsistencyByStyleDna(results: EvalResult[]) {
  const groups = groupBy(results, (r) => r.styleDnaId ?? 'unknown');
  const out: Record<string, { consistency: number; drift: ReturnType<typeof detectSequentialStyleDrift>; n: number }> = {};
  for (const [styleId, items] of Object.entries(groups) as Array<[string, EvalResult[]]>) {
    const consistency = computePortfolioConsistency(
      items.map((r) => ({
        absoluteCommercialQuality: r.absoluteCommercialQuality,
        luxuryCompositionOverall: r.luxuryComposition.overall,
        luxuryFeeling: r.commercialPatternCritique.luxuryFeeling,
        styleDnaConsistency: r.styleFitQuality,
      })),
    );
    const drift = detectSequentialStyleDrift(items.map((r) => r.absoluteCommercialQuality));
    out[styleId] = { consistency, drift, n: items.length };
  }
  return out;
}

// ---- Aggregation ----
export function aggregateMetrics(results: EvalResult[]) {
  const perMetric: Record<string, ReturnType<typeof stats>> = {};
  for (const key of PRINCIPAL_METRIC_KEYS) {
    perMetric[key] = stats(results.map((r) => r.metrics[key]));
  }
  perMetric.absoluteCommercialQuality = stats(results.map((r) => r.absoluteCommercialQuality));
  perMetric.heroVisibility = stats(results.map((r) => r.heroVisibility));
  perMetric.patternBeautyScore = stats(results.map((r) => r.patternBeautyScore));
  perMetric.readabilityThumbnail200 = stats(results.map((r) => r.readability.thumbnail200));
  perMetric.readabilityThumbnail400 = stats(results.map((r) => r.readability.thumbnail400));
  perMetric.readabilityZoom800 = stats(results.map((r) => r.readability.zoom800));
  perMetric.nodeCount = stats(results.map((r) => r.nodeCount));
  const withStyleFit = results.filter((r) => r.styleFitQuality !== undefined);
  if (withStyleFit.length > 0) {
    perMetric.styleFitQuality = stats(withStyleFit.map((r) => r.styleFitQuality!));
    perMetric.productTargetFit = stats(withStyleFit.map((r) => r.productTargetFit!));
  }
  // Build 005, Section 9: only botanical-category results carry these.
  const withIllustrationQuality = results.filter((r) => r.illustrationQuality !== undefined);
  if (withIllustrationQuality.length > 0) {
    perMetric.illustrationQuality = stats(withIllustrationQuality.map((r) => r.illustrationQuality!));
    perMetric.visualRichness = stats(withIllustrationQuality.map((r) => r.visualRichness!));
  }
  // Build 007, Section 8 (Illustration Quality Score V2): same category
  // gating; only the sub-dimensions genuinely new to this build get their
  // own reported stat (botanicalRealism/illustrationQuality/silhouetteQuality
  // already have a home above/elsewhere -- listing them again here would be
  // a duplicate report, not new information).
  const withIllustrationQualityV2 = results.filter((r) => r.illustrationQualityV2 !== undefined);
  if (withIllustrationQualityV2.length > 0) {
    perMetric.illustrationQualityV2Overall = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.overall));
    perMetric.bouquetQuality = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.bouquetQuality));
    perMetric.gestureQuality = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.gestureQuality));
    perMetric.leafRealism = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.leafRealism));
    perMetric.flowerRealism = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.flowerRealism));
    perMetric.premiumFeel = stats(withIllustrationQualityV2.map((r) => r.illustrationQualityV2!.premiumFeel));
  }
  // Build 006, Section 8/1: always present (unlike illustrationQuality),
  // no category filter needed.
  perMetric.luxuryFeeling = stats(results.map((r) => r.commercialPatternCritique.luxuryFeeling));
  perMetric.editorialFeeling = stats(results.map((r) => r.commercialPatternCritique.editorialFeeling));
  perMetric.premiumFeeling = stats(results.map((r) => r.commercialPatternCritique.premiumFeeling));
  perMetric.fabricFeeling = stats(results.map((r) => r.commercialPatternCritique.fabricFeeling));
  perMetric.wallpaperFeeling = stats(results.map((r) => r.commercialPatternCritique.wallpaperFeeling));
  perMetric.giftWrapFeeling = stats(results.map((r) => r.commercialPatternCritique.giftWrapFeeling));
  perMetric.visualStory = stats(results.map((r) => r.commercialPatternCritique.visualStory));
  perMetric.commercialStyleFit = stats(results.map((r) => r.commercialStyleAnalysis.overallFit));
  // Build 009, Section 7 (Luxury Composition Rules): always present, same
  // "no category gating" convention as commercialPatternCritique above.
  perMetric.luxuryComposition = stats(results.map((r) => r.luxuryComposition.overall));
  perMetric.goldenBalance = stats(results.map((r) => r.luxuryComposition.goldenBalance));
  perMetric.breathingRoom = stats(results.map((r) => r.luxuryComposition.breathingRoom));
  perMetric.clusterRhythm = stats(results.map((r) => r.luxuryComposition.clusterRhythm));
  perMetric.hierarchyClarity = stats(results.map((r) => r.luxuryComposition.hierarchyClarity));
  perMetric.heroIsolation = stats(results.map((r) => r.luxuryComposition.heroIsolation));
  perMetric.elegantOverlap = stats(results.map((r) => r.luxuryComposition.elegantOverlap));
  perMetric.controlledComplexity = stats(results.map((r) => r.luxuryComposition.controlledComplexity));
  const withBotanicalRealism = results.filter((r) => r.commercialPatternCritique.botanicalRealism !== undefined);
  if (withBotanicalRealism.length > 0) {
    perMetric.botanicalRealism = stats(withBotanicalRealism.map((r) => r.commercialPatternCritique.botanicalRealism!));
  }
  // Build 011, Section 9 (Commercial Appeal Score V2): always present, same
  // "no category gating" convention as commercialPatternCritique/luxuryComposition above.
  perMetric.commercialAppealScoreV2 = stats(results.map((r) => r.commercialAppealScoreV2.overall));
  perMetric.shelfImpact = stats(results.map((r) => r.commercialAppealScoreV2.shelfImpact));
  perMetric.productSuitability = stats(results.map((r) => r.commercialAppealScoreV2.productSuitability));
  return perMetric;
}

export function namedPenaltyRates(results: EvalResult[]) {
  const rates: Record<string, number> = {};
  for (const rule of SOFT_PENALTY_RULES) {
    const triggered = results.filter((r) => rule.check(r.metrics)).length;
    rates[rule.id] = Math.round((triggered / results.length) * 10000) / 100;
  }
  return rates;
}

export function visualIssueRates(results: EvalResult[]) {
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

export function breakdownBy<K extends string>(results: EvalResult[], keyFn: (r: EvalResult) => K) {
  const groups = groupBy(results, keyFn);
  const out: Record<string, ReturnType<typeof aggregateMetrics> & { namedPenaltyRates: Record<string, number>; visualIssueRates: Record<string, number>; n: number }> = {};
  for (const [k, items] of Object.entries(groups) as Array<[string, EvalResult[]]>) {
    out[k] = { ...aggregateMetrics(items), namedPenaltyRates: namedPenaltyRates(items), visualIssueRates: visualIssueRates(items), n: items.length };
  }
  return out;
}

export const NODE_BUDGET = 8000;

function main() {
  const outArg = process.argv[2] ?? 'baseline';
  // Build 006, Section 9: `large` as a 3rd CLI arg opts into the
  // 300-pattern Large Portfolio Evaluation on top of the existing
  // scenario suite + 100-pattern portfolio -- opt-in because it roughly
  // triples this script's runtime, and Sections 1-8's own before/after
  // passes don't need it.
  const runLarge = process.argv[3] === 'large';
  // Build 010, Section 10: `xl` opts into the 500-pattern XL Portfolio
  // Evaluation instead of (not in addition to -- keeps runtime bounded the
  // same way `large` already does) the 300-pattern one.
  const runXl = process.argv[3] === 'xl';
  // Build 011, Section 10: `consistency` opts into the 1000-pattern
  // Consistency Portfolio instead of (same mutually-exclusive-tier
  // convention as `large`/`xl`) the other two.
  const runConsistency = process.argv[3] === 'consistency';
  const startedAt = Date.now();

  const scenarioResults = runScenarioSuite();
  const { results: portfolioResults, droppedPairs } = runPortfolio();
  const largePortfolioResults = runLarge ? runLargePortfolio() : undefined;
  const xlPortfolio = runXl ? runXlPortfolio() : undefined;
  const xlPortfolioResults = xlPortfolio?.results;
  const consistencyPortfolio = runConsistency ? runConsistencyPortfolio() : undefined;
  const consistencyPortfolioResults = consistencyPortfolio?.results;
  // Build 010, Section 9: a preset-level statistic (like speciesDiversity,
  // this can't be a per-tile number -- see computeSignatureFingerprintDistinctness's
  // own doc comment), computed once over all 15 STYLE_DNA_PRESETS regardless
  // of portfolio size.
  const signatureFingerprintDistinctness = computeSignatureFingerprintDistinctness(computeSignatureFingerprints());
  const elapsedMs = Date.now() - startedAt;

  const report = {
    generatedAt: new Date().toISOString(),
    label: outArg,
    generationTimeMs: elapsedMs,
    // Build 010, Section 9 (Commercial Validation Suite): fraction of all
    // pairs among the 15 real Style DNA presets whose Signature Style Engine
    // fingerprint (depthStrength/professionalRules/premiumRhythm) genuinely
    // differs -- see computeSignatureFingerprintDistinctness's own doc
    // comment for what 0/100 mean.
    signatureFingerprintDistinctness,
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
      // Build 005, Section 9: a real portfolio-level statistic (see
      // engine/portfolioQuality.ts's own doc comment on why this can't be
      // a per-tile number) -- what fraction of the engine's 18-family
      // Botanical Species taxonomy this 100-pattern run actually used.
      speciesDiversity: computeSpeciesDiversity(portfolioResults.map((r) => r.botanicalFamily)),
      // Build 009, Section 6 (Silhouette Optimization): directly fulfills
      // Build 008B, Section 7's own §15.2 deferred recommendation.
      heroArchetypeDiversity: computeHeroArchetypeDiversity(portfolioResults.flatMap((r) => r.premiumHeroArchetypes ?? [])),
    },
    // Build 006, Section 9 (Large Portfolio Evaluation): undefined unless
    // invoked with the `large` CLI flag -- every field here is a real
    // measurement over the actual 300-pattern run, never fabricated or
    // interpolated from the 100-pattern portfolio's own numbers.
    largePortfolio: largePortfolioResults && {
      seeds: LARGE_PORTFOLIO_SEEDS,
      styleIds: STYLE_IDS,
      count: largePortfolioResults.length,
      aggregate: aggregateMetrics(largePortfolioResults),
      namedPenaltyRates: namedPenaltyRates(largePortfolioResults),
      visualIssueRates: visualIssueRates(largePortfolioResults),
      byStyleDna: breakdownBy(largePortfolioResults, (r) => r.styleDnaId ?? 'unknown'),
      nodeBudgetFailures: largePortfolioResults.filter((r) => r.nodeCount > NODE_BUDGET).map((r) => ({ label: r.label, nodeCount: r.nodeCount })),
      speciesDiversity: computeSpeciesDiversity(largePortfolioResults.map((r) => r.botanicalFamily)),
      compositionDiversity: computeCompositionDiversity(largePortfolioResults.map((r) => r.layoutId), Object.keys(LAYOUTS).length),
      clusterDiversity: computeClusterDiversity(largePortfolioResults.map((r) => r.botanicalFamily)),
      heroDiversity: computeHeroDiversity(largePortfolioResults.map((r) => r.botanicalFamily)),
      heroArchetypeDiversity: computeHeroArchetypeDiversity(largePortfolioResults.flatMap((r) => r.premiumHeroArchetypes ?? [])),
    },
    // Build 010, Section 10 (500-pattern Portfolio Evaluation): undefined
    // unless invoked with the `xl` CLI flag -- same "always a real
    // measurement over the actual run, never fabricated" convention as
    // largePortfolio above.
    xlPortfolio: xlPortfolioResults && {
      seeds: XL_PORTFOLIO_SEEDS,
      styleIds: STYLE_IDS,
      count: xlPortfolioResults.length,
      droppedPairs: xlPortfolio!.droppedPairs,
      aggregate: aggregateMetrics(xlPortfolioResults),
      namedPenaltyRates: namedPenaltyRates(xlPortfolioResults),
      visualIssueRates: visualIssueRates(xlPortfolioResults),
      byStyleDna: breakdownBy(xlPortfolioResults, (r) => r.styleDnaId ?? 'unknown'),
      nodeBudgetFailures: xlPortfolioResults.filter((r) => r.nodeCount > NODE_BUDGET).map((r) => ({ label: r.label, nodeCount: r.nodeCount })),
      speciesDiversity: computeSpeciesDiversity(xlPortfolioResults.map((r) => r.botanicalFamily)),
      compositionDiversity: computeCompositionDiversity(xlPortfolioResults.map((r) => r.layoutId), Object.keys(LAYOUTS).length),
      clusterDiversity: computeClusterDiversity(xlPortfolioResults.map((r) => r.botanicalFamily)),
      heroDiversity: computeHeroDiversity(xlPortfolioResults.map((r) => r.botanicalFamily)),
      heroArchetypeDiversity: computeHeroArchetypeDiversity(xlPortfolioResults.flatMap((r) => r.premiumHeroArchetypes ?? [])),
    },
    // Build 011, Section 8/10 (Portfolio Consistency Engine / 1000-pattern
    // Consistency Portfolio): undefined unless invoked with the
    // `consistency` CLI flag -- same "always a real measurement over the
    // actual run, never fabricated" convention as largePortfolio/xlPortfolio
    // above. `byStyleDna` is this tier's own headline result: per-preset
    // Portfolio Consistency + Sequential Style Drift, the two new Section 8
    // measurements this build shipped.
    consistencyPortfolio: consistencyPortfolioResults && {
      seeds: CONSISTENCY_PORTFOLIO_SEEDS,
      styleIds: STYLE_IDS,
      count: consistencyPortfolioResults.length,
      droppedPairs: consistencyPortfolio!.droppedPairs,
      aggregate: aggregateMetrics(consistencyPortfolioResults),
      namedPenaltyRates: namedPenaltyRates(consistencyPortfolioResults),
      visualIssueRates: visualIssueRates(consistencyPortfolioResults),
      byStyleDna: computeConsistencyByStyleDna(consistencyPortfolioResults),
      nodeBudgetFailures: consistencyPortfolioResults.filter((r) => r.nodeCount > NODE_BUDGET).map((r) => ({ label: r.label, nodeCount: r.nodeCount })),
      speciesDiversity: computeSpeciesDiversity(consistencyPortfolioResults.map((r) => r.botanicalFamily)),
      compositionDiversity: computeCompositionDiversity(consistencyPortfolioResults.map((r) => r.layoutId), Object.keys(LAYOUTS).length),
      heroArchetypeDiversity: computeHeroArchetypeDiversity(consistencyPortfolioResults.flatMap((r) => r.premiumHeroArchetypes ?? [])),
    },
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${outArg}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`Signature Fingerprint Distinctness (15 Style DNA presets)=${signatureFingerprintDistinctness}%`);
  console.log(`Scenario suite (n=${scenarioResults.length}): Absolute Commercial Quality mean=${report.scenarioSuite.aggregate.absoluteCommercialQuality.mean}, median=${report.scenarioSuite.aggregate.absoluteCommercialQuality.median}`);
  console.log(`Portfolio (n=${portfolioResults.length}): Absolute Commercial Quality mean=${report.portfolio.aggregate.absoluteCommercialQuality.mean}, median=${report.portfolio.aggregate.absoluteCommercialQuality.median}`);
  console.log(`Portfolio Palette Contrast mean=${report.portfolio.aggregate.paletteContrast.mean}`);
  console.log(`Portfolio Hero Visibility mean=${report.portfolio.aggregate.heroVisibility.mean}`);
  console.log(`Portfolio Pattern Beauty Score mean=${report.portfolio.aggregate.patternBeautyScore.mean}`);
  console.log(`Portfolio Readability@200px mean=${report.portfolio.aggregate.readabilityThumbnail200.mean}`);
  console.log(`Portfolio repeatedScale rate=${report.portfolio.visualIssueRates.repeatedScale}%`);
  console.log(`Portfolio Species Diversity=${report.portfolio.speciesDiversity}%`);
  console.log(`Portfolio Hero Archetype Diversity=${report.portfolio.heroArchetypeDiversity}%`);
  if (report.portfolio.aggregate.illustrationQuality) {
    console.log(`Portfolio Illustration Quality mean=${report.portfolio.aggregate.illustrationQuality.mean} (botanical results only, n=${report.portfolio.aggregate.illustrationQuality.n})`);
    console.log(`Portfolio Visual Richness mean=${report.portfolio.aggregate.visualRichness.mean}`);
  }
  if (report.portfolio.aggregate.illustrationQualityV2Overall) {
    console.log(`Portfolio Illustration Quality V2 overall mean=${report.portfolio.aggregate.illustrationQualityV2Overall.mean} (botanical results only, n=${report.portfolio.aggregate.illustrationQualityV2Overall.n})`);
    console.log(`Portfolio Bouquet/Gesture/Leaf/Flower Realism means=${report.portfolio.aggregate.bouquetQuality.mean}/${report.portfolio.aggregate.gestureQuality.mean}/${report.portfolio.aggregate.leafRealism.mean}/${report.portfolio.aggregate.flowerRealism.mean}`);
    console.log(`Portfolio Premium Feel mean=${report.portfolio.aggregate.premiumFeel.mean}`);
  }
  console.log(`Portfolio Commercial Style Fit mean=${report.portfolio.aggregate.commercialStyleFit.mean}`);
  console.log(`Portfolio Luxury/Editorial/Premium Feeling means=${report.portfolio.aggregate.luxuryFeeling.mean}/${report.portfolio.aggregate.editorialFeeling.mean}/${report.portfolio.aggregate.premiumFeeling.mean}`);
  console.log(`Portfolio Luxury Composition overall mean=${report.portfolio.aggregate.luxuryComposition.mean}`);
  console.log(`Portfolio Commercial Appeal Score V2 overall mean=${report.portfolio.aggregate.commercialAppealScoreV2.mean}`);
  if (report.largePortfolio) {
    console.log(`Large Portfolio (n=${report.largePortfolio.count}): Absolute Commercial Quality mean=${report.largePortfolio.aggregate.absoluteCommercialQuality.mean}`);
    console.log(`Large Portfolio Commercial Style Fit mean=${report.largePortfolio.aggregate.commercialStyleFit.mean}`);
    console.log(`Large Portfolio Species/Composition/Cluster/Hero Diversity=${report.largePortfolio.speciesDiversity}%/${report.largePortfolio.compositionDiversity}%/${report.largePortfolio.clusterDiversity}%/${report.largePortfolio.heroDiversity}%`);
    console.log(`Large Portfolio Hero Archetype Diversity=${report.largePortfolio.heroArchetypeDiversity}%`);
    console.log(`Large Portfolio nodeCount mean=${report.largePortfolio.aggregate.nodeCount.mean}`);
  }
  if (report.xlPortfolio) {
    console.log(`XL Portfolio (n=${report.xlPortfolio.count}): Absolute Commercial Quality mean=${report.xlPortfolio.aggregate.absoluteCommercialQuality.mean}`);
    console.log(`XL Portfolio Commercial Style Fit mean=${report.xlPortfolio.aggregate.commercialStyleFit.mean}`);
    console.log(`XL Portfolio Luxury/Editorial/Premium Feeling means=${report.xlPortfolio.aggregate.luxuryFeeling.mean}/${report.xlPortfolio.aggregate.editorialFeeling.mean}/${report.xlPortfolio.aggregate.premiumFeeling.mean}`);
    console.log(`XL Portfolio Luxury Composition overall mean=${report.xlPortfolio.aggregate.luxuryComposition.mean}`);
    console.log(`XL Portfolio Species/Composition/Cluster/Hero Diversity=${report.xlPortfolio.speciesDiversity}%/${report.xlPortfolio.compositionDiversity}%/${report.xlPortfolio.clusterDiversity}%/${report.xlPortfolio.heroDiversity}%`);
    console.log(`XL Portfolio Hero Archetype Diversity=${report.xlPortfolio.heroArchetypeDiversity}%`);
    console.log(`XL Portfolio nodeCount mean=${report.xlPortfolio.aggregate.nodeCount.mean}`);
  }
  if (report.consistencyPortfolio) {
    console.log(`Consistency Portfolio (n=${report.consistencyPortfolio.count}): Absolute Commercial Quality mean=${report.consistencyPortfolio.aggregate.absoluteCommercialQuality.mean}`);
    console.log(`Consistency Portfolio Commercial Appeal Score V2 overall mean=${report.consistencyPortfolio.aggregate.commercialAppealScoreV2.mean}`);
    const perPreset = Object.entries(report.consistencyPortfolio.byStyleDna);
    const meanConsistency = Math.round(perPreset.reduce((a, [, v]) => a + v.consistency, 0) / perPreset.length);
    const driftedPresets = perPreset.filter(([, v]) => v.drift.driftDetected).map(([id]) => id);
    console.log(`Consistency Portfolio mean Portfolio Consistency across ${perPreset.length} presets=${meanConsistency}`);
    console.log(`Consistency Portfolio presets with detected sequential style drift=${driftedPresets.length > 0 ? driftedPresets.join(', ') : 'none'}`);
  }
  console.log(`Generation time: ${elapsedMs}ms`);
}

// Build 011.5: guarded so other scripts (e.g. commercialRealityCheck.ts)
// can import this module's evaluation pipeline (evaluate/EvalResult/stats/
// aggregateMetrics/etc.) without triggering a full report run as a side
// effect of the import — main() only fires when this file is the actual
// entrypoint (`tsx scripts/qualityReport.ts ...`), exactly as before for
// every existing invocation.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
