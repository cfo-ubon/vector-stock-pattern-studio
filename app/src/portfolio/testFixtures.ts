import type { PortfolioPatternRecord } from './types';
import { PORTFOLIO_SCHEMA_VERSION } from './types';
import { buildPortfolioBaseline } from './baseline';
import type { CompositionMetrics } from '../engine/scoring';

// Shared test fixture builder for `src/portfolio/*.test.ts`. Not itself a
// `*.test.ts` file, so vitest's default include glob never runs it as a
// suite — a plain helper module, same as every other test file in this repo
// builds its own fixtures inline; this one is shared because
// `PortfolioPatternRecord` has ~45 fields and every portfolio-analysis
// module's tests need a fully-valid one to override from.

function baseMetrics(): CompositionMetrics {
  return {
    composition: 80, spacing: 80, quadrantBalance: 80, horizontalBalance: 80, verticalBalance: 80,
    visualCenterOffset: 5, occupancyRatio: 0.5, densityVariance: 10, largestEmptyRegion: 10,
    hierarchy: 80, scaleDiversity: 80, rotationDiversity: 80, colorBalance: 80, paletteContrast: 80,
    overlapQuality: 80, heroSeparation: 80, edgeDensity: 80, adjacencyRepetition: 10, seamlessIntegrity: 90,
    svgHealth: 100, flowCoherence: 80, rhythmRegularity: 80, motifShapeDiversity: 80, cornerContinuity: 80,
    heroDetailRatio: 80, isolationScore: 10, clusterCohesion: 80, gridAppearanceScore: 10, spacingUniformity: 80,
  };
}

let seedCounter = 0;

export function makePortfolioRecord(overrides: Partial<PortfolioPatternRecord> = {}): PortfolioPatternRecord {
  seedCounter += 1;
  const styleDnaId = overrides.styleDnaId ?? 'stockClean';
  const seed = overrides.seed ?? `test-${seedCounter}`;
  return {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    patternId: `${styleDnaId}@${seed}`,
    seed,
    styleDnaId,
    layoutId: 'grid',
    layoutClass: 'lattice',
    categoryId: 'botanical',
    compositionZone: undefined,
    productTarget: 'wallpaper',
    productTargetScore: 75,
    allProductScores: { wallpaper: 75 },
    marketplaceTarget: undefined,
    botanicalFamily: undefined,
    colorStrategy: 'fullPalette',
    clusterType: undefined,
    heroStructure: undefined,
    nodeCount: 400,
    fileSizeBytes: 20000,
    generationTimeMs: 150,
    metrics: baseMetrics(),
    absoluteCommercialQualityV1: 75,
    absoluteCommercialQualityV2: 75,
    appliedPenaltiesV2: [],
    exemptedPenaltiesV2: [],
    heroVisibility: 75,
    patternBeautyScore: 75,
    illustrationQuality: 75,
    visualRichness: 75,
    styleFitQuality: 75,
    commercialAppealV2Overall: 75,
    luxuryCompositionOverall: 75,
    surfacePatternSuitability: 75,
    commercialJudgeVerdict: 'strong',
    similarityFingerprint: `style:${styleDnaId}|layout:grid|zone:none|palette:none|family:none|hierarchy:none|product:wallpaper|density:0.3|negSpace:0.3|nodes:400|shapes:5`,
    similarTo: [],
    shapeSignatures: ['a', 'b', 'c'],
    clusterId: undefined,
    clusterLabel: undefined,
    rankOverall: undefined,
    percentileOverall: undefined,
    rankWithinPreset: undefined,
    percentileWithinPreset: undefined,
    rankWithinProduct: undefined,
    rankWithinLayout: undefined,
    percentileBucket: undefined,
    compositeRankScore: undefined,
    failureModes: [],
    strengthTags: [],
    recommendationTags: [],
    evaluatorConfidence: 'high',
    provenance: { baseline: buildPortfolioBaseline('test', 'test seed policy', PORTFOLIO_SCHEMA_VERSION, { commit: 'test' }) },
    ...overrides,
  };
}
