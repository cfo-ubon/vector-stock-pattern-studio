// Build 025, Phase 11 (revised): renders the NEW production output — with
// `engine/connectivityRepair.ts`'s connectivity-aware thinning repair now
// active by default for every `premiumHero` style — for the identical
// `m25-1`..`m25-100` seed set `build025BeforeAfterEvidence.ts` already
// rendered as "before" (that script ran BEFORE this fix existed, so its
// `before_production/` output is the genuine pre-fix baseline; this script
// only needs to add the genuine post-fix "after").
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
  const afterDir = path.join(outRoot, 'after_fixed');
  const svgDir = path.join(outRoot, 'svg');
  for (const d of [afterDir, svgDir]) fs.mkdirSync(d, { recursive: true });

  try {
    for (const seed of SEEDS) {
      const params = buildPortfolioParams('luxuryFloral', seed);
      const tile = buildTile(params);
      fs.writeFileSync(path.join(svgDir, `${seed}_after_fixed.svg`), buildSingleTileSvg(tile));

      for (const { name, px } of SCALES) {
        const svgMarkup = buildSvgDocument(tile.svg, px, px, params.tileSize, params.tileSize);
        const page = await browser.newPage({ viewport: { width: px, height: px } });
        await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${svgMarkup}</body></html>`);
        await page.locator('svg').first().screenshot({ path: path.join(afterDir, `${seed}_${name}.png`) });
        await page.close();
      }
      console.log(`Rendered after_fixed ${seed}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Done: ${SEEDS.length} patterns x ${SCALES.length} scales -> ${afterDir}`);
}

main();
