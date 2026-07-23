// Build 025 (Luxury Floral Composition & Stability Engine), Phase 11:
// controlled before/after visual evidence. Because BUILD_025_AUDIT.md
// Section 6 disclosed the new Composition Engine ships DISABLED by default
// (it does not clear the fragmentation target and introduces real
// regressions -- see the audit), "before" and "after" here are the
// PRODUCTION baseline (`luxuryComposition` unset, what every user actually
// gets) vs the EXPERIMENTAL engine (`luxuryComposition: true`, not shipped)
// on the identical seed set -- this is evidence supporting the audit's
// disposition, not a shipped-vs-previous-build comparison. Reuses
// `scripts/qualityReport.ts`'s `buildPortfolioParams` + the exact same
// `m25-N` seed set the Phase 9 fragmentation benchmark used, so every
// pair here is directly traceable to a row in
// `reports/build_025/fragmentation_benchmark.json`.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTile } from '../src/engine/tile';
import { buildPortfolioParams } from './qualityReport';
import { buildSvgDocument, buildSingleTileSvg } from '../src/export/svgExporter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAIR_COUNT = 100;
const SEEDS = Array.from({ length: PAIR_COUNT }, (_, i) => `m25-${i + 1}`);
const SCALES: Array<{ name: string; px: number }> = [
  { name: 'full', px: 900 },
  { name: '256', px: 256 },
];

async function main() {
  const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const chromium = playwrightModule.default.chromium;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const outRoot = path.resolve(__dirname, '../../reports/build_025/before_after');
  const beforeDir = path.join(outRoot, 'before_production');
  const afterDir = path.join(outRoot, 'after_experimental');
  const svgDir = path.join(outRoot, 'svg');
  for (const d of [beforeDir, afterDir, svgDir]) fs.mkdirSync(d, { recursive: true });

  const manifest: any[] = [];

  try {
    for (const seed of SEEDS) {
      const baseParams = buildPortfolioParams('luxuryFloral', seed);
      const expParams = { ...baseParams, luxuryComposition: true };

      const beforeTile = buildTile(baseParams);
      const afterTile = buildTile(expParams);

      fs.writeFileSync(path.join(svgDir, `${seed}_before.svg`), buildSingleTileSvg(beforeTile));
      fs.writeFileSync(path.join(svgDir, `${seed}_after.svg`), buildSingleTileSvg(afterTile));

      for (const { name, px } of SCALES) {
        const beforeSvg = buildSvgDocument(beforeTile.svg, px, px, baseParams.tileSize, baseParams.tileSize);
        const pageBefore = await browser.newPage({ viewport: { width: px, height: px } });
        await pageBefore.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${beforeSvg}</body></html>`);
        await pageBefore.locator('svg').first().screenshot({ path: path.join(beforeDir, `${seed}_${name}.png`) });
        await pageBefore.close();

        const afterSvg = buildSvgDocument(afterTile.svg, px, px, expParams.tileSize, expParams.tileSize);
        const pageAfter = await browser.newPage({ viewport: { width: px, height: px } });
        await pageAfter.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${afterSvg}</body></html>`);
        await pageAfter.locator('svg').first().screenshot({ path: path.join(afterDir, `${seed}_${name}.png`) });
        await pageAfter.close();
      }

      manifest.push({ seed, files: { beforeSvg: `svg/${seed}_before.svg`, afterSvg: `svg/${seed}_after.svg` } });
      console.log(`Rendered pair ${seed}`);
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(outRoot, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), pairCount: manifest.length, scales: SCALES.map((s) => s.name), pairs: manifest }, null, 2),
  );
  console.log(`Done: ${manifest.length} pairs x ${SCALES.length} scales -> ${outRoot}`);
}

main();
