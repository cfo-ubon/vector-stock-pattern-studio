import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../src/engine/styleDna';
import { evaluateProductTargets, type ProductUseId } from '../src/collection/productTargets';
import { computePortfolioConsistency, detectSequentialStyleDrift, computeSignatureFingerprintDistinctness } from '../src/engine/portfolioQuality';
import {
  evaluate,
  stats,
  buildPortfolioParams,
  STYLE_IDS,
  computeSignatureFingerprints,
  type EvalResult,
} from './qualityReport';

// Build 011.5 (Commercial Reality Check): a dedicated, real-data evaluation
// portfolio -- 15 STYLE_DNA_PRESETS x 100 fixed seeds ('cr-1'..'cr-100') =
// 1500 patterns, no cherry-picking. Reuses the exact same `evaluate()`
// pipeline `scripts/qualityReport.ts` already established (same tile
// build, same scoring functions) so every number here is directly
// comparable to every prior build's baseline JSON -- this script adds no
// new scoring math beyond mapping the brief's requested dimensions onto
// already-real sub-scores, and computing per-product-target scores that
// weren't previously broken out individually.
//
// Every dimension the brief names is mapped to a real, already-computed
// signal wherever one honestly exists (see REALITY_CHECK_DIMENSION_MAP
// below for the full mapping and the two genuinely unmeasurable ones --
// Originality and Recognition Value -- which are NOT scored numerically
// here; they get a qualitative-only treatment in the report, never a
// fabricated number).

const SEEDS_PER_PRESET = 100;
const CR_SEEDS = Array.from({ length: SEEDS_PER_PRESET }, (_, i) => `cr-${i + 1}`);

interface ProductScores {
  wallpaper: number;
  textile: number;
  fabric: number;
  packaging: number;
  /** Real product-target id is `stationery` -- there is no distinct
   * `greetingCard` id in `ProductUseId`; stationery is the closest real,
   * already-implemented product-suitability rule for greeting cards, used
   * here as an honest proxy rather than inventing a new rule. */
  greetingCardProxy: number;
  giftWrap: number;
}

interface TileRealityCheck {
  result: EvalResult;
  productScores: ProductScores;
  /** Real proxy for "fabric repeat quality": `adjacencyRepetition` is the
   * only one of the two candidate metrics that actually varies --
   * `seamlessIntegrity` is a fixed structural guarantee (always 100 by
   * construction, see scoring.ts) so it contributes no real signal here. */
  fabricRepeatQuality: number;
  /** Real proxy for "depth illusion": whether/how strongly this tile's
   * resolved Style DNA activates the Multi-layer Depth Engine
   * (`depthStrength`, Build 010 Section 3) -- NOT a rendered-depth-quality
   * score (no such measurement exists), just the real activation strength
   * of the one mechanism that produces a depth cue at all. */
  depthStrength: number | undefined;
}

function computeProductScores(categoryId: string, tileSize: number, density: number, keywordText: string, heroVisibility: number): ProductScores {
  const evaluations = evaluateProductTargets({ categoryId, tileSize, density, keywordText, heroVisibility });
  const scoreFor = (id: ProductUseId) => evaluations.find((e) => e.id === id)?.score ?? 0;
  return {
    wallpaper: scoreFor('wallpaper'),
    textile: scoreFor('textile'),
    fabric: scoreFor('fabric'),
    packaging: scoreFor('packaging'),
    greetingCardProxy: scoreFor('stationery'),
    giftWrap: scoreFor('giftWrap'),
  };
}

function runRealityCheckForPreset(styleId: string): TileRealityCheck[] {
  const dna = STYLE_DNA_PRESETS[styleId];
  return CR_SEEDS.map((seed) => {
    const params = buildPortfolioParams(styleId, seed);
    const result = evaluate(`${styleId}@${seed}`, params, styleId);
    const productScores = computeProductScores(params.categoryId, params.tileSize, params.density, dna.label, result.heroVisibility);
    const fabricRepeatQuality = result.metrics.adjacencyRepetition;
    const patch = resolveStyleDna(dna, 'reality-check-depth-strength');
    const depthStrength = patch.depthStrength;
    return { result, productScores, fabricRepeatQuality, depthStrength };
  });
}

function meanOf(values: number[]): number {
  return values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

interface PresetSummary {
  styleId: string;
  label: string;
  n: number;
  // --- directly-real, already-shipped metrics ---
  absoluteCommercialQuality: ReturnType<typeof stats>;
  heroVisibility: ReturnType<typeof stats>;
  patternBeautyScore: ReturnType<typeof stats>;
  luxuryFeeling: ReturnType<typeof stats>;
  editorialFeeling: ReturnType<typeof stats>;
  premiumFeeling: ReturnType<typeof stats>;
  visualStory: ReturnType<typeof stats>; // storytelling / eye movement (composite)
  flowCoherence: ReturnType<typeof stats>; // flow
  rhythmRegularity: ReturnType<typeof stats>; // visual rhythm
  occupancyRatio: ReturnType<typeof stats>; // negative space (raw)
  breathingRoom: ReturnType<typeof stats>; // negative space (luxury composition)
  largestEmptyRegion: ReturnType<typeof stats>; // negative space (accidental-hole penalty)
  motifShapeDiversity: ReturnType<typeof stats>; // silhouette diversity proxy
  silhouetteBeautyOrIllustrationQuality: ReturnType<typeof stats> | null; // botanical only
  botanicalRealism: ReturnType<typeof stats> | null; // botanical only
  luxuryCompositionOverall: ReturnType<typeof stats>;
  commercialAppealScoreV2Overall: ReturnType<typeof stats>;
  commercialStyleFit: ReturnType<typeof stats>;
  // --- product-suitability (per named surface) ---
  wallpaperUsability: ReturnType<typeof stats>;
  textileUsability: ReturnType<typeof stats>;
  fabricUsability: ReturnType<typeof stats>;
  packagingSuitability: ReturnType<typeof stats>;
  greetingCardSuitabilityProxy: ReturnType<typeof stats>;
  giftWrapSuitability: ReturnType<typeof stats>;
  fabricRepeatQuality: ReturnType<typeof stats>;
  // --- portfolio-level (not per-tile) ---
  collectionConsistency: number;
  sequentialDriftDetected: boolean;
  sequentialDriftMagnitude: number;
  // --- honest non-score proxy ---
  depthStrengthActive: boolean;
  depthStrengthValue: number | undefined;
  // --- worst/best tile labels for sample rendering ---
  bestSeed: string;
  medianSeed: string;
  worstSeed: string;
}

function summarizePreset(styleId: string, tiles: TileRealityCheck[]): PresetSummary {
  const dna = STYLE_DNA_PRESETS[styleId];
  const results = tiles.map((t) => t.result);
  const isBotanical = results[0].categoryId === 'botanical';

  const sortedByQuality = [...tiles].sort((a, b) => a.result.absoluteCommercialQuality - b.result.absoluteCommercialQuality);
  const worstSeed = sortedByQuality[0].result.seed;
  const bestSeed = sortedByQuality[sortedByQuality.length - 1].result.seed;
  const medianSeed = sortedByQuality[Math.floor(sortedByQuality.length / 2)].result.seed;

  const consistencySamples = results.map((r) => ({
    absoluteCommercialQuality: r.absoluteCommercialQuality,
    luxuryCompositionOverall: r.luxuryComposition.overall,
    luxuryFeeling: r.commercialPatternCritique.luxuryFeeling,
    styleDnaConsistency: r.styleFitQuality,
  }));
  const collectionConsistency = computePortfolioConsistency(consistencySamples);
  const drift = detectSequentialStyleDrift(results.map((r) => r.absoluteCommercialQuality));

  const depthValues = tiles.map((t) => t.depthStrength).filter((v): v is number => v !== undefined);

  return {
    styleId,
    label: dna.label,
    n: results.length,
    absoluteCommercialQuality: stats(results.map((r) => r.absoluteCommercialQuality)),
    heroVisibility: stats(results.map((r) => r.heroVisibility)),
    patternBeautyScore: stats(results.map((r) => r.patternBeautyScore)),
    luxuryFeeling: stats(results.map((r) => r.commercialPatternCritique.luxuryFeeling)),
    editorialFeeling: stats(results.map((r) => r.commercialPatternCritique.editorialFeeling)),
    premiumFeeling: stats(results.map((r) => r.commercialPatternCritique.premiumFeeling)),
    visualStory: stats(results.map((r) => r.commercialPatternCritique.visualStory)),
    flowCoherence: stats(results.map((r) => r.metrics.flowCoherence)),
    rhythmRegularity: stats(results.map((r) => r.metrics.rhythmRegularity)),
    occupancyRatio: stats(results.map((r) => r.metrics.occupancyRatio)),
    breathingRoom: stats(results.map((r) => r.luxuryComposition.breathingRoom)),
    largestEmptyRegion: stats(results.map((r) => r.metrics.largestEmptyRegion)),
    motifShapeDiversity: stats(results.map((r) => r.metrics.motifShapeDiversity)),
    silhouetteBeautyOrIllustrationQuality: isBotanical ? stats(results.map((r) => r.illustrationQuality ?? 0)) : null,
    botanicalRealism: isBotanical ? stats(results.map((r) => r.commercialPatternCritique.botanicalRealism ?? 0)) : null,
    luxuryCompositionOverall: stats(results.map((r) => r.luxuryComposition.overall)),
    commercialAppealScoreV2Overall: stats(results.map((r) => r.commercialAppealScoreV2.overall)),
    commercialStyleFit: stats(results.map((r) => r.commercialStyleAnalysis.overallFit)),
    wallpaperUsability: stats(tiles.map((t) => t.productScores.wallpaper)),
    textileUsability: stats(tiles.map((t) => t.productScores.textile)),
    fabricUsability: stats(tiles.map((t) => t.productScores.fabric)),
    packagingSuitability: stats(tiles.map((t) => t.productScores.packaging)),
    greetingCardSuitabilityProxy: stats(tiles.map((t) => t.productScores.greetingCardProxy)),
    giftWrapSuitability: stats(tiles.map((t) => t.productScores.giftWrap)),
    fabricRepeatQuality: stats(tiles.map((t) => t.fabricRepeatQuality)),
    collectionConsistency,
    sequentialDriftDetected: drift.driftDetected,
    sequentialDriftMagnitude: drift.driftMagnitude,
    depthStrengthActive: depthValues.length > 0,
    depthStrengthValue: depthValues.length > 0 ? meanOf(depthValues) : undefined,
    bestSeed,
    medianSeed,
    worstSeed,
  };
}

function main() {
  const startedAt = Date.now();
  const byPreset: Record<string, TileRealityCheck[]> = {};
  for (const styleId of STYLE_IDS) {
    byPreset[styleId] = runRealityCheckForPreset(styleId);
  }

  const summaries: PresetSummary[] = STYLE_IDS.map((styleId) => summarizePreset(styleId, byPreset[styleId]));

  const signatureFingerprintDistinctness = computeSignatureFingerprintDistinctness(computeSignatureFingerprints());

  const allResults = STYLE_IDS.flatMap((styleId) => byPreset[styleId].map((t) => t.result));
  const overallAggregate = {
    absoluteCommercialQuality: stats(allResults.map((r) => r.absoluteCommercialQuality)),
    commercialAppealScoreV2Overall: stats(allResults.map((r) => r.commercialAppealScoreV2.overall)),
    luxuryComposition: stats(allResults.map((r) => r.luxuryComposition.overall)),
  };

  const elapsedMs = Date.now() - startedAt;

  const report = {
    generatedAt: new Date().toISOString(),
    label: 'BUILD_011_5_commercial_reality_check',
    seedsPerPreset: SEEDS_PER_PRESET,
    totalPatterns: allResults.length,
    generationTimeMs: elapsedMs,
    signatureFingerprintDistinctness,
    overallAggregate,
    presetSummaries: summaries,
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'BUILD_011_5_commercial_reality_check.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`Total patterns: ${allResults.length} (${STYLE_IDS.length} presets x ${SEEDS_PER_PRESET} seeds)`);
  console.log(`Overall Absolute Commercial Quality mean=${overallAggregate.absoluteCommercialQuality.mean}`);
  console.log(`Overall Commercial Appeal Score V2 mean=${overallAggregate.commercialAppealScoreV2Overall.mean}`);
  console.log(`Signature Fingerprint Distinctness=${signatureFingerprintDistinctness}%`);
  console.log('');
  console.log('Per-preset summary (Absolute Commercial Quality mean / Collection Consistency / drift):');
  for (const s of summaries) {
    console.log(`  ${s.label}: ACQ=${s.absoluteCommercialQuality.mean}, consistency=${s.collectionConsistency}, drift=${s.sequentialDriftDetected}`);
  }
  console.log(`Generation time: ${elapsedMs}ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
