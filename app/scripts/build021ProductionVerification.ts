import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'fake-indexeddb/auto';
import { File as NodeFile } from 'node:buffer';
(globalThis as any).File = NodeFile;

import { generateBatchToPortfolio, type BatchProductionItemResult } from '../src/batch/batchProductionService';
import { clearPortfolioStores } from '../src/catalog/storage/portfolioStore';
import { defaultParams } from '../src/engine/defaults';
import { STYLE_DNA_PRESETS } from '../src/engine/styleDna';
import { computeMetrics } from '../src/engine/scoring';
import { buildProductionItemFiles, buildProductionCsvBundle, productionBundleBaseName } from '../src/batch/productionBundleService';
import { buildSiteMetadata } from '../src/metadata/shutterstock';

// Build 021 ("Production Ready"). Verification, not a new analysis
// system: every check below reuses an existing, unmodified function
// (`generateBatchToPortfolio` -- the real Batch Generate service every
// build since 018 has used; `computeMetrics`'s existing `svgHealth`
// field -- not a new SVG-quality metric; `buildSiteMetadata` -- the
// existing per-site SEO field builder; `productionBundleService.ts`'s
// pure SVG/EPS/CSV builders, Build 021's own packaging glue, reused
// here rather than re-implemented). This script only asserts on their
// output; it computes no new score.
//
// Covers the brief's Priorities 3-6 in one real run:
//   3. SVG quality      -- svgHealth (existing metric) + structural sanity
//                           (no NaN/Infinity/undefined) on every real
//                           exported SVG string.
//   4. SEO completeness  -- every site's every field non-empty, for every
//                           item, via the existing `buildSiteMetadata`.
//   5. Filename uniqueness -- Set-based collision check across a real
//                           200-item combined run (100 with an active
//                           Style DNA + 100 without).
//   6. Batch stability at 100 -- elapsedMs/msPerItem/errorCount/retryRate/
//                           meanAttempts/diversity, mirroring
//                           `scripts/build019BatchPerf.ts`'s own
//                           convention exactly.

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

interface RunSummary {
  label: string;
  count: number;
  elapsedMs: number;
  msPerItem: number;
  generatedCount: number;
  importedCount: number;
  possibleDuplicateCount: number;
  blockedDuplicateCount: number;
  errorCount: number;
  failureRate: number;
  retryRate: number;
  meanAttempts: number;
  distinctBotanicalFamilies: number;
  distinctCompositionZones: number;
}

async function runBatch(label: string, count: number, dnaId?: string): Promise<{ summary: RunSummary; items: BatchProductionItemResult[] }> {
  await clearPortfolioStores();
  const dna = dnaId ? STYLE_DNA_PRESETS[dnaId] : undefined;
  const params = { ...defaultParams(), categoryId: 'botanical' as const };
  const start = Date.now();
  const result = await generateBatchToPortfolio({
    count,
    params,
    activeDna: dna,
    existingAssets: [],
    seedForItem: (i) => `b021-verify-${label}-${i}`,
    diversityRngSeed: `b021-verify-diversity-${label}`,
  });
  const elapsedMs = Date.now() - start;
  const families = new Set(result.items.map((it) => it.variantParams.botanicalFamily));
  const zones = new Set(result.items.map((it) => it.variantParams.compositionZone));
  return {
    summary: {
      label,
      count,
      elapsedMs,
      msPerItem: Math.round((elapsedMs / count) * 100) / 100,
      generatedCount: result.generatedCount,
      importedCount: result.importedCount,
      possibleDuplicateCount: result.possibleDuplicateCount,
      blockedDuplicateCount: result.blockedDuplicateCount,
      errorCount: result.errorCount,
      failureRate: Math.round((result.errorCount / result.generatedCount) * 10000) / 100,
      retryRate: result.retryRate,
      meanAttempts: result.meanAttempts,
      distinctBotanicalFamilies: families.size,
      distinctCompositionZones: zones.size,
    },
    items: result.items,
  };
}

interface SvgQualityRow {
  baseName: string;
  svgHealth: number;
  svgStructurallyClean: boolean;
  epsStructurallyClean: boolean;
}

function checkSvgQuality(items: BatchProductionItemResult[]): SvgQualityRow[] {
  return items.map((item) => {
    const metrics = computeMetrics(item.tileData);
    const files = buildProductionItemFiles({ tileData: item.tileData, variantParams: item.variantParams });
    const svgStructurallyClean = files.svg.includes('<svg') && files.svg.includes('viewBox') && !/NaN|Infinity|undefined/.test(files.svg);
    const epsStructurallyClean = files.eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0') && files.eps.includes('%%EOF') && !/NaN|Infinity|undefined/.test(files.eps);
    return { baseName: files.baseName, svgHealth: metrics.svgHealth, svgStructurallyClean, epsStructurallyClean };
  });
}

interface SeoCompletenessRow {
  baseName: string;
  allFieldsNonEmpty: boolean;
  emptyFields: string[];
}

function checkSeoCompleteness(items: BatchProductionItemResult[]): SeoCompletenessRow[] {
  return items.map((item) => {
    const baseName = productionBundleBaseName(item.variantParams);
    const sites = buildSiteMetadata(item.tileData);
    const emptyFields: string[] = [];
    for (const site of sites) {
      for (const field of site.fields) {
        if (!field.value || field.value.trim().length === 0) emptyFields.push(`${site.id}.${field.label}`);
      }
    }
    return { baseName, allFieldsNonEmpty: emptyFields.length === 0, emptyFields };
  });
}

async function main() {
  const label = process.argv[2] ?? 'run';

  const withDna = await runBatch('with-editorialBotanical', 100, 'editorialBotanical');
  const noDna = await runBatch('no-style-dna', 100);
  const allItems = [...withDna.items, ...noDna.items];

  // Priority 5: filename uniqueness across the full 200-item combined run.
  const baseNames = allItems.map((item) => productionBundleBaseName(item.variantParams));
  const uniqueBaseNames = new Set(baseNames);
  const collisionCount = baseNames.length - uniqueBaseNames.size;

  // Priority 3: SVG/EPS quality on every real generated item.
  const svgRows = checkSvgQuality(allItems);
  const svgHealthValues = svgRows.map((r) => r.svgHealth);
  const svgHealthMean = Math.round((svgHealthValues.reduce((a, b) => a + b, 0) / svgHealthValues.length) * 100) / 100;
  const svgHealthMin = Math.min(...svgHealthValues);
  const svgStructurallyCleanCount = svgRows.filter((r) => r.svgStructurallyClean).length;
  const epsStructurallyCleanCount = svgRows.filter((r) => r.epsStructurallyClean).length;

  // Priority 4: SEO completeness on every real generated item.
  const seoRows = checkSeoCompleteness(allItems);
  const seoCompleteCount = seoRows.filter((r) => r.allFieldsNonEmpty).length;
  const seoIncompleteExamples = seoRows.filter((r) => !r.allFieldsNonEmpty).slice(0, 5);

  // Combined production CSVs at real 200-item scale.
  const sources = allItems.map((item) => ({ tileData: item.tileData, variantParams: item.variantParams }));
  const { shutterstockCsv, adobeStockCsv } = buildProductionCsvBundle(sources);
  const shutterstockRowCount = shutterstockCsv.split('\r\n').length - 1;
  const adobeStockRowCount = adobeStockCsv.split('\r\n').length - 1;

  const report = {
    label,
    batchStability: { withDna: withDna.summary, noDna: noDna.summary },
    filenameUniqueness: {
      totalItems: baseNames.length,
      uniqueBaseNames: uniqueBaseNames.size,
      collisionCount,
    },
    svgQuality: {
      itemCount: svgRows.length,
      svgHealthMean,
      svgHealthMin,
      svgStructurallyCleanCount,
      epsStructurallyCleanCount,
      allSvgHealthAt100: svgHealthValues.every((v) => v === 100),
    },
    seoCompleteness: {
      itemCount: seoRows.length,
      seoCompleteCount,
      incompleteCount: seoRows.length - seoCompleteCount,
      incompleteExamples: seoIncompleteExamples,
    },
    csvBundle: {
      itemCount: allItems.length,
      shutterstockRowCount,
      adobeStockRowCount,
      rowCountsMatchItemCount: shutterstockRowCount === allItems.length && adobeStockRowCount === allItems.length,
    },
  };

  console.log('=== Batch stability (100, with Style DNA) ===', JSON.stringify(withDna.summary, null, 2));
  console.log('=== Batch stability (100, no Style DNA) ===', JSON.stringify(noDna.summary, null, 2));
  console.log(`Filename uniqueness: ${uniqueBaseNames.size}/${baseNames.length} unique (${collisionCount} collisions)`);
  console.log(`SVG quality: mean svgHealth=${svgHealthMean}, min=${svgHealthMin}, structurally clean SVG=${svgStructurallyCleanCount}/${svgRows.length}, clean EPS=${epsStructurallyCleanCount}/${svgRows.length}`);
  console.log(`SEO completeness: ${seoCompleteCount}/${seoRows.length} items have every field non-empty`);
  console.log(`CSV bundle: Shutterstock ${shutterstockRowCount} rows, Adobe Stock ${adobeStockRowCount} rows (expected ${allItems.length} each)`);

  const __dirname = __dirnameFromUrl();
  const outDir = path.join(__dirname, '..', '..', 'docs', 'build_reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `BUILD_021_PRODUCTION_VERIFICATION_${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
}

main();
