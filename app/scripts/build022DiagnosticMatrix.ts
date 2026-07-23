// Build 022 (see BUILD_022_AUDIT.md — the requested "Build 012" number
// collides with the real, already-shipped docs/build_reports/BUILD_012_REPORT.md,
// so this work ships as Build 022) — Phase 2: Weak-Preset Diagnostic Matrix.
//
// Pure measurement, zero new scoring/generation logic: reuses
// scripts/qualityReport.ts's own real evaluation pipeline (evaluate,
// buildPortfolioParams, STYLE_IDS, breakdownBy, namedPenaltyRates,
// visualIssueRates) exactly as its own Large/XL/Consistency Portfolio
// tiers already do, over a fresh 30-seeds-per-preset sample (450 patterns,
// same "extend, don't redefine" discipline every prior tier used) — this
// is the "Full Style DNA benchmark: every preset, at least 30 patterns"
// tier from the brief's Phase 11A, doubling as Phase 2's diagnostic
// matrix input.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluate,
  buildPortfolioParams,
  STYLE_IDS,
  breakdownBy,
  namedPenaltyRates,
  visualIssueRates,
  type EvalResult,
} from './qualityReport';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MATRIX_SEEDS = Array.from({ length: 30 }, (_, i) => `m22-${i + 1}`);

function runMatrixPortfolio(): EvalResult[] {
  const results: EvalResult[] = [];
  for (const styleId of STYLE_IDS) {
    for (const seed of MATRIX_SEEDS) {
      results.push(evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId));
    }
  }
  return results;
}

function topFailureMode(penaltyRates: Record<string, number>, issueRates: Record<string, number>): string {
  const entries = [
    ...Object.entries(penaltyRates).map(([k, v]) => ({ k: `penalty:${k}`, v })),
    ...Object.entries(issueRates).map(([k, v]) => ({ k: `issue:${k}`, v })),
  ].filter((e) => e.v > 0);
  if (entries.length === 0) return 'none detected';
  entries.sort((a, b) => b.v - a.v);
  return `${entries[0].k} (${entries[0].v}% of samples)`;
}

function main() {
  console.log(`Generating diagnostic matrix: ${STYLE_IDS.length} presets x ${MATRIX_SEEDS.length} seeds = ${STYLE_IDS.length * MATRIX_SEEDS.length} patterns...`);
  const start = Date.now();
  const results = runMatrixPortfolio();
  const elapsedMs = Date.now() - start;
  console.log(`Generated in ${elapsedMs}ms`);

  const byPreset = breakdownBy(results, (r) => r.styleDnaId ?? 'unknown');

  const rows = STYLE_IDS.map((styleId) => {
    const agg = byPreset[styleId];
    const label = STYLE_DNA_PRESETS[styleId].label;
    const m = agg;
    return {
      styleId,
      label,
      n: agg.n,
      commercialScore: m.absoluteCommercialQuality?.mean ?? null,
      composition: m.composition?.mean ?? null,
      heroVisibility: m.heroVisibility?.mean ?? null,
      hierarchy: m.hierarchy?.mean ?? null,
      negativeSpaceQuality: m.largestEmptyRegion?.mean ?? null,
      rhythm: m.flowCoherence?.mean ?? null,
      density: m.occupancyRatio?.mean ?? null,
      overlapQuality: m.overlapQuality?.mean ?? null,
      edgeContinuity: m.cornerContinuity?.mean ?? null,
      motifDiversity: m.motifShapeDiversity?.mean ?? null,
      illustrationQuality: m.illustrationQuality?.mean ?? null,
      illustrationQualityV2: m.illustrationQualityV2Overall?.mean ?? null,
      flowerRealism: m.flowerRealism?.mean ?? null,
      leafRealism: m.leafRealism?.mean ?? null,
      bouquetQuality: m.bouquetQuality?.mean ?? null,
      gestureQuality: m.gestureQuality?.mean ?? null,
      visualRichness: m.visualRichness?.mean ?? null,
      styleFit: m.styleFitQuality?.mean ?? null,
      commercialStyleFit: m.commercialStyleFit?.mean ?? null,
      productTargetFit: m.productTargetFit?.mean ?? null,
      paletteContrast: m.paletteContrast?.mean ?? null,
      luxuryComposition: m.luxuryComposition?.mean ?? null,
      spacing: m.spacing?.mean ?? null,
      commercialAppealScoreV2: m.commercialAppealScoreV2?.mean ?? null,
      failureRateCommercial: m.absoluteCommercialQuality?.failureRate ?? null,
      duplicateRisk: 'not measured in single-preset synthetic sample (see Portfolio Phase 1 for real cross-portfolio duplicate detection: 0/100)',
      mainVisualFailureMode: topFailureMode(m.namedPenaltyRates, m.visualIssueRates),
    };
  });

  rows.sort((a, b) => (a.commercialScore ?? 0) - (b.commercialScore ?? 0));

  const outDir = path.resolve(__dirname, '../../reports/build_022');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'STYLE_DNA_DIAGNOSTIC_MATRIX.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sampleSize: results.length, seedsPerPreset: MATRIX_SEEDS.length, rows }, null, 2));

  const csvCols = Object.keys(rows[0]).filter((k) => k !== 'mainVisualFailureMode' && k !== 'duplicateRisk');
  const csvHeader = [...csvCols, 'mainVisualFailureMode', 'duplicateRisk'].join(',');
  const csvLines = rows.map((r) =>
    [...csvCols.map((c) => (r as any)[c]), `"${r.mainVisualFailureMode}"`, `"${r.duplicateRisk}"`].join(','),
  );
  fs.writeFileSync(path.join(outDir, 'STYLE_DNA_DIAGNOSTIC_MATRIX.csv'), [csvHeader, ...csvLines].join('\n'));

  const md: string[] = [];
  md.push('# Style DNA Diagnostic Matrix — Build 022');
  md.push('');
  md.push(`Generated from a real ${results.length}-pattern sample (${STYLE_IDS.length} presets x ${MATRIX_SEEDS.length} seeds, fixed seed set \`m22-1\`..\`m22-${MATRIX_SEEDS.length}\`, deterministic/reproducible), using the app's own existing evaluation pipeline (\`scripts/qualityReport.ts\`'s \`evaluate\`/\`buildPortfolioParams\`/\`breakdownBy\` — no new scoring logic). Sorted weakest-to-strongest by Absolute Commercial Quality.`);
  md.push('');
  md.push('| Preset | Commercial | Composition | Hero Vis. | Hierarchy | Style-Fit | Product-Target Fit | Illustration V2 | Flower Realism | Visual Richness | Palette Contrast | Fail% | Top failure mode |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    md.push(
      `| ${r.label} | ${r.commercialScore} | ${r.composition} | ${r.heroVisibility} | ${r.hierarchy} | ${r.styleFit} | ${r.productTargetFit} | ${r.illustrationQualityV2 ?? 'n/a'} | ${r.flowerRealism ?? 'n/a'} | ${r.visualRichness ?? 'n/a'} | ${r.paletteContrast} | ${r.failureRateCommercial}% | ${r.mainVisualFailureMode} |`,
    );
  }
  md.push('');
  md.push('Full per-metric breakdown (composition sub-scores, all penalty/issue rates) in `STYLE_DNA_DIAGNOSTIC_MATRIX.json`.');
  fs.writeFileSync(path.join(outDir, 'STYLE_DNA_DIAGNOSTIC_MATRIX.md'), md.join('\n') + '\n');

  console.log(`Wrote matrix for ${rows.length} presets to ${outDir}`);
  console.log('Weakest 5 by Absolute Commercial Quality:');
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.label}: commercial=${r.commercialScore} styleFit=${r.styleFit} productTargetFit=${r.productTargetFit} illustrationV2=${r.illustrationQualityV2} visualRichness=${r.visualRichness} topFailure=${r.mainVisualFailureMode}`);
  }
}

main();
