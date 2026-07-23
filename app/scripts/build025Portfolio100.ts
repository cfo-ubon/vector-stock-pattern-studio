// Build 025 (Luxury Floral Composition & Stability Engine), Phase 12:
// 100-Pattern Validation Portfolio. Same 10-collection/10-seed methodology
// Build 023/024's own `build0{23,24}Portfolio100.ts` established. Because
// BUILD_025_AUDIT.md Section 6 disclosed that the new Composition Engine
// does not clear the brief's fragmentation target and ships DISABLED by
// default, this portfolio renders current PRODUCTION output (no
// `luxuryComposition` override) -- it validates what this build actually
// ships, not the experimental engine.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, buildPortfolioParams } from './qualityReport';
import { buildTile } from '../src/engine/tile';
import { buildSingleTileSvg, buildSvgDocument } from '../src/export/svgExporter';
import { buildBeautyReview } from '../src/critic/beautyReview';
import { generateMarketplaceSeo } from '../src/metadata/marketplaceSeo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECTIONS: Array<{ styleId: string; productTarget?: string }> = [
  { styleId: 'luxuryFloral', productTarget: 'giftWrap' },
  { styleId: 'darkBotanical', productTarget: 'wallpaper' },
  { styleId: 'bohoFloral', productTarget: 'fabric' },
  { styleId: 'editorialBotanical', productTarget: 'stationery' },
  { styleId: 'minimalBotanical', productTarget: 'textile' },
  { styleId: 'scandinavianOrganic', productTarget: 'homeDecor' },
  { styleId: 'modernTropical', productTarget: 'fabric' },
  { styleId: 'kidsPlayful', productTarget: 'textile' },
  { styleId: 'organicAbstract', productTarget: 'wallpaper' },
  { styleId: 'vintageHerbarium', productTarget: 'stationery' },
];
const SEEDS_PER_COLLECTION = 10;
const PNG_PX = 512;

function classify(commercialV2: number, fragmented: boolean, deadSpace: boolean, beautyScore: number): 'READY' | 'REVIEW' | 'REJECT' {
  if (commercialV2 < 40 || (fragmented && deadSpace)) return 'REJECT';
  if (commercialV2 < 70 || fragmented || deadSpace || beautyScore < 55) return 'REVIEW';
  return 'READY';
}

async function main() {
  const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const chromium = playwrightModule.default.chromium;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const outRoot = path.resolve(__dirname, '../../reports/build_025/portfolio_100');
  const svgDir = path.join(outRoot, 'svg');
  const pngDir = path.join(outRoot, 'png');
  const jsonDir = path.join(outRoot, 'json');
  for (const d of [svgDir, pngDir, jsonDir]) fs.mkdirSync(d, { recursive: true });

  const manifest: any[] = [];
  let readyCount = 0;
  let reviewCount = 0;
  let rejectCount = 0;

  try {
    for (const { styleId, productTarget } of COLLECTIONS) {
      for (let i = 1; i <= SEEDS_PER_COLLECTION; i++) {
        const seed = `b025-${styleId}-${i}`;
        const params = { ...buildPortfolioParams(styleId, seed), productTarget: productTarget as any };
        const evalResult = evaluate(`${styleId}@${seed}`, params, styleId);
        const tile = buildTile(params);

        const beauty = buildBeautyReview({
          metrics: evalResult.metrics,
          heroVisibility: evalResult.heroVisibility,
          fragmentedSilhouette: !!evalResult.issues.fragmentedSilhouette,
          deadSpace: !!evalResult.issues.deadSpace,
          thumbnail200: evalResult.readability.thumbnail200,
          illustrationQuality: evalResult.illustrationQuality,
          illustrationQualityV2Overall: evalResult.illustrationQualityV2?.overall,
          productTargetFit: evalResult.productTargetFit,
          productTargetFitV2: evalResult.productTargetFitV2,
        });

        const seo = generateMarketplaceSeo(tile, 'shutterstock');
        const patternId = `${styleId}_${i}`;
        const decision = classify(
          evalResult.absoluteCommercialQualityV2,
          !!evalResult.issues.fragmentedSilhouette,
          !!evalResult.issues.deadSpace,
          beauty.beautyScore,
        );
        if (decision === 'READY') readyCount++;
        else if (decision === 'REVIEW') reviewCount++;
        else rejectCount++;

        fs.writeFileSync(path.join(svgDir, `${patternId}.svg`), buildSingleTileSvg(tile));

        const previewSvg = buildSvgDocument(tile.svg, PNG_PX, PNG_PX, params.tileSize, params.tileSize);
        const page = await browser.newPage({ viewport: { width: PNG_PX, height: PNG_PX } });
        await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${previewSvg}</body></html>`);
        await page.locator('svg').first().screenshot({ path: path.join(pngDir, `${patternId}.png`) });
        await page.close();

        const record = {
          patternId,
          styleId,
          seed,
          productTarget: productTarget ?? null,
          decision,
          commercial: {
            absoluteCommercialQuality: evalResult.absoluteCommercialQuality,
            absoluteCommercialQualityV2: evalResult.absoluteCommercialQualityV2,
            productTargetFit: evalResult.productTargetFit ?? null,
            productTargetFitV2: evalResult.productTargetFitV2 ?? null,
          },
          beauty: { beautyScore: beauty.beautyScore, beautyDiagnostics: beauty.beautyDiagnostics, beautyFailureReasons: beauty.beautyFailureReasons },
          fragmentation: {
            fragmentedSilhouette: !!evalResult.issues.fragmentedSilhouette,
            deadSpace: !!evalResult.issues.deadSpace,
            clusterCohesion: evalResult.metrics.clusterCohesion,
          },
          thumbnail: evalResult.readability,
          seo: { title: seo.title, keywordCount: seo.keywords.length, keywords: seo.keywords, filename: seo.filename },
          files: { svg: `svg/${patternId}.svg`, png: `png/${patternId}.png`, json: `json/${patternId}.json` },
        };
        fs.writeFileSync(path.join(jsonDir, `${patternId}.json`), JSON.stringify(record, null, 2));
        manifest.push(record);
        console.log(`${patternId}: ${decision} (commercialV2=${evalResult.absoluteCommercialQualityV2.toFixed(1)}, beauty=${beauty.beautyScore}, keywords=${seo.keywords.length})`);
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(outRoot, 'MANIFEST.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), total: manifest.length, readyCount, reviewCount, rejectCount, patterns: manifest }, null, 2),
  );

  const csvHeader = 'pattern_id,style_id,product_target,decision,commercial_v1,commercial_v2,beauty_score,fragmented_silhouette,dead_space,thumbnail200,keyword_count';
  const csvRows = manifest.map((r) =>
    [r.patternId, r.styleId, r.productTarget ?? '', r.decision, r.commercial.absoluteCommercialQuality.toFixed(2), r.commercial.absoluteCommercialQualityV2.toFixed(2), r.beauty.beautyScore, r.fragmentation.fragmentedSilhouette, r.fragmentation.deadSpace, r.thumbnail.thumbnail200, r.seo.keywordCount].join(','),
  );
  fs.writeFileSync(path.join(outRoot, 'portfolio_manifest.csv'), [csvHeader, ...csvRows].join('\n') + '\n');

  console.log(`\nDone: ${manifest.length} patterns. READY=${readyCount} REVIEW=${reviewCount} REJECT=${rejectCount}`);
  console.log(`Output: ${outRoot}`);
}

main();
