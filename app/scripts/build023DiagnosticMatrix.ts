// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade),
// Phase: Diagnostic Matrix + Benchmarks. Reuses Build 022's own
// diagnostic-matrix methodology (`scripts/qualityReport.ts`'s
// `evaluate`/`buildPortfolioParams`/`STYLE_IDS`/`breakdownBy`) — no new
// scoring/generation logic — over the same fixed 30-seed-per-preset
// sample size, so this build's "after" numbers are directly comparable
// to `reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.json`'s "before"
// snapshot (this branch's own starting point, commit 525c1d1). Explicitly
// surfaces `fragmentedSilhouette`/`deadSpace` rates per preset (Build
// 022's matrix only persisted each preset's single worst issue, not every
// issue's own rate) since those are the two metrics this build's fix
// directly trades off against each other.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, buildPortfolioParams, STYLE_IDS } from './qualityReport';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MATRIX_SEEDS = Array.from({ length: 30 }, (_, i) => `m22-${i + 1}`);

function main() {
  console.log(`Build 023 diagnostic matrix: ${STYLE_IDS.length} presets x ${MATRIX_SEEDS.length} seeds = ${STYLE_IDS.length * MATRIX_SEEDS.length} patterns...`);
  const start = Date.now();
  const rows = STYLE_IDS.map((styleId) => {
    let fragCount = 0;
    let deadSpaceCount = 0;
    let commercialSum = 0;
    let commercialV2Sum = 0;
    let n = 0;
    for (const seed of MATRIX_SEEDS) {
      const r = evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId);
      n++;
      if (r.issues.fragmentedSilhouette) fragCount++;
      if (r.issues.deadSpace) deadSpaceCount++;
      commercialSum += r.absoluteCommercialQuality;
      commercialV2Sum += r.absoluteCommercialQualityV2;
    }
    return {
      styleId,
      label: STYLE_DNA_PRESETS[styleId].label,
      premiumHero: !!STYLE_DNA_PRESETS[styleId].premiumHero,
      n,
      fragmentedSilhouetteRate: Math.round((fragCount / n) * 1000) / 10,
      deadSpaceRate: Math.round((deadSpaceCount / n) * 1000) / 10,
      commercialMean: Math.round((commercialSum / n) * 100) / 100,
      commercialV2Mean: Math.round((commercialV2Sum / n) * 100) / 100,
    };
  });
  const elapsedMs = Date.now() - start;
  console.log(`Generated in ${elapsedMs}ms`);

  rows.sort((a, b) => b.fragmentedSilhouetteRate - a.fragmentedSilhouetteRate);

  const outDir = path.resolve(__dirname, '../../reports/build_023');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'STYLE_DNA_DIAGNOSTIC_MATRIX.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), sampleSize: STYLE_IDS.length * MATRIX_SEEDS.length, seedsPerPreset: MATRIX_SEEDS.length, rows }, null, 2),
  );

  const md: string[] = [];
  md.push('# Style DNA Diagnostic Matrix — Build 023 (after)');
  md.push('');
  md.push(`Same 450-pattern methodology as Build 022's own matrix (\`m22-1\`..\`m22-30\`, 15 presets), rerun after Build 023's cluster-cohesion fixes. Compare against \`reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.json\` (this branch's real "before" state, commit 525c1d1). Sorted worst-to-best by fragmentedSilhouette rate.`);
  md.push('');
  md.push('| Preset | premiumHero | fragmentedSilhouette% | deadSpace% | Commercial V1 | Commercial V2 |');
  md.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    md.push(`| ${r.label} | ${r.premiumHero} | ${r.fragmentedSilhouetteRate} | ${r.deadSpaceRate} | ${r.commercialMean} | ${r.commercialV2Mean} |`);
  }
  fs.writeFileSync(path.join(outDir, 'STYLE_DNA_DIAGNOSTIC_MATRIX.md'), md.join('\n') + '\n');

  console.log('Wrote matrix for', rows.length, 'presets to', outDir);
  for (const r of rows) {
    console.log(`  ${r.label}: frag=${r.fragmentedSilhouetteRate}% deadSpace=${r.deadSpaceRate}% commercialV1=${r.commercialMean} commercialV2=${r.commercialV2Mean}`);
  }
}

main();
