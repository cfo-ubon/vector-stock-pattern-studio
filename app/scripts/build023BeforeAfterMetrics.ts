// Build 023 (Visual Beauty & Premium Art Direction Engine), Step 13/16
// support: computes the SAME per-sample metrics (fragmentedSilhouette,
// deadSpace, absoluteCommercialQuality[V2]) for the exact 70-pattern
// before/after sample set `build023BeforeAfterEvidence.ts` renders images
// for, so the "at least 80% of pairs must show visible improvement"
// acceptance target has an objective, reproducible backing metric
// alongside the human-reviewed images -- run once per branch (this script
// is identical in both trees), output diffed by a follow-up compare step.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, buildPortfolioParams } from './qualityReport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MATRIX_SEEDS = (n: number) => Array.from({ length: n }, (_, i) => `m22-${i + 1}`);

const SAMPLES: Array<{ category: string; styleId: string; seed: string }> = [
  ...MATRIX_SEEDS(20).map((seed) => ({ category: 'luxuryFloral', styleId: 'luxuryFloral', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'premiumBotanicalFloral_darkBotanical', styleId: 'darkBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'premiumBotanicalFloral_bohoFloral', styleId: 'bohoFloral', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'editorialBotanical', styleId: 'editorialBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'minimalBotanical', styleId: 'minimalBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'strongControl_scandinavianOrganic', styleId: 'scandinavianOrganic', seed })),
];

function main() {
  const tag = process.env.EVIDENCE_TAG || 'unlabeled';
  const rows = SAMPLES.map(({ category, styleId, seed }) => {
    const r = evaluate(`${styleId}@${seed}`, buildPortfolioParams(styleId, seed), styleId);
    return {
      category,
      styleId,
      seed,
      fragmentedSilhouette: !!r.issues.fragmentedSilhouette,
      deadSpace: !!r.issues.deadSpace,
      commercialV1: r.absoluteCommercialQuality,
      commercialV2: r.absoluteCommercialQualityV2,
    };
  });
  const outDir = path.resolve(__dirname, '../../reports/build_023/before_after', tag);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify({ tag, rows }, null, 2));
  console.log(`Wrote ${rows.length} metric rows to ${outDir}/metrics.json`);
}

main();
