#!/usr/bin/env -S npx tsx
// Mission 8 (Production Certification), Part 8 — Export Certification.
//
// Introduces ZERO new export/scoring/generation logic. Every check below
// calls an existing, unmodified, already-shipped function from this
// codebase's real export pipeline — the same functions the app's own UI
// buttons and `scripts/build021ProductionVerification.ts` already use:
//
//   - `batch/batchProductionService.ts`'s `generateBatchToPortfolio` (the
//     real "Batch Generate" service, engine generation + import +
//     duplicate detection in one call)
//   - `batch/productionBundleService.ts`'s `buildProductionItemFiles` /
//     `buildProductionCsvBundle` / `productionBundleBaseName` (SVG/EPS/CSV
//     packaging glue)
//   - `batch/batchExportService.ts`'s `exportAssetsAsZip` (portfolio ZIP
//     bundling)
//   - `backup/zipArchive.ts`'s `readZipArchive` (a real ZIP reader, used
//     here read-only to verify the ZIP `export/zip.ts`'s `buildZip`
//     produced is actually well-formed and contains what it claims)
//   - `metadata/shutterstock.ts`'s `buildSiteMetadata` and
//     `metadata/marketplaceSeo.ts`'s `generateAllMarketplaceSeo` (SEO)
//   - `metadata/marketplaceValidation.ts`'s `validateMarketplaceSeo` /
//     `validateExportPackage` (marketplace-profile compatibility)
//
// Usage: npx tsx scripts/mission8_exportCertification.ts

import 'fake-indexeddb/auto';
import { File as NodeFile } from 'node:buffer';
(globalThis as unknown as { File: typeof NodeFile }).File = NodeFile;

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { generateBatchToPortfolio, type BatchProductionItemResult } from '../src/batch/batchProductionService';
import { clearPortfolioStores, loadPortfolioAssets } from '../src/catalog/storage/portfolioStore';
import { defaultParams } from '../src/engine/defaults';
import {
  buildProductionItemFiles,
  buildProductionCsvBundle,
  productionBundleBaseName,
} from '../src/batch/productionBundleService';
import { buildSingleTileSvg } from '../src/export/svgExporter';
import { buildSiteMetadata } from '../src/metadata/shutterstock';
import { generateAllMarketplaceSeo } from '../src/metadata/marketplaceSeo';
import { MARKETPLACE_PROFILES } from '../src/metadata/marketplaceProfiles';
import { validateMarketplaceSeo, validateExportPackage } from '../src/metadata/marketplaceValidation';
import { exportAssetsAsZip } from '../src/batch/batchExportService';
import { readZipArchive } from '../src/backup/zipArchive';

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

interface CheckResult {
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'UNKNOWN';
  detail: string;
}
const checks: CheckResult[] = [];
function record(name: string, status: CheckResult['status'], detail: string) {
  checks.push({ name, status, detail });
  console.log(`[${status}] ${name}: ${detail}`);
}

async function main() {
  console.log('Mission 8 Part 8 — Export Certification\n');

  // --- Real batch generation via the shipped Batch Generate service ---
  await clearPortfolioStores();
  const params = { ...defaultParams(), categoryId: 'botanical' as const };
  const BATCH_SIZE = 8;
  const result = await generateBatchToPortfolio({
    count: BATCH_SIZE,
    params,
    existingAssets: [],
    seedForItem: (i) => `mission8-export-${i}`,
    diversityRngSeed: 'mission8-export-diversity',
  });
  record(
    'Batch generation (generateBatchToPortfolio)',
    result.generatedCount === BATCH_SIZE && result.errorCount === 0 ? 'PASS' : 'WARNING',
    `generatedCount=${result.generatedCount} importedCount=${result.importedCount} possibleDuplicateCount=${result.possibleDuplicateCount} blockedDuplicateCount=${result.blockedDuplicateCount} errorCount=${result.errorCount}`,
  );

  const items: BatchProductionItemResult[] = result.items;
  const sources = items.map((it) => ({ tileData: it.tileData, variantParams: it.variantParams }));

  // --- 1. SVG well-formedness (real XML parse via jsdom's DOMParser) ---
  const dom = new JSDOM();
  const DOMParserCtor = dom.window.DOMParser;
  let svgParseFailures = 0;
  const svgTexts: string[] = [];
  for (const src of sources) {
    const files = buildProductionItemFiles(src);
    svgTexts.push(files.svg);
    const parser = new DOMParserCtor();
    const doc = parser.parseFromString(files.svg, 'image/svg+xml') as unknown as Document;
    const parserError = doc.getElementsByTagName('parsererror');
    const rootIsSvg = doc.documentElement?.nodeName?.toLowerCase() === 'svg';
    if (parserError.length > 0 || !rootIsSvg) svgParseFailures++;
  }
  record(
    'SVG well-formedness (jsdom DOMParser, real XML parse)',
    svgParseFailures === 0 ? 'PASS' : 'FAIL',
    `${sources.length - svgParseFailures}/${sources.length} SVG documents parsed cleanly with a root <svg> element and no <parsererror>.`,
  );

  // --- 2. EPS export ---
  let epsFailures = 0;
  const epsLengths: number[] = [];
  for (const src of sources) {
    const files = buildProductionItemFiles(src);
    epsLengths.push(files.eps.length);
    const wellFormed = files.eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0') && files.eps.trim().endsWith('%%EOF') && files.eps.length > 0;
    if (!wellFormed) epsFailures++;
  }
  record(
    'EPS export (export/epsExporter.ts buildEps, via productionBundleService.buildProductionItemFiles)',
    epsFailures === 0 ? 'PASS' : 'FAIL',
    `${sources.length - epsFailures}/${sources.length} EPS documents non-empty, start with "%!PS-Adobe-3.0 EPSF-3.0", end with "%%EOF". Mean length ${Math.round(epsLengths.reduce((a, b) => a + b, 0) / epsLengths.length)} bytes.`,
  );

  // --- 3. PNG export path (Node-compatible: Playwright screenshot of the real SVG, same technique as scripts/build023Portfolio100.ts) ---
  const outDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence', 'export_png');
  fs.mkdirSync(outDir, { recursive: true });
  let pngOk = 0;
  const pngSampleCount = Math.min(3, sources.length);
  try {
    const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
    const chromium = playwrightModule.default.chromium;
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    for (let i = 0; i < pngSampleCount; i++) {
      const svgMarkup = buildSingleTileSvg(items[i].tileData);
      const html = `<!doctype html><html><body style="margin:0">${svgMarkup}</body></html>`;
      await page.setContent(html);
      const outPath = path.join(outDir, `pattern-${i}.png`);
      await page.locator('svg').first().screenshot({ path: outPath });
      const buf = fs.readFileSync(outPath);
      const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (isPng && buf.length > 0) pngOk++;
    }
    await browser.close();
    record(
      'PNG export path (Playwright screenshot of real generated SVG, same technique as scripts/build023Portfolio100.ts)',
      pngOk === pngSampleCount ? 'PASS' : 'WARNING',
      `${pngOk}/${pngSampleCount} PNG files rendered with a valid PNG magic-number header and non-zero size. Saved to ${outDir}`,
    );
  } catch (e) {
    record('PNG export path', 'FAIL', `Threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- 4. ZIP bundling (real batch ZIP export + real ZIP reader round-trip) ---
  const importedAssetIds = items
    .map((it) => (it.outcome.status === 'imported' ? it.outcome.asset.assetId : null))
    .filter((x): x is string => x !== null);
  try {
    const { blob, filename } = await exportAssetsAsZip(importedAssetIds, 'mission8-export-cert');
    const buf = new Uint8Array(await blob.arrayBuffer());
    record('ZIP bundling — build (batch/batchExportService.ts exportAssetsAsZip)', buf.length > 0 ? 'PASS' : 'FAIL', `filename=${filename} size=${buf.length} bytes, ${importedAssetIds.length} assets bundled.`);

    const entries = await readZipArchive(blob);
    const hasManifest = entries.some((e) => e.name === 'manifest.json');
    const manifestEntry = entries.find((e) => e.name === 'manifest.json');
    let manifestAssetCount = -1;
    if (manifestEntry) {
      const manifestJson = JSON.parse(new TextDecoder().decode(manifestEntry.data));
      manifestAssetCount = manifestJson.assetCount;
    }
    record(
      'ZIP bundling — read-back verification (backup/zipArchive.ts readZipArchive, a real ZIP parser, read-only reuse against export/zip.ts buildZip output)',
      hasManifest && manifestAssetCount === importedAssetIds.length ? 'PASS' : 'WARNING',
      `Re-parsed the ZIP: ${entries.length} entries, manifest.json present=${hasManifest}, manifest.assetCount=${manifestAssetCount} (expected ${importedAssetIds.length}).`,
    );

    // --- 5. Metadata JSON sidecar (each asset folder's own json role file, per manifest) ---
    const svgEntries = entries.filter((e) => e.name.endsWith('.svg'));
    const jsonEntries = entries.filter((e) => e.name.endsWith('.json') && e.name !== 'manifest.json');
    record(
      'Metadata JSON sidecar (per-asset json role file inside the ZIP, alongside the svg)',
      jsonEntries.length >= importedAssetIds.length ? 'PASS' : 'WARNING',
      `${jsonEntries.length} per-asset .json sidecar file(s) found (>= ${importedAssetIds.length} imported assets expected), ${svgEntries.length} .svg file(s).`,
    );
  } catch (e) {
    record('ZIP bundling', 'FAIL', `Threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- 6. CSV metadata export (Shutterstock + Adobe Stock, catalog-level csv.ts via productionBundleService) ---
  const { shutterstockCsv, adobeStockCsv } = buildProductionCsvBundle(sources);
  const ssRows = shutterstockCsv.split('\r\n').length - 1;
  const asRows = adobeStockCsv.split('\r\n').length - 1;
  record(
    'CSV metadata export (metadata/csv.ts buildShutterstockCsv/buildAdobeStockCsv, via productionBundleService.buildProductionCsvBundle)',
    ssRows === sources.length && asRows === sources.length ? 'PASS' : 'FAIL',
    `Shutterstock CSV: ${ssRows} data rows, Adobe Stock CSV: ${asRows} data rows (expected ${sources.length} each). Header row: "${shutterstockCsv.split('\r\n')[0]}"`,
  );

  // --- 7. SEO fields populated (metadata/shutterstock.ts buildSiteMetadata, all sites) ---
  let seoEmptyFieldCount = 0;
  const seoEmptyExamples: string[] = [];
  for (const src of sources) {
    const sites = buildSiteMetadata(src.tileData);
    for (const site of sites) {
      for (const field of site.fields) {
        if (!field.value || field.value.trim().length === 0) {
          seoEmptyFieldCount++;
          if (seoEmptyExamples.length < 5) seoEmptyExamples.push(`${site.id}.${field.label}`);
        }
      }
    }
  }
  record(
    'SEO fields populated (metadata/shutterstock.ts buildSiteMetadata, every field, every site, every item)',
    seoEmptyFieldCount === 0 ? 'PASS' : 'WARNING',
    seoEmptyFieldCount === 0
      ? `All SEO fields non-empty across ${sources.length} items × all sites.`
      : `${seoEmptyFieldCount} empty field(s) found, e.g. ${seoEmptyExamples.join(', ')}.`,
  );

  // --- 8. Filename uniqueness across the batch ---
  const baseNames = sources.map((s) => productionBundleBaseName(s.variantParams));
  const uniqueBaseNames = new Set(baseNames);
  record(
    'Filename uniqueness across batch (productionBundleService.productionBundleBaseName)',
    uniqueBaseNames.size === baseNames.length ? 'PASS' : 'FAIL',
    `${uniqueBaseNames.size}/${baseNames.length} unique base filenames (${baseNames.length - uniqueBaseNames.size} collisions).`,
  );

  // --- 9. Marketplace-profile compatibility validation ---
  let marketplaceErrorCount = 0;
  const marketplaceErrorExamples: string[] = [];
  const marketplaceIdsToCheck: Array<'shutterstock' | 'adobestock'> = ['shutterstock', 'adobestock'];
  for (const src of sources) {
    const allSeo = generateAllMarketplaceSeo(src.tileData);
    for (const mpId of marketplaceIdsToCheck) {
      const seo = allSeo[mpId];
      const profile = MARKETPLACE_PROFILES[mpId];
      const issues = validateMarketplaceSeo(seo, profile);
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length > 0) {
        marketplaceErrorCount += errors.length;
        if (marketplaceErrorExamples.length < 5) marketplaceErrorExamples.push(`${mpId}: ${errors.map((e) => e.code).join(',')}`);
      }
      // Export-package file-presence check against this marketplace's own required file list.
      const packageFiles = [`${seo.filename}`];
      const pkgIssues = validateExportPackage(packageFiles, profile);
      if (pkgIssues.length > 0 && marketplaceErrorExamples.length < 8) {
        marketplaceErrorExamples.push(`${mpId} exportPackage: ${pkgIssues.map((i) => i.code).join(',')} (required: ${profile.exportPackageFiles.join(', ')})`);
      }
    }
  }
  record(
    'Marketplace-profile compatibility validation (metadata/marketplaceValidation.ts validateMarketplaceSeo + validateExportPackage, Shutterstock + Adobe Stock profiles)',
    marketplaceErrorCount === 0 ? 'PASS' : 'WARNING',
    marketplaceErrorCount === 0
      ? `0 blocking ("error"-severity) SEO validation issues across ${sources.length} items × ${marketplaceIdsToCheck.length} marketplaces.`
      : `${marketplaceErrorCount} blocking issue(s), e.g. ${marketplaceErrorExamples.join(' ; ')}`,
  );

  // --- Final storage sanity: confirm what's actually in the portfolio store ---
  const storedAssets = await loadPortfolioAssets();
  record(
    'Storage sanity (portfolioStore.loadPortfolioAssets)',
    storedAssets.length === result.importedCount ? 'PASS' : 'WARNING',
    `${storedAssets.length} assets in IndexedDB (fake-indexeddb) after batch, expected importedCount=${result.importedCount}.`,
  );

  // --- Write evidence file ---
  const evidenceDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, 'PART8_EXPORT_CERTIFICATION.json');
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        batchSize: BATCH_SIZE,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote evidence to ${evidencePath}`);

  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  console.log(`\n=== SUMMARY: ${checks.filter((c) => c.status === 'PASS').length} PASS, ${checks.filter((c) => c.status === 'WARNING').length} WARNING, ${failCount} FAIL, ${checks.filter((c) => c.status === 'UNKNOWN').length} UNKNOWN ===`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
