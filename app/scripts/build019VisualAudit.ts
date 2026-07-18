import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stats } from './qualityReport';
import { defaultParams } from '../src/engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../src/engine/styleDna';
import { buildTileForGenerate } from '../src/engine/heroDetector';
import { computeHeroVisibilityScore, computeOverallScore } from '../src/engine/scoring';
import { computeBotanicalBeautyMetrics, BOTANICAL_BEAUTY_DIMENSIONS } from '../src/engine/botanicalBeautyMetrics';
import { computeLuxuryCompositionScore } from '../src/engine/luxuryComposition';
import { extractInstances } from '../src/engine/svgGeometry';
import { computeCommercialAppealScoreV2 } from '../src/critic/commercialAppealScore';
import { evaluateCommercialPatternCritique } from '../src/critic/commercialPatternCritic';
import { GENERATORS } from '../src/generators';
import type { GenerateParams } from '../src/engine/types';

// Build 019 ("Visual Commercial Upgrade"), Priority 1 — Evidence-Based
// Audit. Reuses every scoring/metric system exactly as Build 018's own
// `build018BotanicalAudit.ts` did (see that file's doc comment for the
// precedent this follows): no new scoring formula anywhere in this
// script, only real calls into `botanicalBeautyMetrics.ts`,
// `luxuryComposition.ts`, `commercialAppealScore.ts`, `commercialPatternCritic.ts`,
// and `scoring.ts` — plus `heroDetector.ts`'s own `buildTileForGenerate`,
// the exact quality-retry path every real generation already goes
// through, so this audit measures shipped output, not a raw untried
// composition.
//
// Sample: broader than Build 018's own 60-pattern diversity-engine-only
// sample, per this build's explicit brief ("all Style DNA presets,
// multiple seeds, relevant pattern types, relevant density levels").
// Covers every Style DNA preset whose `categories` list includes
// 'botanical' (8 of 15 presets — the only ones for which Botanical
// Realism/Organic Flow/Botanical Relationships are even meaningful,
// following `computeBotanicalBeautyMetrics`'s own category-gating
// convention in `qualityReport.ts`), x 4 seeds x 3 density bands (low/
// medium/high) = 96 patterns, each pattern's `categoryId` forced to
// 'botanical' (a mixed-category preset's own random category pick is
// irrelevant to *this* audit's question) while every other resolved
// Style DNA field (palette, layout, zone, family, hierarchy, ...) is
// left exactly as `resolveStyleDna` computed it.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

const SEEDS = ['b019-1', 'b019-2', 'b019-3', 'b019-4'];
const DENSITY_LEVELS: Array<{ label: string; value: number }> = [
  { label: 'low', value: 0.3 },
  { label: 'medium', value: 0.55 },
  { label: 'high', value: 0.8 },
];

function botanicalStyleIds(): string[] {
  return Object.values(STYLE_DNA_PRESETS)
    .filter((dna) => dna.categories.includes('botanical'))
    .map((dna) => dna.id);
}

interface SampleItem {
  params: GenerateParams;
  styleId: string;
  density: string;
}

function buildSample(): SampleItem[] {
  const botanicalMotifSize = GENERATORS.botanical.defaultMotifSize;
  const out: SampleItem[] = [];
  for (const styleId of botanicalStyleIds()) {
    const dna = STYLE_DNA_PRESETS[styleId];
    for (const seed of SEEDS) {
      const resolved = resolveStyleDna(dna, seed);
      for (const d of DENSITY_LEVELS) {
        out.push({
          styleId,
          density: d.label,
          params: {
            ...defaultParams(),
            ...resolved,
            categoryId: 'botanical',
            motifSize: botanicalMotifSize,
            density: d.value,
            seed: `${seed}-${d.label}`,
          },
        });
      }
    }
  }
  return out;
}

/** Every "visual quality dimension" the brief names, each mapped to a
 * real, already-implemented measurement (see each field's own comment
 * for which existing system it comes from — no new scoring anywhere). */
interface AuditRow {
  styleId: string;
  density: string;
  overallVisualQuality: number;
  heroVisibility: number;
  composition: number;
  negativeSpace: number;
  layeredDepth: number;
  commercialReadiness: number;
  botanical: ReturnType<typeof computeBotanicalBeautyMetrics>;
  attempts: number;
  regenerated: boolean;
}

function runSample(sample: SampleItem[]): AuditRow[] {
  return sample.map(({ params, styleId, density }) => {
    const retry = buildTileForGenerate(params);
    const { tileData, metrics, attempts, regenerated } = retry;
    const botanical = computeBotanicalBeautyMetrics(tileData, metrics);
    const heroVisibility = computeHeroVisibilityScore(metrics);
    // Negative space: `luxuryComposition.ts`'s own `breathingRoom` (Build
    // 009, Section 7) — real negative-space-around-hero measurement.
    const luxuryComposition = computeLuxuryCompositionScore(extractInstances(tileData), params.tileSize, metrics);
    // Layered depth: `metrics.heroSeparation` — the existing
    // CompositionMetrics field that measures exactly "does the hero read
    // as its own foreground plane, distinct from the surrounding
    // background/filler layer" (see `engine/scoring.ts`'s own doc
    // comment on `computeHeroSeparation`) — the closest already-real
    // measurement to "foreground/background separation", the same
    // "reuse an existing field under an honest label" convention
    // `computeBotanicalBeautyMetrics` itself already established for
    // Flower Hierarchy/Natural Growth/Cluster Harmony/Asset Harmony.
    const layeredDepth = metrics.heroSeparation;
    // Commercial readiness: Build 011 Section 9's own umbrella score,
    // built from the same commercial-pattern critique every other
    // reporting script already reuses.
    const commercialPatternCritique = evaluateCommercialPatternCritique({
      metrics, categoryId: params.categoryId, tileSize: params.tileSize, density: params.density, keywordText: STYLE_DNA_PRESETS[styleId].label, heroVisibility, botanical,
    });
    const commercialAppealScoreV2 = computeCommercialAppealScoreV2({ critique: commercialPatternCritique, heroVisibility });
    // Overall visual quality: the umbrella Absolute Commercial Quality
    // score every other build report in this repo already treats as the
    // single top-line number (`computeOverallScore(metrics, 'stockClean').score`).
    const overallVisualQuality = computeOverallScore(metrics, 'stockClean').score;

    return {
      styleId,
      density,
      overallVisualQuality,
      heroVisibility,
      composition: metrics.composition,
      negativeSpace: luxuryComposition.breathingRoom,
      layeredDepth,
      commercialReadiness: commercialAppealScoreV2.overall,
      botanical,
      attempts,
      regenerated,
    };
  });
}

const REPORTED_DIMENSIONS: Array<{ key: string; label: string; get: (r: AuditRow) => number }> = [
  { key: 'overallVisualQuality', label: 'Overall Visual Quality', get: (r) => r.overallVisualQuality },
  { key: 'heroVisibility', label: 'Hero Visibility', get: (r) => r.heroVisibility },
  { key: 'composition', label: 'Composition', get: (r) => r.composition },
  { key: 'negativeSpace', label: 'Negative Space (breathingRoom)', get: (r) => r.negativeSpace },
  { key: 'layeredDepth', label: 'Layered Depth (heroSeparation)', get: (r) => r.layeredDepth },
  { key: 'commercialReadiness', label: 'Commercial Readiness', get: (r) => r.commercialReadiness },
  ...BOTANICAL_BEAUTY_DIMENSIONS.map((d) => ({
    key: d.key as string,
    label: d.label,
    get: (r: AuditRow) => r.botanical[d.key],
  })),
];

function main() {
  const label = process.argv[2] ?? 'run';
  const __dirname = __dirnameFromUrl();
  const outDir = path.join(__dirname, '..', '..', 'docs', 'build_reports');
  fs.mkdirSync(outDir, { recursive: true });

  const sample = buildSample();
  const rows = runSample(sample);

  const perDimension: Record<string, ReturnType<typeof stats>> = {};
  for (const dim of REPORTED_DIMENSIONS) {
    perDimension[dim.key] = stats(rows.map(dim.get));
  }
  const retryRate = Math.round((rows.filter((r) => r.regenerated).length / rows.length) * 10000) / 100;
  const meanAttempts = Math.round((rows.reduce((a, r) => a + r.attempts, 0) / rows.length) * 100) / 100;

  const report = {
    label,
    sampleSize: rows.length,
    styleIds: botanicalStyleIds(),
    seeds: SEEDS,
    densityLevels: DENSITY_LEVELS.map((d) => d.label),
    dimensions: Object.fromEntries(REPORTED_DIMENSIONS.map((d) => [d.key, { label: d.label, ...perDimension[d.key] }])),
    retryRate,
    meanAttempts,
  };

  const ranked = [...REPORTED_DIMENSIONS].sort((a, b) => perDimension[a.key].mean - perDimension[b.key].mean);
  const weakest3 = ranked.slice(0, 3);

  console.log(`Sample size: ${rows.length} (styles=${report.styleIds.length}, seeds=${SEEDS.length}, density bands=${DENSITY_LEVELS.length})`);
  console.log('Weakest 3 dimensions (lowest mean):');
  for (const d of weakest3) {
    console.log(`  ${d.label}: mean=${perDimension[d.key].mean}, min=${perDimension[d.key].min}, p10=${perDimension[d.key].p10}`);
  }
  console.log('Full per-dimension means:', Object.fromEntries(REPORTED_DIMENSIONS.map((d) => [d.label, perDimension[d.key].mean])));
  console.log(`Retry rate: ${retryRate}% (mean attempts=${meanAttempts})`);

  const outFile = path.join(outDir, `BUILD_019_VISUAL_AUDIT_${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
}

main();
