// Build 026, Phase 18 — 250+-asset Validation/Demo Dataset. Generates a
// synthetic dataset covering every Build 026 domain (portfolio assets,
// submissions, sales events, rejection records, quality snapshots,
// production queue items, production batches, marketplace
// registrations) across multiple Style DNA presets, marketplaces,
// submission statuses, currencies, duplicate/renamed-file cases, and
// insufficient-data cases -- so the Commercial Feedback Engine and
// Production Recommendations engine have real data to demonstrate their
// confidence gating and diversity scoring against, without depending on
// a live user's actual portfolio.
//
// THIS IS SYNTHETIC DEMO DATA. It is never presented as real user data --
// every output file is written under `reports/build_026/validation_dataset/`
// (mirroring `reports/build_02{3,4,5}/portfolio_100/`'s existing
// convention) with an explicit `_disclaimer` field on the JSON bundle and
// a README explaining how to load it into a running app instance for
// manual QA, entirely separate from a real user's IndexedDB data.
//
// Deliberately does NOT write anything into a live browser's IndexedDB --
// this is a Node script (no DOM, no IndexedDB), so it produces a single
// portable JSON bundle a developer can load via the browser console using
// the same `put*` functions the app itself uses (documented in the
// generated README), the same "script produces files, UI/human decides
// what to do with them" separation `build025Portfolio100.ts` already
// establishes.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng, rngPick, rngInt, rngBool } from '../src/engine/rng';
import { createPortfolioAsset } from '../src/catalog/domain/asset';
import { computeProductionAssetId } from '../src/catalog/domain/productionAssetId';
import { createSubmissionRecord } from '../src/catalog/submission/submissionRecord';
import type { SubmissionStatus } from '../src/catalog/submission/submissionStatus';
import { createSalesEvent } from '../src/catalog/submission/salesRevenue';
import { createRejectionRecord } from '../src/catalog/submission/rejectionIntelligence';
import { createQualitySnapshot } from '../src/catalog/quality/qualitySnapshotStore';
import { createProductionQueueItem, transitionProductionQueueItem, type ProductionQueueStatus } from '../src/catalog/queue/productionQueue';
import { createProductionBatch, addQueueItemToBatch, type ProductionBatchType } from '../src/catalog/queue/productionBatch';
import { createMarketplaceRegistration } from '../src/catalog/submission/marketplaceRegistration';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rng = createRng('build-026-validation-dataset-v1');

const PRESETS = ['luxuryFloral', 'bohoFloral', 'geometricModern', 'tropicalLeaf', 'mandalaOrnate', 'terrazzoAbstract'] as const;
const STYLE_DNAS = ['romanticVictorian', 'organicWild', 'cleanMinimal', 'vibrantTropical', 'ornateBaroque', 'earthyNatural'] as const;
const COMPOSITIONS = ['bouquet', 'scatter', 'sCurve', 'diagonal', 'editorial', 'toss'] as const;
const PRODUCT_TARGETS = ['giftWrap', 'fabric', 'wallpaper', 'stationery', 'homeDecor', 'textile'] as const;
const PALETTE_POOL = ['#f4e3d7', '#c98474', '#2b2118', '#8fae6b', '#e8c1c5', '#3d5a80', '#e0a458', '#5f6c50', '#b23a48', '#f7e6ad'];
const MARKETPLACES = ['etsy', 'shutterstock', 'adobestock', 'freepik', 'gettyimages'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'THB'] as const;

const REJECTION_REASON_SAMPLES = [
  'This is a duplicate of an already-existing submission in our catalog.',
  'The submitted vector contains an unlicensed trademark or brand name.',
  'This design appears to infringe on existing copyright / intellectual property.',
  'The submission was flagged under our AI-generated content declaration policy.',
  'This pattern is too similar to another contributor\'s recent submission.',
  'The vector file has open paths and stray points -- not properly vectorized.',
  'The uploaded file is corrupted and failed to open.',
  'Unsupported file format for this marketplace.',
  'Keyword tagging issue -- please review and resubmit with relevant tags.',
  'Wrong category selected for this asset.',
  'Title and description do not meet our metadata quality standards.',
  'Limited commercial marketability for this design.',
  'Composition and layout balance issues noted by our reviewer.',
  'Colour palette does not meet current trend guidelines.',
  'Visible artifacts/noise detected in the rendered preview.',
  'Low technical quality / resolution issue detected.',
];

function pct(n: number): boolean {
  return rng() < n;
}

async function main() {
  const outRoot = path.resolve(__dirname, '../../reports/build_026/validation_dataset');
  fs.mkdirSync(outRoot, { recursive: true });

  const assets: ReturnType<typeof createPortfolioAsset>[] = [];
  const submissions: ReturnType<typeof createSubmissionRecord>[] = [];
  const salesEvents: ReturnType<typeof createSalesEvent>[] = [];
  const rejectionRecords: ReturnType<typeof createRejectionRecord>[] = [];
  const qualitySnapshots: ReturnType<typeof createQualitySnapshot>[] = [];
  const queueItems: ReturnType<typeof createProductionQueueItem>[] = [];
  const batches: ReturnType<typeof createProductionBatch>[] = [];
  const marketplaceRegistrations = MARKETPLACES.map((m) => createMarketplaceRegistration({ marketplaceId: m, contributorAccountLabel: `demo-${m}-shop` }));

  const TOTAL_ASSETS = 260;
  const now = Date.parse('2026-01-01T00:00:00Z');

  for (let i = 0; i < TOTAL_ASSETS; i++) {
    // terrazzoAbstract is deliberately kept small so the Commercial
    // Feedback Engine has a genuine insufficient-data (low-confidence)
    // case to demonstrate.
    const preset = i < 8 ? 'terrazzoAbstract' : rngPick(rng, PRESETS.filter((p) => p !== 'terrazzoAbstract'));
    const styleDna = rngPick(rng, STYLE_DNAS);
    const compositionType = rngPick(rng, COMPOSITIONS);
    const productTargets = [rngPick(rng, PRODUCT_TARGETS), ...(pct(0.3) ? [rngPick(rng, PRODUCT_TARGETS)] : [])];
    const colorPalette = Array.from({ length: rngInt(rng, 3, 5) }, () => rngPick(rng, PALETTE_POOL));
    const seed = `demo-${preset}-${i}`;
    const missingSourceFile = pct(0.03);

    const asset = createPortfolioAsset({
      displayName: `Demo ${preset} pattern ${i}`,
      originalFilename: `${seed}.svg`,
      sourceFileReferences: missingSourceFile
        ? []
        : [{ fileId: `demo-file-${i}`, role: 'svg', filename: `${seed}.svg`, mimeType: 'image/svg+xml', fileSize: rngInt(rng, 5000, 80000), sha256: `demo-hash-${i}` }],
      previewReference: null,
      metadataReference: null,
      createdAt: now - rngInt(rng, 0, 200) * 86400000,
      generatorVersion: '1.79',
      styleDna,
      presetId: preset,
      compositionType,
      patternType: 'seamless-repeat',
      generatorSeed: seed,
      productTargets: [...new Set(productTargets)],
      colorPalette,
      dimensions: { width: 3000, height: 3000 },
    });
    if (missingSourceFile) {
      (asset as { notes: string }).notes = 'DEMO: intentionally missing source file, simulating a moved/deleted asset for QA testing.';
    }

    const shouldHaveProductionId = pct(0.75);
    if (shouldHaveProductionId) {
      const productionAssetId = await computeProductionAssetId({
        generatorVersion: asset.generatorVersion ?? '1.79',
        styleDna: asset.styleDna,
        presetId: asset.presetId,
        compositionType: asset.compositionType,
        productTargets: asset.productTargets,
        generatorSeed: asset.generatorSeed,
        canonicalSvg: `<svg data-demo-seed="${seed}"></svg>`,
      });
      (asset as { productionAssetId: string | null }).productionAssetId = productionAssetId;
    }
    assets.push(asset);
  }

  // Renamed/duplicated-file cases: copy a handful of existing
  // productionAssetIds onto brand-new assetIds/displayNames, simulating
  // a re-imported or renamed file -- exercises the
  // `same-production-asset` duplicate rule end-to-end.
  const withProductionId = assets.filter((a) => a.productionAssetId);
  for (let i = 0; i < 6 && i < withProductionId.length; i++) {
    const source = withProductionId[rngInt(rng, 0, withProductionId.length - 1)];
    const clone = createPortfolioAsset({
      displayName: `${source.displayName} (renamed copy)`,
      originalFilename: `renamed-${source.originalFilename}`,
      sourceFileReferences: source.sourceFileReferences,
      previewReference: null,
      metadataReference: null,
      presetId: source.presetId,
      styleDna: source.styleDna,
      compositionType: source.compositionType,
      productTargets: source.productTargets,
      colorPalette: source.colorPalette,
    });
    (clone as { productionAssetId: string | null }).productionAssetId = source.productionAssetId;
    assets.push(clone);
  }

  // --- Submissions, sales, rejections -----------------------------------

  const STATUS_WEIGHTS: SubmissionStatus[] = ['DRAFT', 'DRAFT', 'READY', 'SUBMITTED', 'SUBMITTED', 'APPROVED', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'ARCHIVED'];

  for (const asset of assets) {
    // terrazzoAbstract gets only 0-1 submissions (insufficient-data case);
    // every other preset gets 1-3.
    const submissionCount = asset.presetId === 'terrazzoAbstract' ? rngInt(rng, 0, 1) : rngInt(rng, 1, 3);
    for (let s = 0; s < submissionCount; s++) {
      const marketplaceId = rngPick(rng, MARKETPLACES);
      const status = rngPick(rng, STATUS_WEIGHTS);
      const submission = {
        ...createSubmissionRecord({
          patternId: asset.assetId,
          marketplaceId,
          titleSnapshot: asset.displayName,
          descriptionSnapshot: `A seamless ${asset.styleDna} pattern for ${asset.productTargets.join(', ')}.`,
          keywordSnapshot: [asset.presetId ?? 'pattern', asset.styleDna ?? 'style', 'seamless', 'vector', 'repeat'],
          category: 'Patterns',
          productionAssetId: asset.productionAssetId,
          now,
        }),
        status,
      };
      submissions.push(submission);

      if (status === 'APPROVED' && asset.productionAssetId) {
        const salesCount = rngInt(rng, 1, 3);
        for (let k = 0; k < salesCount; k++) {
          const currency = rngPick(rng, CURRENCIES);
          const gross = rngInt(rng, 5, 200);
          salesEvents.push(
            createSalesEvent({
              productionAssetId: asset.productionAssetId,
              marketplaceId,
              date: now + k * 30 * 86400000,
              downloads: rngInt(rng, 1, 40),
              licenses: rngInt(rng, 1, 10),
              grossRevenue: gross,
              fees: Math.round(gross * 0.3),
              currency,
              thbEquivalent: currency === 'THB' ? null : Math.round(gross * 35),
            }),
          );
        }
      }

      if (status === 'REJECTED') {
        rejectionRecords.push(
          createRejectionRecord({
            submissionId: submission.submissionId,
            marketplaceReasonText: rngPick(rng, REJECTION_REASON_SAMPLES),
          }),
        );
      }
    }

    if (pct(0.3)) {
      qualitySnapshots.push(
        createQualitySnapshot({
          assetId: asset.assetId,
          productionAssetId: asset.productionAssetId,
          beautyScore: rngInt(rng, 40, 98),
          commercialScore: rngInt(rng, 40, 98),
          fragmented: rngBool(rng, 0.15),
          deadSpace: rngBool(rng, 0.1),
          decision: rngPick(rng, ['READY', 'REVIEW', 'REJECT'] as const),
          generatorVersion: '1.79',
        }),
      );
    }
  }

  // --- Production Queue + Batches ---------------------------------------

  const QUEUE_PATH: ProductionQueueStatus[] = ['IDEA', 'GENERATED', 'QUALITY_REVIEW', 'READY', 'PACKAGE_PREPARED', 'SUBMITTED', 'APPROVED', 'PERFORMANCE_TRACKING'];
  for (let i = 0; i < 30; i++) {
    let item = createProductionQueueItem({ ideaNote: `Demo idea ${i}: a ${rngPick(rng, PRESETS)} pattern` });
    const advanceTo = rngInt(rng, 0, QUEUE_PATH.length - 1);
    for (let step = 1; step <= advanceTo; step++) {
      item = transitionProductionQueueItem(item, QUEUE_PATH[step]);
    }
    queueItems.push(item);
  }

  const BATCH_TYPES: ProductionBatchType[] = ['collection', 'production-batch', 'submission-batch', 'seasonal-campaign', 'marketplace-batch', 'experimental-batch'];
  for (const batchType of BATCH_TYPES) {
    let batch = createProductionBatch({ name: `Demo ${batchType} batch`, batchType, notes: 'Synthetic demo batch for QA.' });
    const memberCount = rngInt(rng, 2, 5);
    for (let i = 0; i < memberCount && i < queueItems.length; i++) {
      batch = addQueueItemToBatch(batch, queueItems[rngInt(rng, 0, queueItems.length - 1)].queueItemId);
    }
    batches.push(batch);
  }

  // --- Write output --------------------------------------------------------

  const bundle = {
    _disclaimer: 'SYNTHETIC DEMO DATA -- NOT REAL USER SUBMISSIONS, SALES, OR PORTFOLIO ASSETS. Generated by scripts/build026ValidationDataset.ts for QA/manual-testing purposes only.',
    generatedAt: new Date().toISOString(),
    assets,
    submissions,
    salesEvents,
    rejectionRecords,
    qualitySnapshots,
    queueItems,
    batches,
    marketplaceRegistrations,
  };

  fs.writeFileSync(path.join(outRoot, 'DEMO_DATASET.json'), JSON.stringify(bundle, null, 2));

  const summary = {
    _disclaimer: bundle._disclaimer,
    totalAssets: assets.length,
    assetsByPreset: Object.fromEntries(PRESETS.map((p) => [p, assets.filter((a) => a.presetId === p).length])),
    assetsWithProductionAssetId: assets.filter((a) => a.productionAssetId).length,
    assetsMissingSourceFile: assets.filter((a) => a.sourceFileReferences.length === 0).length,
    totalSubmissions: submissions.length,
    submissionsByMarketplace: Object.fromEntries(MARKETPLACES.map((m) => [m, submissions.filter((s) => s.marketplaceId === m).length])),
    submissionsByStatus: Object.fromEntries([...new Set(submissions.map((s) => s.status))].map((st) => [st, submissions.filter((s) => s.status === st).length] as const)),
    totalSalesEvents: salesEvents.length,
    salesByCurrency: Object.fromEntries(CURRENCIES.map((c) => [c, salesEvents.filter((e) => e.currency === c).length])),
    totalRejectionRecords: rejectionRecords.length,
    totalQualitySnapshots: qualitySnapshots.length,
    totalQueueItems: queueItems.length,
    totalBatches: batches.length,
    totalMarketplaceRegistrations: marketplaceRegistrations.length,
  };
  fs.writeFileSync(path.join(outRoot, 'SUMMARY.json'), JSON.stringify(summary, null, 2));

  const readme = `# Build 026 Validation / Demo Dataset

**THIS IS SYNTHETIC DEMO DATA.** It was generated by
\`scripts/build026ValidationDataset.ts\` for manual QA and UI testing of
the Production Portfolio & Commercial Feedback features. It is NOT real
user data, NOT real sales figures, and NOT a real contributor's
portfolio -- every record is fabricated with a deterministic seed for
reproducibility.

## Contents

- \`DEMO_DATASET.json\` -- the full bundle: ${assets.length} portfolio assets,
  ${submissions.length} submissions, ${salesEvents.length} sales events,
  ${rejectionRecords.length} rejection records, ${qualitySnapshots.length} quality
  snapshots, ${queueItems.length} production queue items, ${batches.length} production
  batches, ${marketplaceRegistrations.length} marketplace registrations.
- \`SUMMARY.json\` -- counts broken down by preset/marketplace/status/currency,
  confirming coverage of every case the brief asked for (multiple Style DNA
  presets, multiple marketplaces, multiple submission statuses, approvals/
  rejections, multiple currencies, duplicate/renamed-file cases via shared
  \`productionAssetId\`s, an intentionally-small preset for insufficient-data
  testing, and a few assets with a missing/moved source file).

## Loading this into a running app instance (for manual QA only)

This script runs in Node and has no access to a browser's IndexedDB, so
it cannot write directly into the app's live storage. To load this data
into a running instance for manual testing, open the app in a browser,
open the DevTools console, and paste the contents of \`DEMO_DATASET.json\`
into a script that calls the same store functions the app itself uses
(\`catalog/storage/portfolioStore.ts\`'s \`putPortfolioAsset\`,
\`catalog/submission/submissionStore.ts\`'s \`putSubmission\`, etc. -- see
\`docs/PRODUCTION_PORTFOLIO.md\` for the full list). Never load this into
a browser profile that also holds real user data you care about keeping
separate from demo content.
`;
  fs.writeFileSync(path.join(outRoot, 'README.md'), readme);

  console.log(`Wrote ${assets.length} assets, ${submissions.length} submissions, ${salesEvents.length} sales events to ${outRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
