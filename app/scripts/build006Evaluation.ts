import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTileWithHeroRetry } from '../src/engine/heroDetector';
import { defaultParams } from '../src/engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../src/engine/styleDna';
import { computeOverallScore, computeHeroVisibilityScore } from '../src/engine/scoring';
import { computePatternBeautyScore } from '../src/engine/patternBeautyScore';
import { computeBotanicalBeautyMetrics } from '../src/engine/botanicalBeautyMetrics';
import { computeIllustrationQuality, computeVisualRichness, computeSpeciesDiversity } from '../src/engine/portfolioQuality';
import { evaluateCommercialPatternCritique } from '../src/critic/commercialPatternCritic';
import { buildSvgDocument, buildSingleTileSvg } from '../src/export/svgExporter';
import { countNodes } from '../src/engine/svgGeometry';
import type { BotanicalFamily } from '../src/generators/botanicalFamilies';

// Build 006 Visual Evaluation Portfolio — evaluation only, no generation
// logic touched. Reuses the EXACT SAME seed policy and pipeline as
// scripts/qualityReport.ts's own 100-pattern portfolio (resolveStyleDna +
// buildTileWithHeroRetry, identical scoring functions) so every number
// here is directly comparable to Build 005/006's existing baselines --
// this script only ADDS export (SVG/PNG files + a manifest), it doesn't
// compute anything qualityReport.ts doesn't already compute the same way.
//
// 5 uncurated seeds per preset (the first 5 of qualityReport.ts's own
// frozen 'p-1'..'p-7' portfolio seeds) x 15 presets = 75 patterns, in
// STYLE_DNA_PRESETS' own fixed insertion order -- nothing hand-picked or
// re-rolled.

const EVAL_SEEDS = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'];
const STYLE_IDS = Object.keys(STYLE_DNA_PRESETS);
const PREVIEW_PX = 800;

interface PatternRecord {
  preset: string;
  presetLabel: string;
  seed: string;
  categoryId: string;
  layoutId: string;
  compositionZone: string;
  botanicalFamily: string;
  clusterType: string;
  colorStory: string;
  paletteId: string;
  nodeCount: number;
  absoluteCommercialQuality: number;
  heroVisibility: number;
  patternBeautyScore: number;
  illustrationQuality: number | null;
  visualRichness: number | null;
  botanicalRealism: number | null;
  luxuryFeeling: number;
  editorialFeeling: number;
  premiumFeeling: number;
  fabricFeeling: number;
  wallpaperFeeling: number;
  giftWrapFeeling: number;
  visualStory: number;
  svgFile: string;
  pngFile: string;
}

async function renderPreviewPng(svgMarkup: string, outPath: string, chromium: any) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: PREVIEW_PX, height: PREVIEW_PX } });
    const html = `<!doctype html><html><body style="margin:0;padding:0;">${svgMarkup}</body></html>`;
    await page.setContent(html);
    const svgEl = page.locator('svg').first();
    await svgEl.screenshot({ path: outPath });
    await page.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  // Playwright is a globally-installed tool in this environment, not a
  // project dependency (evaluation-only tooling -- no package.json change).
  const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const chromium = playwrightModule.default.chromium;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outRoot = path.resolve(__dirname, '../../docs/build_reports/BUILD_006_EVALUATION');
  const svgDir = path.join(outRoot, 'svg');
  const pngDir = path.join(outRoot, 'png');
  fs.mkdirSync(svgDir, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });

  const records: PatternRecord[] = [];
  let index = 0;
  const total = STYLE_IDS.length * EVAL_SEEDS.length;

  for (const styleId of STYLE_IDS) {
    const dna = STYLE_DNA_PRESETS[styleId];
    for (const seed of EVAL_SEEDS) {
      index++;
      const resolved = resolveStyleDna(dna, seed);
      const params = { ...defaultParams(), ...resolved, seed };
      const { tileData: tile, metrics } = buildTileWithHeroRetry(params);

      const absoluteCommercialQuality = computeOverallScore(metrics, 'stockClean').score;
      const heroVisibility = computeHeroVisibilityScore(metrics);
      const patternBeautyScore = computePatternBeautyScore(metrics).overall;

      let illustrationQuality: number | null = null;
      let visualRichness: number | null = null;
      let botanicalMetrics: ReturnType<typeof computeBotanicalBeautyMetrics> | undefined;
      if (params.categoryId === 'botanical') {
        botanicalMetrics = computeBotanicalBeautyMetrics(tile, metrics);
        illustrationQuality = computeIllustrationQuality(botanicalMetrics);
        visualRichness = computeVisualRichness(botanicalMetrics);
      }

      const keywordText = dna.label;
      const critique = evaluateCommercialPatternCritique({
        metrics, categoryId: params.categoryId, tileSize: params.tileSize, density: params.density,
        keywordText, heroVisibility, botanical: botanicalMetrics,
      });

      const baseName = `${styleId}_${seed}`;
      const svgFileName = `${baseName}.svg`;
      const pngFileName = `${baseName}.png`;

      // Full SVG: the exact same 3000x3000 optimized single-tile export the
      // real app produces via its own "Export single tile SVG" button --
      // reused directly, not reimplemented.
      const fullSvg = buildSingleTileSvg(tile);
      fs.writeFileSync(path.join(svgDir, svgFileName), fullSvg);

      // Preview: a smaller (800x800), non-optimized render of the same raw
      // tile content, for quick visual scanning without opening a 3000px file.
      const previewSvg = buildSvgDocument(tile.svg, PREVIEW_PX, PREVIEW_PX, params.tileSize, params.tileSize);
      await renderPreviewPng(previewSvg, path.join(pngDir, pngFileName), chromium);

      const clusterType = params.clusterArchetypes?.[0] ?? 'n/a';
      const nodeCount = countNodes(tile.svg);

      records.push({
        preset: styleId,
        presetLabel: dna.label,
        seed,
        categoryId: params.categoryId,
        layoutId: params.layoutId,
        compositionZone: params.compositionZone ?? 'n/a',
        botanicalFamily: params.botanicalFamily ?? 'n/a',
        clusterType,
        colorStory: params.paletteId,
        paletteId: params.paletteId,
        nodeCount,
        absoluteCommercialQuality,
        heroVisibility,
        patternBeautyScore,
        illustrationQuality,
        visualRichness,
        botanicalRealism: critique.botanicalRealism ?? null,
        luxuryFeeling: critique.luxuryFeeling,
        editorialFeeling: critique.editorialFeeling,
        premiumFeeling: critique.premiumFeeling,
        fabricFeeling: critique.fabricFeeling,
        wallpaperFeeling: critique.wallpaperFeeling,
        giftWrapFeeling: critique.giftWrapFeeling,
        visualStory: critique.visualStory,
        svgFile: `svg/${svgFileName}`,
        pngFile: `png/${pngFileName}`,
      });

      console.log(`[${index}/${total}] ${styleId}@${seed} -> ACQ=${absoluteCommercialQuality} HeroVis=${heroVisibility}`);
    }
  }

  const speciesDiversity = computeSpeciesDiversity(records.map((r) => (r.botanicalFamily !== 'n/a' ? (r.botanicalFamily as BotanicalFamily) : undefined)));

  const manifest = {
    generatedAt: new Date().toISOString(),
    seedPolicy: EVAL_SEEDS,
    presetCount: STYLE_IDS.length,
    seedsPerPreset: EVAL_SEEDS.length,
    total: records.length,
    speciesDiversity,
    records,
  };

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const csvHeader = [
    'preset', 'presetLabel', 'seed', 'categoryId', 'layoutId', 'compositionZone', 'botanicalFamily',
    'clusterType', 'colorStory', 'nodeCount', 'absoluteCommercialQuality', 'heroVisibility', 'patternBeautyScore',
    'illustrationQuality', 'visualRichness', 'botanicalRealism', 'luxuryFeeling', 'editorialFeeling',
    'premiumFeeling', 'fabricFeeling', 'wallpaperFeeling', 'giftWrapFeeling', 'visualStory', 'svgFile', 'pngFile',
  ];
  const csvRows = records.map((r) => csvHeader.map((k) => String((r as any)[k] ?? '')).join(','));
  fs.writeFileSync(path.join(outRoot, 'manifest.csv'), [csvHeader.join(','), ...csvRows].join('\n') + '\n');

  console.log(`\nWrote ${records.length} patterns to ${outRoot}`);
  console.log(`Species Diversity (portfolio-level, n=${records.length}): ${speciesDiversity}%`);
}

main();
