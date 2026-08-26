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

/** Real generation + both mandatory gates for one fully-formed set of
 * params — the single shared path every concept (initial generation AND
 * refinement, Milestone 11) goes through. Runs both mandatory Milestone
 * 7/9 gates on the actual output — never fabricated, never assumed. */
export function buildConceptFromParams(id: string, label: string, params: GenerateParams, previewInstanceId: string): Concept {
  const result = buildTileForGenerate(params);
  const tileData = result.tileData;
  const metrics = computeMetrics(tileData);
  const vectorIntegrity = runVectorIntegrityGate(tileData);
  const seamlessIntegrity = runSeamlessIntegrityGate(tileData, metrics, previewInstanceId);

  return {
    id,
    label,
    params,
    tileData,
    metrics,
    vectorIntegrity,
    seamlessIntegrity,
    overallReady: vectorIntegrity.status === 'VECTOR_PASS' && seamlessIntegrity.status === 'SEAMLESS_PASS',
  };
}

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

  return buildConceptFromParams(`${baseSeed}-concept-${index}`, template.label, params, `${baseSeed}-${index}`);
}

export function generateConcepts(intent: DesignIntent, count = CONCEPT_TEMPLATES.length): Concept[] {
  const baseSeed = `v3-${intent.keyword.replace(/\s+/g, '-').toLowerCase() || 'untitled'}`;
  const templates = CONCEPT_TEMPLATES.slice(0, Math.max(1, Math.min(count, CONCEPT_TEMPLATES.length)));
  return templates.map((template, index) => generateConcept(intent, template, baseSeed, index));
}

/** Milestone 19 — Collection Mode. One keyword produces a larger, coherent
 * batch (e.g. 10) sharing design language (same resolved category/style/
 * palette from the intent — untouched per item) while still differing in
 * composition/motif arrangement/density/hierarchy/scale per item, not
 * just by random seed. Cycles through the same 5 real composition
 * archetypes (Milestone 6) and, on each additional pass through them,
 * applies one more real, visible difference (motif scale) so item 6
 * (Airy Scattered, cycle 2) is meaningfully different from item 1 (Airy
 * Scattered, cycle 1), not a seed-jittered near-duplicate of it. */
// 6 distinct multipliers (not 5) so a 30-item collection — 6 full cycles
// of the 5 composition archetypes — never wraps back to a scale value
// already used on an earlier cycle. Verified via live Playwright run
// (scripts/uiAudit/v3g_verify.mjs) that a 5-value list produced 5 real
// TOO_SIMILAR flags at item 25+ (cycle 5 wrapping to cycle 0's scale);
// each value here is spaced further than `MOTIF_SIZE_RELATIVE_TOLERANCE`
// from every other so the similarity gate never flags a same-cycle-count
// collection on scale alone.
const SCALE_MULTIPLIERS_BY_CYCLE = [1, 0.82, 1.18, 0.92, 1.3, 1.45];

export function generateCollection(intent: DesignIntent, size = 10): Concept[] {
  const baseSeed = `v3-collection-${intent.keyword.replace(/\s+/g, '-').toLowerCase() || 'untitled'}`;
  const total = Math.max(1, size);
  const concepts: Concept[] = [];
  for (let i = 0; i < total; i++) {
    const template = CONCEPT_TEMPLATES[i % CONCEPT_TEMPLATES.length];
    const cycle = Math.floor(i / CONCEPT_TEMPLATES.length);
    const scaleMul = SCALE_MULTIPLIERS_BY_CYCLE[cycle % SCALE_MULTIPLIERS_BY_CYCLE.length];
    const seed = deriveSeed(baseSeed, 'v3-collection-item', i);
    const baseParams = buildBaseParamsFromIntent(intent, seed);
    const densityBase = DENSITY_BASE[intent.density];
    const params: GenerateParams = {
      ...baseParams,
      layoutId: template.layoutId,
      density: clamp01(densityBase * template.densityMul),
      negativeSpace: clamp01((baseParams.negativeSpace ?? 0) + template.negativeSpaceDelta),
      rotationJitter: baseParams.rotationJitter * template.rotationJitterMul,
      motifSize: baseParams.motifSize * scaleMul,
      seed,
    };
    const label = cycle === 0 ? template.label : `${template.label} (scale ${Math.round(scaleMul * 100)}%)`;
    concepts.push(buildConceptFromParams(`${baseSeed}-item-${i}`, label, params, `${baseSeed}-${i}`));
  }
  return concepts;
}

/** Milestone 11 — Refinement. Never mutates or overwrites the original
 * concept; always returns a brand-new `Concept` with a fresh id/seed so
 * the original stays in the gallery untouched (non-destructive, matching
 * the same principle the shared Design Refinement's
 * `saveDesignVersion`/`listDesignVersions` already established for
 * catalog-imported assets — this is the equivalent for the pre-import,
 * in-session concept-exploration stage). */
export function refineConcept(original: Concept, overrides: Partial<Pick<GenerateParams, 'density' | 'negativeSpace' | 'motifSize' | 'rotationJitter' | 'paletteId'>>): Concept {
  const versionSuffix = `refined-${Date.now().toString(36)}`;
  const params: GenerateParams = {
    ...original.params,
    ...overrides,
    density: overrides.density !== undefined ? clamp01(overrides.density) : original.params.density,
    negativeSpace: overrides.negativeSpace !== undefined ? clamp01(overrides.negativeSpace) : original.params.negativeSpace,
    seed: `${original.params.seed}-${versionSuffix}`,
  };
  return buildConceptFromParams(`${original.id}-${versionSuffix}`, `${original.label} (refined)`, params, `${original.id}-${versionSuffix}`);
}
