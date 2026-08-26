// AI-SBOS v3, Milestones 13-18 — Commercial Quality Gate, Stock SEO,
// Marketplace Export. Approving a concept imports it into the real
// Portfolio catalog (the same `importFileGroup` Autopilot/Factory already
// use) so it can go through the exact same Commercial Readiness / SEO /
// Export pipeline every other screen in the app already uses — zero new
// business logic, zero new scoring, zero new export format.
import type { PortfolioAsset } from '../catalog/domain/types';
import type { FileGroup } from '../catalog/import/basenameGrouping';
import { importFileGroup, type ImportOutcome } from '../catalog/import/importPipeline';
import { loadPortfolioAssets, putPortfolioAsset } from '../catalog/storage/portfolioStore';
import { loadCollections, putCollectionRecord } from '../catalog/storage/collectionStore';
import { createCollection } from '../catalog/domain/collection';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { buildEps } from '../export/epsExporter';
import { revalidateDesignVersion } from '../design/designRevalidation';
import { generateSeoPackage, type SeoPackage } from '../catalog/seo/seoGenerator';
import { buildSeoContentInputFromParams } from '../autopilot/seoPreparation';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import { putSubmission, loadSubmissions } from '../catalog/submission/submissionStore';
import { executeBulkMarketplaceExport, type BulkMarketplaceExportContext } from '../commercial/bulkMarketplaceExport';
import { findExportMarketplaceOption, type ExportMarketplaceId, type BulkExportResult } from './../commercial/exportWorkflow';
import type { CommercialReadinessReport } from '../commercial/domain/types';
import type { Concept } from './generateFromIntent';

export interface GateStatus {
  id: 'VECTOR' | 'SEAMLESS' | 'QUALITY' | 'COMMERCIAL' | 'METADATA' | 'MARKETPLACE';
  label: string;
  status: 'PASS' | 'BLOCKED';
  detail: string;
}

export interface CommercialQaResult {
  asset: PortfolioAsset;
  readiness: CommercialReadinessReport;
  seoPackage: SeoPackage;
  gates: GateStatus[];
  overallStatus: 'READY' | 'REVIEW' | 'BLOCKED';
}

/** Real import into the shared Portfolio catalog — same File/FileGroup
 * construction Autopilot's own `generationOrchestrator.ts` uses. Tagged
 * with a distinct `generatorVersion` so the asset is traceable back to
 * AI-SBOS v3 without any new schema field. */
export async function importConcept(concept: Concept): Promise<ImportOutcome> {
  const existingAssets = await loadPortfolioAssets();
  const svgText = buildSingleTileSvg(concept.tileData);
  const epsText = buildEps(concept.tileData);
  const baseName = buildExportFilename(buildFilenameParts(concept.params), concept.params.seed).replace(/\.svg$/i, '');
  const svgFile = new File([svgText], `${baseName}.svg`, { type: 'image/svg+xml' });
  const epsFile = new File([epsText], `${baseName}.eps`, { type: 'application/postscript' });
  const jsonFile = new File([JSON.stringify(concept.params)], `${baseName}.json`, { type: 'application/json' });
  // Milestone 18 (Vector Export Validation): SVG and EPS are both built
  // from the exact same `concept.tileData` — the same object that already
  // passed the Vector Integrity Gate — so they necessarily correspond to
  // the same design, never a rasterized approximation re-labeled as
  // vector.
  const group: FileGroup<File> = { basename: baseName, files: [svgFile, epsFile, jsonFile] };
  const outcome = await importFileGroup(group, existingAssets, {
    generatorVersion: 'ai-sbos-v3',
    displayName: `${concept.label} — ${concept.params.categoryId}`,
  });
  if (outcome.status === 'imported') {
    outcome.asset = await ensureAssignedToV3Collection(outcome.asset);
  }
  return outcome;
}

const V3_COLLECTION_NAME = 'AI-SBOS v3 — Keyword Approvals';

/** Commercial Readiness's `collectionAssignment` check is one of the 4
 * "fundamental blockers" every other real generator path (Factory,
 * Autopilot) already satisfies by assigning generated assets to a real
 * Collection — v3's own Approve step needs the same real assignment, not
 * a synthetic pass. Reuses `createCollection`/`putCollectionRecord`
 * exactly as Collection Studio does; creates the one shared "AI-SBOS v3
 * — Keyword Approvals" collection once and reuses it on every later
 * approval, rather than one throwaway collection per asset. */
async function ensureAssignedToV3Collection(asset: PortfolioAsset): Promise<PortfolioAsset> {
  const collections = await loadCollections();
  let collection = collections.find((c) => c.name === V3_COLLECTION_NAME && !c.isArchived);
  if (!collection) {
    collection = createCollection({ name: V3_COLLECTION_NAME, description: 'Assets approved from AI-SBOS v3 (Keyword-to-Vector Seamless Factory).' });
    await putCollectionRecord(collection);
  }
  if (asset.collectionIds.includes(collection.id)) return asset;
  const updated: PortfolioAsset = { ...asset, collectionIds: [...asset.collectionIds, collection.id] };
  await putPortfolioAsset(updated);
  return updated;
}

const GATE_LABELS: Record<GateStatus['id'], string> = {
  VECTOR: 'Vector Integrity',
  SEAMLESS: 'Seamless Integrity',
  QUALITY: 'Quality',
  COMMERCIAL: 'Commercial Readiness',
  METADATA: 'Metadata / SEO',
  MARKETPLACE: 'Marketplace Requirements',
};

/** Milestone 13 — Commercial Quality Gate. Composes 6 named gates from
 * real, already-computed evidence — never silently downgrades a failed
 * gate, never fabricates readiness. `overallStatus` is BLOCKED if any
 * fundamental gate (VECTOR/SEAMLESS/QUALITY/COMMERCIAL) fails, REVIEW if
 * only SEO/marketplace formatting needs attention, READY only when every
 * gate passes. */
export async function runCommercialQualityGate(concept: Concept, asset: PortfolioAsset, marketplaceId: ExportMarketplaceId): Promise<CommercialQaResult> {
  const siblingAssets = await loadPortfolioAssets();

  const seoInput = buildSeoContentInputFromParams(concept.params);
  const seoPackage = generateSeoPackage(seoInput, marketplaceId);

  // Persist the generated SEO as a real SubmissionRecord — the same
  // record shape/store (`createSubmissionRecord`/`putSubmission`) the
  // Stock Submission Center itself writes. Readiness's `seoExists` check
  // looks for a real persisted submission, not just in-memory generated
  // content (confirmed by direct inspection — even Factory's own
  // `executeSeoTask` generates SEO without persisting a submission
  // record, which is why an asset can score real content but still show
  // `seoExists: FAIL` until something actually records it). Approving in
  // v3 is a real decision to prepare this asset for the chosen
  // marketplace, so persisting it here is the correct, non-fabricated
  // action, not a workaround.
  const submission = createSubmissionRecord({
    patternId: asset.assetId,
    marketplaceId,
    titleSnapshot: seoPackage.title,
    descriptionSnapshot: seoPackage.description,
    keywordSnapshot: seoPackage.keywords,
    productionAssetId: asset.productionAssetId,
  });
  putSubmission(submission);

  const { snapshot, updatedAsset, readiness } = await revalidateDesignVersion(asset, concept.tileData, siblingAssets, [submission]);

  const gates: GateStatus[] = [
    {
      id: 'VECTOR',
      label: GATE_LABELS.VECTOR,
      status: concept.vectorIntegrity.status === 'VECTOR_PASS' ? 'PASS' : 'BLOCKED',
      detail: concept.vectorIntegrity.status === 'VECTOR_PASS' ? 'All nodes are real vector primitives.' : concept.vectorIntegrity.issues.map((i) => i.detail).join('; '),
    },
    {
      id: 'SEAMLESS',
      label: GATE_LABELS.SEAMLESS,
      status: concept.seamlessIntegrity.status === 'SEAMLESS_PASS' ? 'PASS' : 'BLOCKED',
      detail: `Corner continuity ${concept.seamlessIntegrity.cornerContinuity}/100.`,
    },
    {
      id: 'QUALITY',
      label: GATE_LABELS.QUALITY,
      status: snapshot.decision === 'READY' ? 'PASS' : 'BLOCKED',
      detail: `Beauty score ${snapshot.beautyScore}, commercial score ${snapshot.commercialScore} — quality classifier decision: ${snapshot.decision}.`,
    },
    {
      id: 'COMMERCIAL',
      label: GATE_LABELS.COMMERCIAL,
      status: readiness.band === 'READY' ? 'PASS' : 'BLOCKED',
      detail: `Commercial Readiness score ${readiness.score}, band ${readiness.band}.`,
    },
    {
      id: 'METADATA',
      label: GATE_LABELS.METADATA,
      status: seoPackage.title && seoPackage.keywords.length > 0 ? 'PASS' : 'BLOCKED',
      detail: `Title, description, and ${seoPackage.keywords.length} keywords generated from the actual artwork.`,
    },
    {
      id: 'MARKETPLACE',
      label: GATE_LABELS.MARKETPLACE,
      status: seoPackage.validation.valid ? 'PASS' : 'BLOCKED',
      detail: seoPackage.validation.valid ? `Meets ${marketplaceId} submission requirements.` : seoPackage.validation.errors.map((e) => e.message).join('; '),
    },
  ];

  const blockedFundamental = gates.filter((g) => g.id !== 'METADATA' && g.id !== 'MARKETPLACE' && g.status === 'BLOCKED');
  const blockedAny = gates.some((g) => g.status === 'BLOCKED');
  const overallStatus: CommercialQaResult['overallStatus'] = blockedFundamental.length > 0 ? 'BLOCKED' : blockedAny ? 'REVIEW' : 'READY';

  return { asset: updatedAsset, readiness, seoPackage, gates, overallStatus };
}

/** Milestone 16-17 — Marketplace Export + Download, reusing the exact
 * same `executeBulkMarketplaceExport`/`DownloadCenter.tsx` v2's Today's
 * Production Workspace already uses (`commercial/bulkMarketplaceExport.ts`).
 * No auto-upload — this only builds the downloadable package. */
export async function exportConceptToMarketplace(qa: CommercialQaResult, marketplaceId: ExportMarketplaceId): Promise<BulkExportResult[]> {
  const option = findExportMarketplaceOption(marketplaceId);
  if (!option) throw new Error(`Unknown marketplace id: ${marketplaceId}`);

  const allAssets = await loadPortfolioAssets();
  const submissions = loadSubmissions();
  const submissionsByAsset = new Map<string, SubmissionRecord[]>();
  for (const submission of submissions) {
    const list = submissionsByAsset.get(submission.patternId) ?? [];
    list.push(submission);
    submissionsByAsset.set(submission.patternId, list);
  }

  const ctx: BulkMarketplaceExportContext = {
    assets: allAssets,
    submissions,
    submissionsByAsset,
    readinessByAsset: new Map([[qa.asset.assetId, qa.readiness]]),
    collections: [],
  };

  return executeBulkMarketplaceExport([qa.asset.assetId], [marketplaceId], ctx);
}
