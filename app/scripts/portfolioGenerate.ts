import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateWithTile, buildPortfolioParams, STYLE_IDS } from './qualityReport';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';
import { evaluateProductTargets, recommendedProductUses } from '../src/collection/productTargets';
import { computeOverallScoreV2 } from '../src/engine/scoringV2';
import { layoutEvaluationClass } from '../src/engine/layoutEvaluation';
import { computeStyleEvaluationProfile } from '../src/engine/styleEvaluation';
import { computeCommercialJudgeV2 } from '../src/critic/commercialJudgeV2';
import { extractInstances, extractMotifShapeSignatures } from '../src/engine/svgGeometry';
import { serialize } from '../src/engine/svgAst';
import { computeSimilarityFingerprint } from '../src/portfolio/fingerprint';
import { computeTileEvaluatorConfidence } from '../src/portfolio/confidence';
import { buildPortfolioBaseline } from '../src/portfolio/baseline';
import { PORTFOLIO_SCHEMA_VERSION, type PortfolioPatternRecord, type PortfolioManifest, type FailureModeId, type StrengthTagId } from '../src/portfolio/types';

// Build 013, Section 4 (Large Portfolio Generation). Generates the
// uncurated 5,000-pattern portfolio. Reuses every existing generation/
// evaluation primitive read-only (BUILD_013_AUDIT.md's own commitment):
// `buildPortfolioParams`/`evaluateWithTile` (Build 011.5/013's own thin,
// tile-exposing sibling of `evaluate()`), `evaluateProductTargets`/
// `recommendedProductUses`, `computeOverallScoreV2`/`layoutEvaluationClass`/
// `computeStyleEvaluationProfile` (Build 012), `computeCommercialJudgeV2`
// (Build 012). No new scoring or generation math is introduced here — this
// script only orchestrates and records.
//
// Distribution: 5,000 patterns / 15 presets = 333.33 — the first 5 presets
// (in `STYLE_IDS`' own declared order) get 334 seeds each, the remaining 10
// get 333, summing to exactly 5,000 (5*334 + 10*333 = 5000). Every preset
// clears the brief's own ">= 250 per preset" floor. Documented here, not
// silently rounded.
//
// Checkpointing (Section 14): writes a checkpoint file every
// `CHECKPOINT_INTERVAL` patterns so a session interruption can resume
// without re-generating already-completed (styleId, seed) pairs — the
// checkpoint records exactly which pairs are done, and this script's own
// startup step reads it back and skips them.

const SEED_PREFIX = 'p13';
const TOTAL_PATTERNS = 5000;
const CHECKPOINT_INTERVAL = 500;

function buildDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {};
  STYLE_IDS.forEach((styleId, i) => {
    distribution[styleId] = i < 5 ? 334 : 333;
  });
  return distribution;
}

function buildPairs(distribution: Record<string, number>): Array<{ styleId: string; seed: string }> {
  const pairs: Array<{ styleId: string; seed: string }> = [];
  for (const styleId of STYLE_IDS) {
    const count = distribution[styleId];
    for (let i = 1; i <= count; i++) {
      pairs.push({ styleId, seed: `${SEED_PREFIX}-${styleId}-${i}` });
    }
  }
  return pairs;
}

const FAILURE_MODE_FROM_RULE: Partial<Record<string, FailureModeId>> = {
  weakHierarchy: 'weakHierarchy',
  heroInsufficientDetail: 'heroInsufficientDetail',
  gridAppearance: 'gridAppearance',
  equalSpacingDetected: 'equalSpacingDetected',
  zeroMotifOverlap: 'zeroMotifOverlap',
  largeEmptyHole: 'largeEmptyHole',
  repetitiveMotifShapes: 'repetitiveMotifShapes',
  tooManyIsolatedObjects: 'tooManyIsolatedObjects',
  lowClusterCohesion: 'lowClusterCohesion',
  lowPaletteContrast: 'lowPaletteContrast',
};

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function currentGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirnameFromUrl(), encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function buildOneRecord(styleId: string, seed: string, baselineCommit: string): PortfolioPatternRecord {
  const dna = STYLE_DNA_PRESETS[styleId];
  const params = buildPortfolioParams(styleId, seed);
  const t0 = performance.now();
  const { result, tile } = evaluateWithTile(`${styleId}@${seed}`, params, styleId);
  const generationTimeMs = Math.round(performance.now() - t0);

  const productEvaluations = evaluateProductTargets({
    categoryId: params.categoryId, tileSize: params.tileSize, density: params.density, keywordText: dna.label, heroVisibility: result.heroVisibility,
  });
  const topProductId = recommendedProductUses(productEvaluations, 1)[0];
  const topProduct = productEvaluations.find((e) => e.id === topProductId)!;
  const allProductScores = Object.fromEntries(productEvaluations.map((e) => [e.id, e.score]));

  const layoutClass = layoutEvaluationClass(result.layoutId);
  const scoreV2 = computeOverallScoreV2(result.metrics, 'stockClean', { layoutClass, productId: topProductId });
  const styleProfile = computeStyleEvaluationProfile(dna);
  const judge = computeCommercialJudgeV2({
    appeal: result.commercialAppealScoreV2, scoreV2, metrics: result.metrics, declaredDensity: dna.density, styleProfile,
  });

  const instances = extractInstances(tile);
  const shapeSignatures = extractMotifShapeSignatures(tile);
  const svgString = serialize(tile.svg);

  const fingerprint = computeSimilarityFingerprint({
    styleDnaId: styleId,
    layoutId: result.layoutId,
    compositionZone: params.compositionZone,
    paletteId: params.paletteId,
    botanicalFamily: params.botanicalFamily,
    hierarchyPreset: dna.hierarchyPreset,
    productTarget: topProductId,
    density: params.density,
    negativeSpace: params.negativeSpace,
    nodeCount: result.nodeCount,
    shapeSignatures,
  });

  const evaluatorConfidence = computeTileEvaluatorConfidence(scoreV2.appliedPenalties, scoreV2.exemptedPenalties, instances.length);

  const failureModes: FailureModeId[] = [];
  for (const p of scoreV2.appliedPenalties) {
    const mode = FAILURE_MODE_FROM_RULE[p.ruleId];
    if (mode && !failureModes.includes(mode)) failureModes.push(mode);
  }
  if (topProduct.score < 60) failureModes.push('weakProductFit');
  if ((result.styleFitQuality ?? 100) < 50) failureModes.push('lowStyleFitQuality');
  if (result.readability.thumbnail200 < 50) failureModes.push('weakThumbnailImpact');
  if (result.issues.repeatedScale) failureModes.push('repeatedScale');
  if (result.issues.fragmentedSilhouette) failureModes.push('fragmentedSilhouette');

  const strengthTags: StrengthTagId[] = [];
  if (result.metrics.hierarchy >= 80) strengthTags.push('strongHierarchy');
  if (result.metrics.heroDetailRatio >= 80) strengthTags.push('strongHeroDetail');
  if (result.metrics.paletteContrast >= 80) strengthTags.push('strongPaletteContrast');
  if (topProduct.score >= 85) strengthTags.push('strongProductFit');
  if ((result.styleFitQuality ?? 0) >= 85) strengthTags.push('strongStyleFitQuality');
  if (result.readability.thumbnail200 >= 80) strengthTags.push('strongThumbnailImpact');
  if (result.metrics.motifShapeDiversity >= 80) strengthTags.push('strongMotifDiversity');
  if (result.metrics.flowCoherence >= 80) strengthTags.push('strongFlowCoherence');

  const baseline = buildPortfolioBaseline(SEED_PREFIX, `${SEED_PREFIX}-<styleId>-<1..N>, deterministic, documented distribution in scripts/portfolioGenerate.ts`, PORTFOLIO_SCHEMA_VERSION, { commit: baselineCommit });

  return {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    patternId: `${styleId}@${seed}`,
    seed,
    styleDnaId: styleId,
    layoutId: result.layoutId,
    layoutClass,
    categoryId: result.categoryId,
    compositionZone: params.compositionZone,
    productTarget: topProductId,
    productTargetScore: topProduct.score,
    allProductScores,
    botanicalFamily: result.botanicalFamily,
    colorStrategy: dna.colorStrategy,
    clusterType: tile.premiumHeroArchetypes?.[0] ?? params.clusterArchetypes?.[0],
    heroStructure: dna.hierarchyPreset,
    nodeCount: result.nodeCount,
    fileSizeBytes: svgString.length,
    generationTimeMs,
    metrics: result.metrics,
    absoluteCommercialQualityV1: result.absoluteCommercialQuality,
    absoluteCommercialQualityV2: scoreV2.score,
    appliedPenaltiesV2: scoreV2.appliedPenalties,
    exemptedPenaltiesV2: scoreV2.exemptedPenalties,
    heroVisibility: result.heroVisibility,
    patternBeautyScore: result.patternBeautyScore,
    illustrationQuality: result.illustrationQuality,
    visualRichness: result.visualRichness,
    styleFitQuality: result.styleFitQuality,
    commercialAppealV2Overall: result.commercialAppealScoreV2.overall,
    luxuryCompositionOverall: result.luxuryComposition.overall,
    surfacePatternSuitability: judge.surfacePatternSuitability,
    commercialJudgeVerdict: judge.verdict,
    similarityFingerprint: fingerprint,
    similarTo: [],
    shapeSignatures: [...new Set(shapeSignatures)].sort(),
    failureModes,
    strengthTags,
    recommendationTags: [],
    evaluatorConfidence,
    provenance: { baseline },
  };
}

interface Checkpoint {
  completedPairs: string[];
  patterns: PortfolioPatternRecord[];
}

function pairKey(styleId: string, seed: string): string {
  return `${styleId}@${seed}`;
}

function main() {
  const __dirname = __dirnameFromUrl();
  const outDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  fs.mkdirSync(outDir, { recursive: true });
  const checkpointPath = path.join(outDir, 'BUILD_013_portfolio_checkpoint.json');
  const finalPath = path.join(outDir, 'BUILD_013_portfolio_raw.json');

  const distribution = buildDistribution();
  const pairs = buildPairs(distribution);
  if (pairs.length !== TOTAL_PATTERNS) {
    throw new Error(`Distribution error: built ${pairs.length} pairs, expected ${TOTAL_PATTERNS}`);
  }

  let patterns: PortfolioPatternRecord[] = [];
  let completed = new Set<string>();
  if (fs.existsSync(checkpointPath)) {
    const checkpoint: Checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    patterns = checkpoint.patterns;
    completed = new Set(checkpoint.completedPairs);
    console.log(`Resuming from checkpoint: ${completed.size}/${TOTAL_PATTERNS} patterns already generated.`);
  }

  const commit = currentGitCommit();
  const startedAt = Date.now();
  let sinceLastCheckpoint = 0;

  for (const { styleId, seed } of pairs) {
    const key = pairKey(styleId, seed);
    if (completed.has(key)) continue;

    const record = buildOneRecord(styleId, seed, commit);
    patterns.push(record);
    completed.add(key);
    sinceLastCheckpoint++;

    if (sinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
      const checkpoint: Checkpoint = { completedPairs: [...completed], patterns };
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));
      sinceLastCheckpoint = 0;
      console.log(`Checkpoint: ${patterns.length}/${TOTAL_PATTERNS} patterns (${Math.round((Date.now() - startedAt) / 1000)}s elapsed)`);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const baseline = buildPortfolioBaseline(SEED_PREFIX, `${SEED_PREFIX}-<styleId>-<1..N>, deterministic, documented distribution in scripts/portfolioGenerate.ts`, PORTFOLIO_SCHEMA_VERSION, { commit });

  const manifest: PortfolioManifest = {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    baseline,
    totalPatterns: patterns.length,
    distribution,
    patterns,
  };

  fs.writeFileSync(finalPath, JSON.stringify(manifest));
  if (fs.existsSync(checkpointPath)) fs.rmSync(checkpointPath);

  console.log(`Wrote ${finalPath}`);
  console.log(`Total patterns: ${patterns.length}`);
  console.log(`Distribution: ${JSON.stringify(distribution)}`);
  console.log(`Generation time (this run): ${elapsedMs}ms, ${patterns.length > 0 ? Math.round(elapsedMs / patterns.length) : 0}ms/pattern`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
