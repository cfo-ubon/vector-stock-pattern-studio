// Build 023 (Visual Beauty & Premium Art Direction Engine), Step 13:
// controlled before/after visual evidence at 4 scales (full tile, 512px,
// 256px, 128px -- matching how a buyer actually encounters a pattern: full
// canvas in the editor, then progressively smaller marketplace thumbnails).
// Reuses the exact same (styleId, seed) methodology as Build 022/023's own
// diagnostic matrices (`m22-N` seeds) for direct comparability. Renders
// "after" from whichever branch runs this script; "before" is produced by
// running this identical, unmodified script from a worktree pinned to
// commit 525c1d1 (Build 022's final, verified commit -- the real starting
// point for every Build 023 change) via EVIDENCE_TAG=before_build022.
//
// Single shared Playwright browser instance (not one launch per PNG) --
// with ~70 patterns x 4 scales x 2 (before/after) = ~560 screenshots, a
// per-call launch would dominate wall-clock time for no benefit.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTile } from '../src/engine/tile';
import { buildPortfolioParams } from './qualityReport';
import { buildSvgDocument, buildSingleTileSvg } from '../src/export/svgExporter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SampleSpec {
  category: string;
  styleId: string;
  seed: string;
}

const MATRIX_SEEDS = (n: number) => Array.from({ length: n }, (_, i) => `m22-${i + 1}`);

// "Premium Botanical Floral" (the brief's own term) has no single matching
// built-in preset id -- the closest real analogues are this app's other
// premiumHero bouquet-composition presets (darkBotanical, bohoFloral),
// split 10/10 to reach the requested 20. Documented here rather than
// silently substituted so the mapping is auditable.
const SAMPLES: SampleSpec[] = [
  ...MATRIX_SEEDS(20).map((seed) => ({ category: 'luxuryFloral', styleId: 'luxuryFloral', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'premiumBotanicalFloral_darkBotanical', styleId: 'darkBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'premiumBotanicalFloral_bohoFloral', styleId: 'bohoFloral', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'editorialBotanical', styleId: 'editorialBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'minimalBotanical', styleId: 'minimalBotanical', seed })),
  ...MATRIX_SEEDS(10).map((seed) => ({ category: 'strongControl_scandinavianOrganic', styleId: 'scandinavianOrganic', seed })),
];

const SCALES: Array<{ name: string; px: number }> = [
  { name: 'full', px: 900 },
  { name: '512', px: 512 },
  { name: '256', px: 256 },
  { name: '128', px: 128 },
];

async function main() {
  const tag = process.env.EVIDENCE_TAG || 'unlabeled';
  const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const chromium = playwrightModule.default.chromium;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const outRoot = path.resolve(__dirname, '../../reports/build_023/before_after', tag);
  const svgRoot = path.resolve(__dirname, '../../reports/build_023/before_after', tag, 'svg');
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(svgRoot, { recursive: true });

  const manifest: any[] = [];

  try {
    for (const { category, styleId, seed } of SAMPLES) {
      const params = buildPortfolioParams(styleId, seed);
      const tile = buildTile(params);
      const base = `${category}__${styleId}_${seed}`;

      fs.writeFileSync(path.join(svgRoot, `${base}.svg`), buildSingleTileSvg(tile));

      for (const { name, px } of SCALES) {
        const svgMarkup = buildSvgDocument(tile.svg, px, px, params.tileSize, params.tileSize);
        const page = await browser.newPage({ viewport: { width: px, height: px } });
        await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${svgMarkup}</body></html>`);
        await page.locator('svg').first().screenshot({ path: path.join(outRoot, `${base}_${name}.png`) });
        await page.close();
      }

      manifest.push({ category, styleId, seed, base });
      console.log(`Rendered ${base}`);
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ tag, count: manifest.length, samples: manifest }, null, 2));
  console.log(`Done: ${manifest.length} patterns x ${SCALES.length} scales -> ${outRoot}`);
}

main();
