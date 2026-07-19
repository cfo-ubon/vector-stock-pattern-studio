import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'fake-indexeddb/auto';
import { File as NodeFile } from 'node:buffer';
(globalThis as any).File = NodeFile;

// Portfolio Phase 1 — 100 Production Run. NOT a "Build": no generator,
// scoring, or engine code is touched. Pure orchestration over the exact
// production pipeline every prior build (018-021) already shipped and
// verified:
//   - `assignPortfolioDiversity` (engine/portfolioVariety.ts) — the real
//     shuffled-bag diversity assignment every batch flow already uses, for
//     composition zone / botanical family / cluster / hero structure / hero
//     silhouette variety within each 10-item collection.
//   - `resolveStyleDna` (engine/styleDna.ts) — resolves each collection's
//     borrowed Style DNA preset for its baseline hierarchy/motif-complexity/
//     color-strategy identity; palette/density/negativeSpace/rhythm are then
//     varied per item on top (plain per-item randomized numeric assignment,
//     the same pattern `engine/defaults.ts`'s own `randomizedParams` already
//     uses — no new engine math).
//   - `buildTileForGenerate` (engine/heroDetector.ts) — the same commercial
//     quality-retry gate every single/batch/production generation path goes
//     through (unmodified).
//   - `buildSingleTileSvg` / `buildEps` / `buildSiteMetadata` / `buildZip` —
//     the same, unmodified SVG/EPS/SEO/ZIP builders Build 021's Production
//     Mode already ships.
//   - `importFileGroup` — the same real duplicate-detection + import
//     pipeline every batch flow already uses, run across the FULL 100-item
//     portfolio (never reset between collections) so duplicate checking is
//     genuinely portfolio-wide, not just per-collection.
//   - `computeMetrics` / `computeHeroVisibilityScore` / `computeOverallScore`
//     / `computeBotanicalBeautyMetrics` — existing, unmodified scoring.
// PNG rasterization reuses the exact same technique as `App.tsx`'s own
// `rasterizeSvgToPngBlob` (Blob -> Image -> canvas.drawImage -> toDataURL),
// just executed inside a real headless Chromium page (via Playwright,
// already pre-installed in this environment) since Node has no DOM/canvas.

import { defaultParams } from '../src/engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../src/engine/styleDna';
import { assignPortfolioDiversity } from '../src/engine/portfolioVariety';
import { HIERARCHY_PRESETS } from '../src/engine/hierarchy';
import { buildTileForGenerate } from '../src/engine/heroDetector';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../src/export/svgExporter';
import { buildEps } from '../src/export/epsExporter';
import { buildSiteMetadata } from '../src/metadata/shutterstock';
import { computeOverallScore } from '../src/engine/scoring';
import { computeBotanicalBeautyMetrics } from '../src/engine/botanicalBeautyMetrics';
import { importFileGroup, type ImportOutcome } from '../src/catalog/import/importPipeline';
import { clearPortfolioStores } from '../src/catalog/storage/portfolioStore';
import type { FileGroup } from '../src/catalog/import/basenameGrouping';
import type { PortfolioAsset } from '../src/catalog/domain/types';
import { createRng, rngPick, rngRange } from '../src/engine/rng';
import { buildZip, type ZipEntry } from '../src/export/zip';
import type { GenerateParams } from '../src/engine/types';
import type { BotanicalFamily } from '../src/generators/botanicalFamilies';

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

// ---- Collection definitions (Section 3 of the brief) ----
// Every collection stays on `categoryId: 'botanical'` so "botanical
// structure" quality (`computeBotanicalBeautyMetrics`) is meaningful for
// all 100 patterns, not skipped for a subset — "Tropical Leaves" and
// "Wildflower Meadow" use the app's own real `tropicalLeaf`/`wildflower`
// Botanical Families rather than the separate `tropical` generator
// category, and every palette/family id below is a real, already-shipped
// id (`palettes/palettes.ts` / `generators/botanicalFamilies.ts`), never
// invented.
interface CollectionSpec {
  dir: string;
  label: string;
  baseDnaId: string;
  families: BotanicalFamily[];
  palettes: string[];
  density: [number, number];
  negativeSpace: [number, number];
  rhythm: [number, number];
}

const COLLECTIONS: CollectionSpec[] = [
  {
    dir: '01_premium_botanical_floral', label: 'Premium Botanical Floral', baseDnaId: 'luxuryFloral',
    families: ['rose', 'peony', 'ranunculus', 'magnolia', 'protea', 'hydrangea'],
    palettes: ['jewel-tones', 'blush-gold', 'berry-punch', 'earth-tone'],
    density: [0.55, 0.8], negativeSpace: [0, 0.15], rhythm: [0.5, 0.8],
  },
  {
    dir: '02_tropical_leaves', label: 'Tropical Leaves', baseDnaId: 'editorialBotanical',
    families: ['tropicalLeaf', 'fern', 'eucalyptus'],
    palettes: ['ocean-breeze', 'citrus-pop', 'coastal-neutral', 'terracotta'],
    density: [0.5, 0.75], negativeSpace: [0.05, 0.2], rhythm: [0.3, 0.6],
  },
  {
    dir: '03_wildflower_meadow', label: 'Wildflower Meadow', baseDnaId: 'bohoFloral',
    families: ['wildflower', 'cosmos', 'daisy', 'babysBreath', 'lavender'],
    palettes: ['lavender-fields', 'pastel-dream', 'candy-shop', 'sage-terracotta'],
    density: [0.35, 0.6], negativeSpace: [0.15, 0.35], rhythm: [0.2, 0.5],
  },
  {
    dir: '04_scandinavian_floral', label: 'Scandinavian Floral', baseDnaId: 'scandinavianOrganic',
    families: ['tulip', 'daisy', 'olive', 'eucalyptus', 'herb'],
    palettes: ['coastal-neutral', 'pastel-dream', 'mono-charcoal', 'sage-terracotta'],
    density: [0.3, 0.5], negativeSpace: [0.2, 0.4], rhythm: [0.4, 0.6],
  },
  {
    dir: '05_vintage_garden', label: 'Vintage Garden', baseDnaId: 'vintageHerbarium',
    families: ['rose', 'peony', 'tulip', 'herb', 'olive'],
    palettes: ['earth-tone', 'terracotta', 'autumn-harvest', 'sage-terracotta'],
    density: [0.4, 0.65], negativeSpace: [0.1, 0.3], rhythm: [0.3, 0.55],
  },
  {
    dir: '06_minimal_botanical', label: 'Minimal Botanical', baseDnaId: 'minimalBotanical',
    families: ['eucalyptus', 'olive', 'fern', 'herb', 'daisy'],
    palettes: ['mono-charcoal', 'coastal-neutral', 'pastel-dream'],
    density: [0.15, 0.35], negativeSpace: [0.35, 0.55], rhythm: [0.15, 0.35],
  },
  {
    dir: '07_luxury_wedding_floral', label: 'Luxury Wedding Floral', baseDnaId: 'luxuryFloral',
    families: ['peony', 'ranunculus', 'rose', 'babysBreath', 'eucalyptus'],
    palettes: ['blush-gold', 'pastel-dream', 'jewel-tones'],
    density: [0.5, 0.75], negativeSpace: [0.05, 0.2], rhythm: [0.5, 0.75],
  },
  {
    dir: '08_boho_botanical', label: 'Boho Botanical', baseDnaId: 'bohoFloral',
    families: ['wildflower', 'protea', 'fern', 'olive', 'cosmos'],
    palettes: ['retro-sunset', 'terracotta', 'berry-punch', 'sage-terracotta'],
    density: [0.4, 0.65], negativeSpace: [0.1, 0.3], rhythm: [0.25, 0.5],
  },
  {
    dir: '09_autumn_botanical', label: 'Autumn Botanical', baseDnaId: 'darkBotanical',
    families: ['olive', 'berryBranch', 'herb', 'rose', 'protea'],
    palettes: ['autumn-harvest', 'terracotta', 'earth-tone'],
    density: [0.5, 0.75], negativeSpace: [0.05, 0.2], rhythm: [0.35, 0.6],
  },
  {
    dir: '10_christmas_botanical', label: 'Christmas Botanical', baseDnaId: 'darkBotanical',
    families: ['olive', 'berryBranch', 'eucalyptus', 'herb'],
    palettes: ['midnight-botanical', 'jewel-tones', 'earth-tone'],
    density: [0.5, 0.75], negativeSpace: [0.05, 0.2], rhythm: [0.35, 0.6],
  },
];

const ITEMS_PER_COLLECTION = 10;

// ---- Quality classification thresholds ----
// Reuses this codebase's own established "50" commercial floor
// (critic/qualityGate.ts's GATE_MIN_OVERALL, engine/scoring.ts's own
// METRIC_FAILURE_FLOOR convention in scripts/qualityReport.ts) rather than
// inventing new numbers, plus Build 021's own measured real production SVG
// quality bar (min 90/100 svgHealth observed across a real 200-pattern
// run — docs/build_reports/BUILD_021_REPORT.md Section 4.2).
const HARD_FLOOR = 50;
const READY_OVERALL_MIN = 65;
const READY_SUBMETRIC_MIN = 60;
const READY_SVG_HEALTH_MIN = 90;

function esc(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map((f) => esc(String(f))).join(',') + '\r\n';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface QualityRow {
  filename: string;
  collection: string;
  classification: 'READY' | 'REVIEW' | 'REJECT';
  overallScore: number;
  seamlessRepeat: number;
  heroVisibility: number;
  compositionBalance: number;
  botanicalStructure: number;
  colorHarmony: number;
  duplicateSimilarity: number;
  svgValidity: number;
  exportCompleteness: number;
  notes: string;
}

interface ManifestRow {
  index: number;
  collection: string;
  filename: string;
  seed: string;
  botanicalFamily: string;
  compositionZone: string;
  heroArchetype: string;
  paletteId: string;
  density: number;
  negativeSpace: number;
  rhythmStrength: number;
  attempts: number;
  regenerated: boolean;
  importStatus: string;
}

interface SeoRow {
  filename: string;
  collection: string;
  title: string;
  description: string;
  keywordCount: number;
  keywords: string[];
}

async function rasterizePng(page: any, svgString: string, size: number): Promise<Buffer | null> {
  const dataUrl: string | null = await page.evaluate(
    async ({ svgString, size }: { svgString: string; size: number }) => {
      return await new Promise<string | null>((resolve) => {
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    },
    { svgString, size },
  );
  if (!dataUrl) return null;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Buffer.from(base64, 'base64');
}

async function main() {
  const __dirname = __dirnameFromUrl();
  const repoRoot = path.join(__dirname, '..', '..');
  const outRoot = path.join(repoRoot, 'portfolio_phase_1');
  fs.mkdirSync(outRoot, { recursive: true });

  await clearPortfolioStores();

  // This repo has no local playwright devDependency; the pre-installed
  // Chromium + globally-installed `playwright` module in this environment
  // is the same one prior builds' own "real browser verification" steps
  // used, imported here by its absolute path since Node's ESM resolver
  // doesn't consult NODE_PATH the way CommonJS require() does.
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs' as string);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  const manifestRows: ManifestRow[] = [];
  const qualityRows: QualityRow[] = [];
  const seoRows: SeoRow[] = [];
  let exportFailures = 0;
  let duplicateWarnings = 0;
  const knownAssets: PortfolioAsset[] = [];

  const collectionAverages: Array<{ collection: string; mean: number; readyCount: number; reviewCount: number; rejectCount: number }> = [];

  for (let ci = 0; ci < COLLECTIONS.length; ci++) {
    const spec = COLLECTIONS[ci];
    const collectionDir = path.join(outRoot, spec.dir);
    fs.mkdirSync(collectionDir, { recursive: true });

    const diversityRng = createRng(`phase1-diversity-${spec.dir}`);
    const assignments = assignPortfolioDiversity(diversityRng, ITEMS_PER_COLLECTION, {
      botanicalFamilies: spec.families,
    });

    const zipEntries: ZipEntry[] = [];
    let collectionScoreSum = 0;
    let readyCount = 0;
    let reviewCount = 0;
    let rejectCount = 0;

    for (let i = 0; i < ITEMS_PER_COLLECTION; i++) {
      const seed = `phase1-${spec.dir}-${i}`;
      const varyRng = createRng(`${seed}-vary`);
      const dna = STYLE_DNA_PRESETS[spec.baseDnaId];
      const resolved = resolveStyleDna(dna, seed);
      const base: GenerateParams = { ...defaultParams(), categoryId: 'botanical', ...resolved, seed };
      const assignment = assignments[i];

      const variantParams: GenerateParams = {
        ...base,
        paletteId: rngPick(varyRng, spec.palettes),
        density: rngRange(varyRng, spec.density[0], spec.density[1]),
        negativeSpace: rngRange(varyRng, spec.negativeSpace[0], spec.negativeSpace[1]),
        compositionIntelligence: {
          ...base.compositionIntelligence,
          rhythmStrength: rngRange(varyRng, spec.rhythm[0], spec.rhythm[1]),
        },
        compositionZone: assignment.compositionZone,
        botanicalFamily: assignment.botanicalFamily,
        clusterArchetypes: [assignment.clusterType],
        hierarchy: HIERARCHY_PRESETS[assignment.heroStructure].value,
        heroArchetype: assignment.heroSilhouette,
      };

      const retryResult = buildTileForGenerate(variantParams);
      const { tileData, metrics, attempts, regenerated, heroVisibilityScore } = retryResult;

      const baseName = buildExportFilename(buildFilenameParts(variantParams), variantParams.seed).replace(/\.svg$/i, '');

      let svgText = '';
      let epsText = '';
      let pngBuffer: Buffer | null = null;
      let filesOk = 0;
      const notes: string[] = [];

      try {
        svgText = buildSingleTileSvg(tileData);
        filesOk++;
      } catch (e) {
        notes.push(`SVG export failed: ${(e as Error).message}`);
      }
      try {
        epsText = buildEps(tileData);
        filesOk++;
      } catch (e) {
        notes.push(`EPS export failed: ${(e as Error).message}`);
      }
      try {
        pngBuffer = svgText ? await rasterizePng(page, svgText, 2000) : null;
        if (pngBuffer) filesOk++;
        else notes.push('PNG rasterization failed');
      } catch (e) {
        notes.push(`PNG export failed: ${(e as Error).message}`);
      }
      const jsonText = JSON.stringify(variantParams, null, 2);
      filesOk++; // JSON always succeeds (plain serialization)

      const exportCompleteness = Math.round((filesOk / 4) * 100);
      if (filesOk < 4) exportFailures++;

      // Duplicate detection: the exact same File-shaped import Build 018-021
      // already route every batch item through, run across the FULL
      // 100-item portfolio (knownAssets accumulates across collections).
      const svgFile = new File([svgText], `${baseName}.svg`, { type: 'image/svg+xml' });
      const jsonFile = new File([jsonText], `${baseName}.json`, { type: 'application/json' });
      const group: FileGroup<File> = { basename: baseName, files: [svgFile, jsonFile] };
      const outcome: ImportOutcome = await importFileGroup(group, knownAssets, {});
      if (outcome.status === 'imported') knownAssets.push(outcome.asset);
      if (outcome.status === 'possibleDuplicate' || outcome.status === 'blockedDuplicate') duplicateWarnings++;

      // Write loose files.
      if (svgText) fs.writeFileSync(path.join(collectionDir, `${baseName}.svg`), svgText);
      if (epsText) fs.writeFileSync(path.join(collectionDir, `${baseName}.eps`), epsText);
      if (pngBuffer) fs.writeFileSync(path.join(collectionDir, `${baseName}.png`), pngBuffer);
      fs.writeFileSync(path.join(collectionDir, `${baseName}.json`), jsonText);

      if (svgText) zipEntries.push({ name: `${baseName}.svg`, data: new TextEncoder().encode(svgText) });
      if (epsText) zipEntries.push({ name: `${baseName}.eps`, data: new TextEncoder().encode(epsText) });
      if (pngBuffer) zipEntries.push({ name: `${baseName}.png`, data: new Uint8Array(pngBuffer) });
      zipEntries.push({ name: `${baseName}.json`, data: new TextEncoder().encode(jsonText) });

      // SEO — reuses `buildSiteMetadata`'s existing Shutterstock fields
      // (English title/description/up-to-50-keywords), not new copy.
      const sites = buildSiteMetadata(tileData);
      const ss = sites.find((s) => s.id === 'shutterstock')!;
      const title = ss.fields.find((f) => f.label === 'Title')!.value;
      const description = ss.fields.find((f) => f.label === 'Description')!.value;
      const keywordsField = ss.fields.find((f) => f.label === 'Keywords')!.value;
      const keywords = keywordsField.split(',').map((k) => k.trim()).filter(Boolean);
      if (keywords.length !== 50) notes.push(`keyword count ${keywords.length} != 50`);

      // Quality validation (Section 7 of the brief) — every dimension below
      // reuses an existing, already-real `CompositionMetrics`/
      // `BotanicalBeautyMetrics` field or an already-established score
      // function; only the plain averaging is new (same convention this
      // codebase's own `CommercialPatternCritique.visualStory` already
      // uses for a composite of pre-existing metrics).
      const botanical = computeBotanicalBeautyMetrics(tileData, metrics);
      const overallScore = computeOverallScore(metrics, 'stockClean').score;
      const seamlessRepeat = round1((metrics.seamlessIntegrity + metrics.cornerContinuity) / 2);
      const compositionBalance = round1((metrics.composition + metrics.quadrantBalance + metrics.horizontalBalance + metrics.verticalBalance) / 4);
      const colorHarmony = round1((metrics.colorBalance + metrics.paletteContrast) / 2);
      const botanicalStructure = round1(botanical.overall);
      const svgValidity = metrics.svgHealth;
      const duplicateSimilarity = outcome.status === 'imported' ? 100 : outcome.status === 'possibleDuplicate' ? 60 : 0;

      const subMetrics = [seamlessRepeat, heroVisibilityScore, compositionBalance, botanicalStructure, colorHarmony, svgValidity];
      let classification: 'READY' | 'REVIEW' | 'REJECT';
      if (outcome.status === 'blockedDuplicate' || outcome.status === 'error' || overallScore < HARD_FLOOR || subMetrics.some((m) => m < HARD_FLOOR) || exportCompleteness < 100) {
        classification = 'REJECT';
        if (outcome.status === 'blockedDuplicate') notes.push('blocked as duplicate');
        if (overallScore < HARD_FLOOR) notes.push(`overall ${overallScore} below ${HARD_FLOOR} commercial floor`);
        if (exportCompleteness < 100) notes.push('incomplete export');
      } else if (
        overallScore >= READY_OVERALL_MIN &&
        [seamlessRepeat, heroVisibilityScore, compositionBalance, botanicalStructure, colorHarmony].every((m) => m >= READY_SUBMETRIC_MIN) &&
        svgValidity >= READY_SVG_HEALTH_MIN &&
        outcome.status === 'imported'
      ) {
        classification = 'READY';
      } else {
        classification = 'REVIEW';
        if (outcome.status === 'possibleDuplicate') notes.push('flagged as possible duplicate');
        if (overallScore < READY_OVERALL_MIN) notes.push(`overall ${overallScore} below READY bar ${READY_OVERALL_MIN}`);
      }

      if (classification === 'READY') readyCount++;
      else if (classification === 'REVIEW') reviewCount++;
      else rejectCount++;
      collectionScoreSum += overallScore;

      manifestRows.push({
        index: ci * ITEMS_PER_COLLECTION + i,
        collection: spec.label,
        filename: baseName,
        seed: variantParams.seed,
        botanicalFamily: String(variantParams.botanicalFamily ?? ''),
        compositionZone: String(variantParams.compositionZone ?? ''),
        heroArchetype: String(variantParams.heroArchetype ?? ''),
        paletteId: variantParams.paletteId,
        density: round1(variantParams.density),
        negativeSpace: round1(variantParams.negativeSpace ?? 0),
        rhythmStrength: round1(variantParams.compositionIntelligence?.rhythmStrength ?? 0),
        attempts,
        regenerated,
        importStatus: outcome.status,
      });

      qualityRows.push({
        filename: baseName,
        collection: spec.label,
        classification,
        overallScore: round1(overallScore),
        seamlessRepeat,
        heroVisibility: round1(heroVisibilityScore),
        compositionBalance,
        botanicalStructure,
        colorHarmony,
        duplicateSimilarity,
        svgValidity,
        exportCompleteness,
        notes: notes.join('; '),
      });

      seoRows.push({ filename: baseName, collection: spec.label, title, description, keywordCount: keywords.length, keywords });
    }

    // Per-collection production ZIP package.
    const zipBlob = buildZip(zipEntries);
    const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());
    fs.writeFileSync(path.join(collectionDir, `${spec.dir}.zip`), zipBuffer);

    collectionAverages.push({
      collection: spec.label,
      mean: round1(collectionScoreSum / ITEMS_PER_COLLECTION),
      readyCount,
      reviewCount,
      rejectCount,
    });

    console.log(`[${ci + 1}/${COLLECTIONS.length}] ${spec.label}: mean overall ${round1(collectionScoreSum / ITEMS_PER_COLLECTION)}, READY=${readyCount} REVIEW=${reviewCount} REJECT=${rejectCount}`);
  }

  await browser.close();

  // ---- CSVs ----
  let manifestCsv = csvRow(['index', 'collection', 'filename', 'seed', 'botanicalFamily', 'compositionZone', 'heroArchetype', 'paletteId', 'density', 'negativeSpace', 'rhythmStrength', 'attempts', 'regenerated', 'importStatus']);
  for (const r of manifestRows) {
    manifestCsv += csvRow([r.index, r.collection, r.filename, r.seed, r.botanicalFamily, r.compositionZone, r.heroArchetype, r.paletteId, r.density, r.negativeSpace, r.rhythmStrength, r.attempts, String(r.regenerated), r.importStatus]);
  }
  fs.writeFileSync(path.join(outRoot, 'portfolio_manifest.csv'), manifestCsv);

  let qualityCsv = csvRow(['filename', 'collection', 'classification', 'overallScore', 'seamlessRepeat', 'heroVisibility', 'compositionBalance', 'botanicalStructure', 'colorHarmony', 'duplicateSimilarity', 'svgValidity', 'exportCompleteness', 'notes']);
  for (const r of qualityRows) {
    qualityCsv += csvRow([r.filename, r.collection, r.classification, r.overallScore, r.seamlessRepeat, r.heroVisibility, r.compositionBalance, r.botanicalStructure, r.colorHarmony, r.duplicateSimilarity, r.svgValidity, r.exportCompleteness, r.notes]);
  }
  fs.writeFileSync(path.join(outRoot, 'quality_review.csv'), qualityCsv);

  let seoCsv = csvRow(['filename', 'collection', 'seoTitle', 'seoDescription', 'keywordCount', 'keywords']);
  for (const r of seoRows) {
    seoCsv += csvRow([r.filename, r.collection, r.title, r.description, r.keywordCount, r.keywords.join('; ')]);
  }
  fs.writeFileSync(path.join(outRoot, 'seo_master.csv'), seoCsv);

  // ---- Summary JSON (for the report step) ----
  const totalReady = qualityRows.filter((r) => r.classification === 'READY').length;
  const totalReview = qualityRows.filter((r) => r.classification === 'REVIEW').length;
  const totalReject = qualityRows.filter((r) => r.classification === 'REJECT').length;

  const summary = {
    totalGenerated: manifestRows.length,
    readyCount: totalReady,
    reviewCount: totalReview,
    rejectCount: totalReject,
    duplicateWarnings,
    exportFailures,
    collectionAverages,
    outputFolder: outRoot,
  };
  fs.writeFileSync(path.join(outRoot, 'phase1_summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
