import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildTileWithHeroRetry } from '../src/engine/heroDetector';
import { serialize } from '../src/engine/svgAst';
import { buildPortfolioParams } from './qualityReport';
import type { PortfolioManifest, PortfolioPatternRecord } from '../src/portfolio/types';

// Build 013, Section 13 (Reality-Check Visual Artifacts). Renders a
// genuinely UNCURATED sample from the 5,000-pattern manifest — selection is
// a fixed stride over the array in its original generation order (every
// Nth pattern), never sorted or filtered by any quality signal first, so
// there is no way for a "good-looking" subset to be picked. Each tile is
// re-rendered from its own real, deterministic seed via the same
// `buildPortfolioParams`/`buildTileWithHeroRetry` pipeline Section 4 used
// (read-only reuse — no new generation logic), so the image is exactly
// what that pattern's record describes, not a stand-in.

const SAMPLE_COUNT = 60;
const TILE_DISPLAY_SIZE = 220;

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function pickUncuratedSample(patterns: PortfolioPatternRecord[], n: number): PortfolioPatternRecord[] {
  const stride = Math.max(1, Math.floor(patterns.length / n));
  const sample: PortfolioPatternRecord[] = [];
  for (let i = 0; i < patterns.length && sample.length < n; i += stride) sample.push(patterns[i]);
  return sample;
}

function main() {
  const __dirname = __dirnameFromUrl();
  const baselinesDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
  const rawPath = path.join(baselinesDir, 'BUILD_013_portfolio_raw.json');
  const outDir = path.resolve(__dirname, '../../docs/build_reports/build_013_visuals');
  fs.mkdirSync(outDir, { recursive: true });

  const manifest: PortfolioManifest = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const sample = pickUncuratedSample(manifest.patterns, SAMPLE_COUNT);
  console.log(`Selected ${sample.length} patterns via fixed stride (every ${Math.floor(manifest.patterns.length / SAMPLE_COUNT)}th), no quality-based filtering.`);

  const cells: string[] = [];
  const sampleManifest: Array<{ patternId: string; styleDnaId: string; layoutId: string; percentileOverall?: number; percentileBucket?: string; absoluteCommercialQualityV2: number; duplicateStatus?: string }> = [];

  sample.forEach((p) => {
    const params = buildPortfolioParams(p.styleDnaId, p.seed);
    const { tileData } = buildTileWithHeroRetry(params);
    const svgMarkup = serialize(tileData.svg);
    const tileSize = params.tileSize;
    const cellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tileSize} ${tileSize}" width="${TILE_DISPLAY_SIZE}" height="${TILE_DISPLAY_SIZE}">${svgMarkup}</svg>`;
    const caption = `${p.patternId}<br>score ${Math.round(p.absoluteCommercialQualityV2)} · ${p.percentileBucket ?? 'n/a'}${p.duplicateStatus ? ` · ${p.duplicateStatus}` : ''}`;
    cells.push(`<figure class="cell">${cellSvg}<figcaption>${caption}</figcaption></figure>`);
    sampleManifest.push({ patternId: p.patternId, styleDnaId: p.styleDnaId, layoutId: p.layoutId, percentileOverall: p.percentileOverall, percentileBucket: p.percentileBucket, absoluteCommercialQualityV2: p.absoluteCommercialQualityV2, duplicateStatus: p.duplicateStatus });
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Build 013 — Uncurated Portfolio Sample</title><style>
    body { margin: 0; padding: 24px; background: #f4f4f4; font-family: system-ui, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    p.note { font-size: 12px; color: #555; margin: 0 0 20px; max-width: 900px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${TILE_DISPLAY_SIZE}px, 1fr)); gap: 16px; }
    .cell { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; }
    figcaption { font-size: 10px; color: #333; margin-top: 6px; line-height: 1.4; }
  </style></head><body>
    <h1>Build 013 — Uncurated Portfolio Reality Check (${sample.length} of ${manifest.patterns.length} patterns)</h1>
    <p class="note">Selection method: fixed stride over the manifest in original generation order — no sorting or filtering by score, cluster, or any quality signal before selection. This is what the portfolio actually looks like, not a curated highlight reel.</p>
    <div class="grid">${cells.join('')}</div>
  </body></html>`;

  fs.writeFileSync(path.join(outDir, 'uncurated_contact_sheet.html'), html);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(sampleManifest, null, 2));
  console.log(`Wrote ${path.join(outDir, 'uncurated_contact_sheet.html')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
