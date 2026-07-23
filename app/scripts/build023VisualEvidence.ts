// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade):
// multi-scale before/after visual evidence generator. Renders the same
// fixed (styleId, seed) pairs used by the diagnostic matrix at two scales
// (a full "detail" render and a small "thumbnail" render, matching how a
// buyer would actually encounter the pattern on a stock marketplace grid)
// so the fragmentation-reduction claim in BUILD_023_REPORT.md is backed by
// real rendered images, not only the numeric metric. This exact script
// (unchanged) is run once from a worktree pinned to the Build 022 baseline
// commit (525c1d1) to produce the "before" set, and once from this branch
// to produce the "after" set — see BUILD_023_AUDIT.md Section 4.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTile } from '../src/engine/tile';
import { buildPortfolioParams } from './qualityReport';
import { buildSvgDocument } from '../src/export/svgExporter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLES: Array<{ styleId: string; seed: string }> = [
  { styleId: 'luxuryFloral', seed: 'm22-1' },
  { styleId: 'luxuryFloral', seed: 'm22-2' },
  { styleId: 'darkBotanical', seed: 'm22-1' },
  { styleId: 'darkBotanical', seed: 'm22-2' },
  { styleId: 'bohoFloral', seed: 'm22-1' },
  { styleId: 'editorialBotanical', seed: 'm22-1' }, // control: non-cluster-thinned premiumHero preset
];

const DETAIL_PX = 800;
const THUMB_PX = 160;

async function renderPng(svgMarkup: string, outPath: string, chromium: any, px: number) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: px, height: px } });
    await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${svgMarkup}</body></html>`);
    await page.locator('svg').first().screenshot({ path: outPath });
    await page.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  const tag = process.env.EVIDENCE_TAG || 'unlabeled';
  const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const chromium = playwrightModule.default.chromium;

  const outRoot = path.resolve(__dirname, '../../reports/build_023/visual_evidence', tag);
  fs.mkdirSync(outRoot, { recursive: true });

  for (const { styleId, seed } of SAMPLES) {
    const params = buildPortfolioParams(styleId, seed);
    const tile = buildTile(params);
    const base = `${styleId}_${seed}`;
    const detailSvg = buildSvgDocument(tile.svg, DETAIL_PX, DETAIL_PX, params.tileSize, params.tileSize);
    const thumbSvg = buildSvgDocument(tile.svg, THUMB_PX, THUMB_PX, params.tileSize, params.tileSize);
    await renderPng(detailSvg, path.join(outRoot, `${base}_detail.png`), chromium, DETAIL_PX);
    await renderPng(thumbSvg, path.join(outRoot, `${base}_thumb.png`), chromium, THUMB_PX);
    console.log(`Rendered ${base} (detail ${DETAIL_PX}px, thumb ${THUMB_PX}px) -> ${outRoot}`);
  }
}

main();
