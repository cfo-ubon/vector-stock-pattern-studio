// AI-SBOS v3, Milestones 6-9 — bridges the Keyword Intent Engine's output
// to the real generation pipeline and runs both mandatory output gates.
// Zero duplicated generation logic: `defaultParams()`, `resolveStyleDna()`,
// and `buildTileForGenerate()` are the exact same functions v2/Autopilot/
// Factory already call.
import { defaultParams } from '../engine/defaults';
import { resolveStyleDna, STYLE_DNA_PRESETS } from '../engine/styleDna';
import { buildTileForGenerate } from '../engine/heroDetector';
import { computeMetrics, type CompositionMetrics } from '../engine/scoring';
import type { GenerateParams, LayoutId, TileData } from '../engine/types';
import { deriveSeed } from '../engine/candidateEngine';
import { runVectorIntegrityGate, type VectorIntegrityResult } from './vectorIntegrityGate';
import { runSeamlessIntegrityGate, type SeamlessIntegrityResult } from './seamlessGate';
import type { DesignIntent, DensityBucket } from './keywordIntent';

export interface Concept {
  id: string;
  label: string;
  params: GenerateParams;
  tileData: TileData;
  metrics: CompositionMetrics;
  vectorIntegrity: VectorIntegrityResult;
  seamlessIntegrity: SeamlessIntegrityResult;
  overallReady: boolean;
}

const DENSITY_BASE: Record<DensityBucket, number> = { low: 0.35, medium: 0.55, high: 0.75 };

/** Milestone 6 — Concept Diversity. Five named composition archetypes,
 * each a real, meaningfully different `layoutId` + density/negative-space
 * delta on top of the same resolved base params — not the same
 * composition re-rendered with a different seed. Matches the mission's
 * own worked example ("botanical leaves" -> Airy scattered / Dense
 * foliage / Elegant line / Organic tossed repeat / Geometric
 * arrangement). */
const CONCEPT_TEMPLATES: Array<{ label: string; layoutId: LayoutId; densityMul: number; negativeSpaceDelta: number; rotationJitterMul: number }> = [
  { label: 'Airy Scattered', layoutId: 'scatter', densityMul: 0.65, negativeSpaceDelta: 0.25, rotationJitterMul: 1 },
  { label: 'Dense All-Over', layoutId: 'brick', densityMul: 1.25, negativeSpaceDelta: -0.1, rotationJitterMul: 0.8 },
  { label: 'Elegant Line Repeat', layoutId: 'stripe', densityMul: 0.9, negativeSpaceDelta: 0.1, rotationJitterMul: 0.5 },
  { label: 'Organic Toss', layoutId: 'toss', densityMul: 1, negativeSpaceDelta: 0, rotationJitterMul: 1.6 },
  { label: 'Geometric Arrangement', layoutId: 'halfDrop', densityMul: 1, negativeSpaceDelta: 0.05, rotationJitterMul: 0.6 },
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function buildBaseParamsFromIntent(intent: DesignIntent, seed: string): GenerateParams {
  const base = defaultParams();
  let params: GenerateParams = { ...base, categoryId: intent.categoryId, seed };

  if (intent.styleDnaId && STYLE_DNA_PRESETS[intent.styleDnaId]) {
    const resolved = resolveStyleDna(STYLE_DNA_PRESETS[intent.styleDnaId], seed);
    params = { ...params, ...resolved, seed };
  } else if (intent.paletteId) {
    params = { ...params, paletteId: intent.paletteId };
  }

  return params;
}

/** Real generation for one concept variant. Runs both mandatory Milestone
 * 7/9 gates on the actual output — never fabricated, never assumed. */
function generateConcept(intent: DesignIntent, template: (typeof CONCEPT_TEMPLATES)[number], baseSeed: string, index: number): Concept {
  const seed = deriveSeed(baseSeed, 'v3-concept', index);
  const baseParams = buildBaseParamsFromIntent(intent, seed);
  const densityBase = DENSITY_BASE[intent.density];

  const params: GenerateParams = {
    ...baseParams,
    layoutId: template.layoutId,
    density: clamp01(densityBase * template.densityMul),
    negativeSpace: clamp01((baseParams.negativeSpace ?? 0) + template.negativeSpaceDelta),
    rotationJitter: baseParams.rotationJitter * template.rotationJitterMul,
    seed,
  };

  const result = buildTileForGenerate(params);
  const tileData = result.tileData;
  const metrics = computeMetrics(tileData);
  const vectorIntegrity = runVectorIntegrityGate(tileData);
  const seamlessIntegrity = runSeamlessIntegrityGate(tileData, metrics, `${baseSeed}-${index}`);

  return {
    id: `${baseSeed}-concept-${index}`,
    label: template.label,
    params,
    tileData,
    metrics,
    vectorIntegrity,
    seamlessIntegrity,
    overallReady: vectorIntegrity.status === 'VECTOR_PASS' && seamlessIntegrity.status === 'SEAMLESS_PASS',
  };
}

export function generateConcepts(intent: DesignIntent, count = CONCEPT_TEMPLATES.length): Concept[] {
  const baseSeed = `v3-${intent.keyword.replace(/\s+/g, '-').toLowerCase() || 'untitled'}`;
  const templates = CONCEPT_TEMPLATES.slice(0, Math.max(1, Math.min(count, CONCEPT_TEMPLATES.length)));
  return templates.map((template, index) => generateConcept(intent, template, baseSeed, index));
}
