import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTileWithHeroRetry } from '../src/engine/heroDetector';
import { serialize } from '../src/engine/svgAst';
import { buildPortfolioParams } from './qualityReport';

// Build 011.5: renders the exact best/median/worst tile (by Absolute
// Commercial Quality, as picked by commercialRealityCheck.ts's own
// per-preset summary) for every one of the 15 presets -- 45 real,
// reproducible SVG files (same seed policy, same buildTile pipeline) for
// direct visual/art-director inspection. Writes each as a standalone SVG
// and as a 2x2-tiled HTML wrapper (so the seamless repeat is actually
// visible, not just one isolated tile) for later PNG rasterization.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baselinesDir = path.resolve(__dirname, '../../docs/build_reports/baselines');
const outDir = path.resolve(__dirname, '../../docs/build_reports/build_011_5_samples');

const reportPath = path.join(baselinesDir, 'BUILD_011_5_commercial_reality_check.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

fs.mkdirSync(outDir, { recursive: true });

interface RenderedSample {
  styleId: string;
  label: string;
  role: 'best' | 'median' | 'worst';
  seed: string;
  svgFile: string;
  htmlFile: string;
}

const rendered: RenderedSample[] = [];

for (const summary of report.presetSummaries as Array<{ styleId: string; label: string; bestSeed: string; medianSeed: string; worstSeed: string }>) {
  const roles: Array<['best' | 'median' | 'worst', string]> = [
    ['best', summary.bestSeed],
    ['median', summary.medianSeed],
    ['worst', summary.worstSeed],
  ];
  for (const [role, seed] of roles) {
    const params = buildPortfolioParams(summary.styleId, seed);
    const { tileData } = buildTileWithHeroRetry(params);
    const svgMarkup = serialize(tileData.svg);
    const fileBase = `${summary.styleId}_${role}`;
    const svgFile = `${fileBase}.svg`;
    const htmlFile = `${fileBase}.html`;
    fs.writeFileSync(path.join(outDir, svgFile), svgMarkup);

    // `serialize(tileData.svg)` returns only the inner `<g id="tile-content">`
    // group (no root <svg>/viewBox) -- a bare <g> outside an <svg> context
    // renders as nothing in a plain HTML page, so this wraps 9 translated
    // copies inside one real <svg viewBox> element (the same 3x3-repeat
    // convention `PreviewCanvas.tsx` already uses for its own seamless-tile
    // preview) rather than emitting 9 separate <svg> tags.
    const tileSize = params.tileSize;
    const cells = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => `<g transform="translate(${col * tileSize} ${row * tileSize})">${svgMarkup}</g>`)).join('');
    const DISPLAY_SIZE = 1000;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #fff; }
    </style></head><body>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tileSize * 3} ${tileSize * 3}" width="${DISPLAY_SIZE}" height="${DISPLAY_SIZE}">${cells}</svg>
    </body></html>`;
    fs.writeFileSync(path.join(outDir, htmlFile), html);

    rendered.push({ styleId: summary.styleId, label: summary.label, role, seed, svgFile, htmlFile });
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(rendered, null, 2));
console.log(`Rendered ${rendered.length} samples to ${outDir}`);
