#!/usr/bin/env -S npx tsx
// Mission 8 (Production Certification), Part 9 — Commercial Certification.
//
// Introduces ZERO new scoring/collection/duplicate-detection logic. Every
// check below calls an existing, unmodified, already-shipped function:
//
//   - `batch/batchProductionService.ts`'s `generateBatchToPortfolio` (real
//     generation + import, same as Part 8)
//   - `catalog/services/collectionService.ts`'s `createCollectionService` /
//     `assignAssetsToCollections` (the app's real collection-creation path)
//   - `catalog/domain/productionAssetId.ts`'s `computeProductionAssetId`
//     (the app's real content-derived uniqueness fingerprint)
//   - `commercial/readinessEngine.ts`'s `computeCommercialReadiness` (real
//     metadata/SEO/collection/duplicate completeness checks, including its
//     own `checkDuplicateComplete` productionAssetId-collision check —
//     reused here as the "duplicate-detection module" the brief asks for)
//   - `catalog/import/duplicates.ts`'s `detectDuplicate` (already exercised
//     transitively via `generateBatchToPortfolio` -> `importFileGroup`
//     during generation; this script also reports its real outcome)
//   - `catalog/submission/submissionRecord.ts`'s `createSubmissionRecord`
//   - `metadata/marketplaceSeo.ts`'s `generateAllMarketplaceSeo`
//   - `commercial/packageBuilder.ts`'s `buildCommercialPackage`, called
//     with the exact same input shape `factory/taskExecutors.ts`'s
//     `executePackageTask` already uses
//   - `catalog/submission/submissionPackageBuilder.ts`'s
//     `buildSubmissionPackage`
//
// Usage: npx tsx scripts/mission8_commercialCertification.ts

import 'fake-indexeddb/auto';
import { File as NodeFile } from 'node:buffer';
(globalThis as unknown as { File: typeof NodeFile }).File = NodeFile;

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateBatchToPortfolio } from '../src/batch/batchProductionService';
import { clearPortfolioStores, loadPortfolioAssets, putPortfolioAsset, loadFilesForAsset } from '../src/catalog/storage/portfolioStore';
import { clearCollectionsStore, loadCollections } from '../src/catalog/storage/collectionStore';
import { createCollectionService, assignAssetsToCollections } from '../src/catalog/services/collectionService';
import { defaultParams } from '../src/engine/defaults';
import { buildSingleTileSvg } from '../src/export/svgExporter';
import { computeProductionAssetId } from '../src/catalog/domain/productionAssetId';
import { computeCommercialReadiness } from '../src/commercial/readinessEngine';
import { createSubmissionRecord, type SubmissionRecord } from '../src/catalog/submission/submissionRecord';
import { generateAllMarketplaceSeo } from '../src/metadata/marketplaceSeo';
import { buildCommercialPackage } from '../src/commercial/packageBuilder';
import { buildSubmissionPackage } from '../src/catalog/submission/submissionPackageBuilder';
import { readZipArchive } from '../src/backup/zipArchive';
import type { PortfolioAsset } from '../src/catalog/domain/types';

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

const COLLECTION_DEFS = [
  { name: 'Mission 8 — Boho Botanical Vol. 1', description: 'Certification test collection A' },
  { name: 'Mission 8 — Dark Botanical Vol. 1', description: 'Certification test collection B' },
  { name: 'Mission 8 — Editorial Botanical Vol. 1', description: 'Certification test collection C' },
];
const PER_COLLECTION = 4;

async function main() {
  console.log('Mission 8 Part 9 — Commercial Certification\n');

  await clearPortfolioStores();
  await clearCollectionsStore();

  const params = { ...defaultParams(), categoryId: 'botanical' as const };
  const totalCount = COLLECTION_DEFS.length * PER_COLLECTION;
  const result = await generateBatchToPortfolio({
    count: totalCount,
    params,
    existingAssets: [],
    seedForItem: (i) => `mission8-commercial-${i}`,
    diversityRngSeed: 'mission8-commercial-diversity',
  });
  record(
    'Batch generation for 3 collections (generateBatchToPortfolio)',
    result.generatedCount === totalCount && result.errorCount === 0 ? 'PASS' : 'WARNING',
    `generatedCount=${result.generatedCount} importedCount=${result.importedCount} possibleDuplicateCount=${result.possibleDuplicateCount} blockedDuplicateCount=${result.blockedDuplicateCount} (real-time import-pipeline detectDuplicate outcome, catalog/import/duplicates.ts) errorCount=${result.errorCount}`,
  );

  const importedItems = result.items.filter((it) => it.outcome.status === 'imported');
  const assetIdByIndex = importedItems.map((it) => (it.outcome as { status: 'imported'; asset: PortfolioAsset }).asset.assetId);

  // --- Create 3 real Commercial Collections via the app's own collection-creation path ---
  const collectionAssetGroups: string[][] = [];
  for (let c = 0; c < COLLECTION_DEFS.length; c++) {
    const collection = await createCollectionService({ name: COLLECTION_DEFS[c].name, description: COLLECTION_DEFS[c].description });
    const group = assetIdByIndex.slice(c * PER_COLLECTION, (c + 1) * PER_COLLECTION);
    collectionAssetGroups.push(group);
    const membershipResult = await assignAssetsToCollections(group, [collection.id]);
    record(
      `Collection "${collection.name}" created + populated (catalog/services/collectionService.ts)`,
      membershipResult.failedCount === 0 && membershipResult.changedCount === group.length ? 'PASS' : 'WARNING',
      `collectionId=${collection.id}, ${group.length} assets assigned, changedCount=${membershipResult.changedCount}, failedCount=${membershipResult.failedCount}.`,
    );
  }
  const collections = await loadCollections();

  // --- Compute real productionAssetId fingerprints (existing function, not invoked by the batch path itself) and persist them ---
  let assets = await loadPortfolioAssets();
  const fingerprintByAssetId = new Map<string, string>();
  for (const item of importedItems) {
    const asset = assets.find((a) => a.assetId === (item.outcome as { status: 'imported'; asset: PortfolioAsset }).asset.assetId)!;
    const svgMarkup = buildSingleTileSvg(item.tileData);
    const fingerprint = await computeProductionAssetId({
      generatorVersion: asset.generatorVersion ?? 'unknown',
      styleDna: asset.styleDna ?? '',
      presetId: asset.presetId ?? '',
      compositionType: asset.compositionType,
      productTargets: asset.productTargets,
      generatorSeed: item.variantParams.seed,
      canonicalSvg: svgMarkup,
    });
    fingerprintByAssetId.set(asset.assetId, fingerprint);
    await putPortfolioAsset({ ...asset, productionAssetId: fingerprint });
  }
  assets = await loadPortfolioAssets();

  // --- 1. Uniqueness — no duplicate SVG/motif fingerprint within or across collections ---
  const allFingerprints = [...fingerprintByAssetId.values()];
  const uniqueFingerprints = new Set(allFingerprints);
  record(
    'Uniqueness — productionAssetId fingerprint set (catalog/domain/productionAssetId.ts computeProductionAssetId)',
    uniqueFingerprints.size === allFingerprints.length ? 'PASS' : 'FAIL',
    `${uniqueFingerprints.size}/${allFingerprints.length} unique fingerprints across all ${COLLECTION_DEFS.length} collections combined.`,
  );

  let duplicateCheckFailCount = 0;
  let duplicateCheckWarnCount = 0;
  for (const asset of assets) {
    const siblings = assets.filter((a) => a.assetId !== asset.assetId);
    const readiness = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: siblings });
    const dupCheck = readiness.checks.find((c) => c.id === 'duplicateCheckComplete')!;
    if (dupCheck.status === 'FAIL') duplicateCheckFailCount++;
    if (dupCheck.status === 'WARNING') duplicateCheckWarnCount++;
  }
  record(
    'Uniqueness — commercial/readinessEngine.ts checkDuplicateComplete (real duplicate-detection module, cross-collection)',
    duplicateCheckFailCount === 0 ? 'PASS' : 'FAIL',
    `${assets.length - duplicateCheckFailCount - duplicateCheckWarnCount}/${assets.length} assets PASS duplicateCheckComplete, ${duplicateCheckWarnCount} WARNING (no fingerprint), ${duplicateCheckFailCount} FAIL (shares a fingerprint with a sibling).`,
  );

  // --- 2. Metadata completeness + 3. SEO completeness, per asset ---
  // Create real SubmissionRecords (Shutterstock) from the app's own SEO generator so
  // `checkSeoExists` reflects real, non-fabricated title/description/keywords.
  const submissionsByAsset = new Map<string, SubmissionRecord[]>();
  for (const item of importedItems) {
    const assetId = (item.outcome as { status: 'imported'; asset: PortfolioAsset }).asset.assetId;
    const seo = generateAllMarketplaceSeo(item.tileData).shutterstock;
    const submission = createSubmissionRecord({
      patternId: assetId,
      marketplaceId: 'shutterstock',
      titleSnapshot: seo.title,
      descriptionSnapshot: seo.description,
      keywordSnapshot: seo.keywords,
      category: 'Backgrounds/Textures',
      productionAssetId: fingerprintByAssetId.get(assetId) ?? null,
    });
    submissionsByAsset.set(assetId, [submission]);
  }

  let metadataCompleteCount = 0;
  let seoCompleteCount = 0;
  const readinessByAsset = new Map<string, ReturnType<typeof computeCommercialReadiness>>();
  for (const asset of assets) {
    const siblings = assets.filter((a) => a.assetId !== asset.assetId);
    const submissionsForAsset = submissionsByAsset.get(asset.assetId) ?? [];
    const readiness = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset, siblingAssets: siblings });
    readinessByAsset.set(asset.assetId, readiness);
    const metaCheck = readiness.checks.find((c) => c.id === 'metadataExists')!;
    const seoCheck = readiness.checks.find((c) => c.id === 'seoExists')!;
    if (metaCheck.status === 'PASS') metadataCompleteCount++;
    if (seoCheck.status === 'PASS') seoCompleteCount++;
  }
  record(
    'Metadata completeness (commercial/readinessEngine.ts checkMetadataExists, real per-asset check)',
    metadataCompleteCount === assets.length ? 'PASS' : 'WARNING',
    `${metadataCompleteCount}/${assets.length} assets have metadataExists=PASS.`,
  );
  record(
    'SEO completeness (commercial/readinessEngine.ts checkSeoExists, backed by real SubmissionRecords with generateAllMarketplaceSeo title/description/keywords)',
    seoCompleteCount === assets.length ? 'PASS' : 'WARNING',
    `${seoCompleteCount}/${assets.length} assets have seoExists=PASS.`,
  );

  // --- 4. Preview generation ---
  const previewCount = assets.filter((a) => a.previewReference !== null).length;
  record(
    'Preview generation — previewReference populated on import (catalog/import/previewSelection.ts, via generateBatchToPortfolio -> importFileGroup)',
    previewCount === assets.length ? 'PASS' : 'WARNING',
    `${previewCount}/${assets.length} assets have a non-null previewReference.`,
  );
  try {
    const playwrightModule: any = await import('/opt/node22/lib/node_modules/playwright/index.js');
    const chromium = playwrightModule.default.chromium;
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    const outDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence', 'commercial_previews');
    fs.mkdirSync(outDir, { recursive: true });
    let renderedOk = 0;
    const sampleItems = importedItems.slice(0, 3);
    for (let i = 0; i < sampleItems.length; i++) {
      const svgMarkup = buildSingleTileSvg(sampleItems[i].tileData);
      await page.setContent(`<!doctype html><html><body style="margin:0">${svgMarkup}</body></html>`);
      const outPath = path.join(outDir, `preview-${i}.png`);
      await page.locator('svg').first().screenshot({ path: outPath });
      const buf = fs.readFileSync(outPath);
      if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) renderedOk++;
    }
    await browser.close();
    record(
      'Preview generation — real PNG rendered (Playwright screenshot of real generated SVG)',
      renderedOk === sampleItems.length ? 'PASS' : 'WARNING',
      `${renderedOk}/${sampleItems.length} preview PNGs rendered with valid headers, saved to ${outDir}.`,
    );
  } catch (e) {
    record('Preview generation — real PNG rendered', 'FAIL', `Threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- 5. Building an actual Commercial Package (exact call pattern of factory/taskExecutors.ts executePackageTask) ---
  let packagesBuilt = 0;
  let packagesBuiltCount = 0;
  const packageStatuses: string[] = [];
  const pkgEvidenceDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence', 'commercial_packages');
  fs.mkdirSync(pkgEvidenceDir, { recursive: true });
  for (let c = 0; c < collectionAssetGroups.length; c++) {
    const assetId = collectionAssetGroups[c][0]; // one package per collection
    const asset = assets.find((a) => a.assetId === assetId)!;
    const files = await loadFilesForAsset(assetId);
    const readiness = readinessByAsset.get(assetId)!;
    const submission = (submissionsByAsset.get(assetId) ?? [])[0] ?? null;
    const assetCollections = collections.filter((col) => asset.collectionIds.includes(col.id));
    try {
      const pkgResult = await buildCommercialPackage({
        asset,
        files,
        marketplaceId: 'shutterstock',
        readiness,
        submission,
        collections: assetCollections,
      });
      packagesBuilt++;
      packageStatuses.push(pkgResult.manifest.status);
      if (pkgResult.manifest.status === 'BUILT') packagesBuiltCount++;
      const buf = new Uint8Array(await pkgResult.blob.arrayBuffer());
      const zipPath = path.join(pkgEvidenceDir, pkgResult.filename);
      fs.writeFileSync(zipPath, buf);
      const zipEntries = await readZipArchive(pkgResult.blob);
      const hasManifest = zipEntries.some((e) => e.name === 'manifest.json');
      const hasReadinessReport = zipEntries.some((e) => e.name === 'readiness-report.json');
      console.log(
        `  Commercial Package [collection ${c + 1}]: ${pkgResult.filename}, status=${pkgResult.manifest.status}, ${zipEntries.length} zip entries, manifest.json=${hasManifest}, readiness-report.json=${hasReadinessReport}, saved to ${zipPath}`,
      );
    } catch (e) {
      packageStatuses.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  record(
    'Commercial Package build (commercial/packageBuilder.ts buildCommercialPackage, exact input shape of factory/taskExecutors.ts executePackageTask)',
    packagesBuilt === collectionAssetGroups.length ? 'PASS' : 'FAIL',
    `${packagesBuilt}/${collectionAssetGroups.length} packages built (one per collection). Statuses: ${packageStatuses.join(', ')}. (${packagesBuiltCount} with status BUILT — the rest, if any, NEEDS_VERIFICATION per the marketplace profile's own contributorUrlVerified/future flags, reported honestly, not silently upgraded.)`,
  );

  // --- 6. Submission package (catalog/submission/submissionPackageBuilder.ts buildSubmissionPackage) ---
  let submissionPackagesBuilt = 0;
  let submissionPackagesReady = 0;
  const allSubmissions = [...submissionsByAsset.values()].flat();
  const subEvidenceDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence', 'submission_packages');
  fs.mkdirSync(subEvidenceDir, { recursive: true });
  for (let c = 0; c < collectionAssetGroups.length; c++) {
    const assetId = collectionAssetGroups[c][0];
    const asset = assets.find((a) => a.assetId === assetId)!;
    const files = await loadFilesForAsset(assetId);
    const submission = (submissionsByAsset.get(assetId) ?? [])[0];
    if (!submission) continue;
    const existingSubmissions = allSubmissions.filter((s) => s.submissionId !== submission.submissionId);
    try {
      const subResult = await buildSubmissionPackage({ asset, files, submission, existingSubmissions });
      submissionPackagesBuilt++;
      if (subResult.checklist.valid) submissionPackagesReady++;
      const buf = new Uint8Array(await subResult.blob.arrayBuffer());
      fs.writeFileSync(path.join(subEvidenceDir, subResult.filename), buf);
      console.log(
        `  Submission Package [collection ${c + 1}]: ${subResult.filename}, checklist.valid=${subResult.checklist.valid}, issues=${subResult.checklist.issues.map((i) => i.code).join(',') || 'none'}, duplicateWarnings.hasDuplicate=${(subResult.duplicateWarnings as any).hasDuplicate ?? JSON.stringify(subResult.duplicateWarnings)}`,
      );
    } catch (e) {
      console.log(`  Submission Package [collection ${c + 1}]: THREW ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  record(
    'Submission Package build (catalog/submission/submissionPackageBuilder.ts buildSubmissionPackage)',
    submissionPackagesBuilt === collectionAssetGroups.length ? 'PASS' : 'FAIL',
    `${submissionPackagesBuilt}/${collectionAssetGroups.length} submission packages built, ${submissionPackagesReady}/${submissionPackagesBuilt} pass their own readiness checklist (checklist.valid).`,
  );

  // --- Evidence file ---
  const evidenceDir = path.join(__dirnameFromUrl(), '..', '..', 'docs', 'mission8_evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, 'PART9_COMMERCIAL_CERTIFICATION.json');
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        collections: COLLECTION_DEFS.map((c, i) => ({ name: c.name, assetCount: collectionAssetGroups[i]?.length ?? 0 })),
        totalAssets: assets.length,
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
