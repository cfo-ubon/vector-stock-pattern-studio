import { generateBatchToPortfolio, type BatchProductionInput } from '../batch/batchProductionService';
import { loadGenerateParamsForAsset, prepareAutopilotSeoForItem } from '../autopilot/seoPreparation';
import { loadCommercialPipelineContext } from '../commercial/loadCommercialPipelineContext';
import { buildCommercialPackage } from '../commercial/packageBuilder';
import { computeCommercialReadiness } from '../commercial/readinessEngine';
import { canExportPackage, loadSafetyThresholdConfig } from '../commercial/safetyThreshold';
import { checkCollectionCompleteness } from '../commercial/collectionCompleteness';
import { recordCommercialPackageBuilt } from '../commercial/storage/commercialPackageHistoryStore';
import { loadPortfolioAssets, putPortfolioAsset, loadFilesForAsset } from '../catalog/storage/portfolioStore';
import { loadCollections } from '../catalog/storage/collectionStore';
import { loadQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import type { FactoryTask } from './domain/types';
import type { GenerateParams } from '../engine/types';
import type { PortfolioAsset } from '../catalog/domain/types';

// Build 031C, Parts 1/5 — Task Executors. Each executor is a thin wrapper
// that delegates to one already-existing module (never a second
// implementation of generation/QA/SEO/packaging/export-readiness/
// collection-completeness) and reports back a real, honest outcome —
// never a fabricated "success." `generate` is never called by the
// Scheduler automatically (Part 9); it is the only executor a caller
// invokes directly, from an explicit user action.

export interface TaskExecutionResult {
  ok: boolean;
  detail: string;
  /** New asset ids created (only ever populated by `generate`). */
  createdAssetIds: string[];
}

export async function executeGenerateTask(task: FactoryTask, params: GenerateParams, count: number): Promise<TaskExecutionResult> {
  const existingAssets = await loadPortfolioAssets();
  const input: BatchProductionInput = { count, params, existingAssets };
  const result = await generateBatchToPortfolio(input);
  const createdAssetIds = result.items.filter((i): i is typeof i & { outcome: { status: 'imported' } } => i.outcome.status === 'imported').map((i) => i.outcome.asset.assetId);
  if (result.importedCount === 0) {
    return { ok: false, detail: `Generated ${result.generatedCount} pattern(s) but none imported (${result.errorCount} error(s), ${result.blockedDuplicateCount} duplicate(s)).`, createdAssetIds };
  }
  return { ok: true, detail: `Imported ${result.importedCount} of ${result.generatedCount} generated pattern(s) for batch ${task.batchId ?? task.id}.`, createdAssetIds };
}

export async function executeQaTask(assetId: string): Promise<TaskExecutionResult> {
  // Generation already runs QA + bounded repair as part of importing
  // (`generateWithBoundedRepair`, called inside `generateBatchToPortfolio`)
  // — this task's job is only to confirm a real QualitySnapshot exists
  // for the asset, never to re-run scoring a second time.
  const snapshots = await loadQualitySnapshots();
  const snapshot = snapshots.filter((s) => s.assetId === assetId).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!snapshot) return { ok: false, detail: `No QualitySnapshot exists yet for asset ${assetId}.`, createdAssetIds: [] };
  return { ok: true, detail: `QA decision for ${assetId}: ${snapshot.decision}.`, createdAssetIds: [] };
}

export async function executeRepairTask(assetId: string): Promise<TaskExecutionResult> {
  const snapshots = await loadQualitySnapshots();
  const snapshot = snapshots.filter((s) => s.assetId === assetId).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!snapshot) return { ok: false, detail: `No QualitySnapshot exists yet for asset ${assetId}.`, createdAssetIds: [] };
  if (snapshot.decision === 'READY') {
    return { ok: true, detail: `Asset ${assetId} already passed QA (${snapshot.decision}) — no repair needed.`, createdAssetIds: [] };
  }
  const assets = await loadPortfolioAssets();
  const asset = assets.find((a) => a.assetId === assetId);
  if (!asset) return { ok: false, detail: `Asset ${assetId} not found.`, createdAssetIds: [] };
  const params = await loadGenerateParamsForAsset(asset);
  if (!params) return { ok: false, detail: `Cannot repair ${assetId} — no generation parameters recoverable from its metadata sidecar.`, createdAssetIds: [] };
  const result = await generateBatchToPortfolio({ count: 1, params, existingAssets: assets });
  if (result.importedCount === 0) return { ok: false, detail: `Repair attempt for ${assetId} did not produce an importable pattern.`, createdAssetIds: [] };
  return { ok: true, detail: `Repair regenerated a new candidate for ${assetId} (${result.items[0]?.outcome.status ?? 'unknown'}).`, createdAssetIds: result.items.filter((i): i is typeof i & { outcome: { status: 'imported' } } => i.outcome.status === 'imported').map((i) => i.outcome.asset.assetId) };
}

export async function executeSeoTask(assetId: string, targetMarketplace: string): Promise<TaskExecutionResult> {
  const assets = await loadPortfolioAssets();
  const asset = assets.find((a) => a.assetId === assetId);
  if (!asset) return { ok: false, detail: `Asset ${assetId} not found.`, createdAssetIds: [] };
  const params = await loadGenerateParamsForAsset(asset);
  if (!params) return { ok: false, detail: `Needs marketplace profile verification — no metadata sidecar found for ${assetId}.`, createdAssetIds: [] };
  const seoResult = prepareAutopilotSeoForItem(assetId, params, targetMarketplace);
  if (seoResult.status !== 'ready') return { ok: false, detail: seoResult.reason, createdAssetIds: [] };
  return { ok: true, detail: `SEO ready: "${seoResult.results[0].package.title}" (${seoResult.results[0].package.keywords.length} keywords).`, createdAssetIds: [] };
}

export async function executePackageTask(assetId: string, targetMarketplace: string): Promise<TaskExecutionResult> {
  const [assets, files, collections] = await Promise.all([loadPortfolioAssets(), loadFilesForAsset(assetId), loadCollections()]);
  const asset = assets.find((a) => a.assetId === assetId);
  if (!asset) return { ok: false, detail: `Asset ${assetId} not found.`, createdAssetIds: [] };
  const context = await loadCommercialPipelineContext();
  const readiness = context.readinessReports.find((r) => r.assetId === assetId) ?? computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: assets.filter((a) => a.assetId !== assetId) });
  const submission = null;
  try {
    const result = await buildCommercialPackage({ asset, files, marketplaceId: targetMarketplace as never, readiness, submission, collections });
    await recordCommercialPackageBuilt({ assetId, marketplaceId: targetMarketplace, readinessScore: readiness.score, status: result.manifest.status });
    return { ok: true, detail: `Commercial Package built for ${assetId} (${result.manifest.status}).`, createdAssetIds: [] };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err), createdAssetIds: [] };
  }
}

export async function executeExportValidationTask(assetId: string): Promise<TaskExecutionResult> {
  const assets = await loadPortfolioAssets();
  const asset = assets.find((a) => a.assetId === assetId);
  if (!asset) return { ok: false, detail: `Asset ${assetId} not found.`, createdAssetIds: [] };
  const context = await loadCommercialPipelineContext();
  const readiness = context.readinessReports.find((r) => r.assetId === assetId) ?? computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: assets.filter((a) => a.assetId !== assetId) });
  const permission = canExportPackage(readiness, loadSafetyThresholdConfig(), false);
  if (!permission.allowed) return { ok: false, detail: permission.reason, createdAssetIds: [] };
  const updated: PortfolioAsset = { ...asset, workflowStatus: 'READY_TO_UPLOAD' };
  await putPortfolioAsset(updated);
  return { ok: true, detail: permission.reason, createdAssetIds: [] };
}

export async function executeCollectionCompletionTask(collectionId: string): Promise<TaskExecutionResult> {
  const [collections, assets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return { ok: false, detail: `Collection ${collectionId} not found.`, createdAssetIds: [] };
  const memberAssets = assets.filter((a) => a.collectionIds.includes(collectionId));
  const report = checkCollectionCompleteness(collection, memberAssets);
  if (report.missingRoles.length > 0) return { ok: false, detail: `Collection is still missing: ${report.missingRoles.join(', ')}.`, createdAssetIds: [] };
  return { ok: true, detail: 'Collection is complete — every tracked role is present.', createdAssetIds: [] };
}

export async function executePortfolioUpdateTask(assetId: string): Promise<TaskExecutionResult> {
  const [assets, snapshots] = await Promise.all([loadPortfolioAssets(), loadQualitySnapshots()]);
  const asset = assets.find((a) => a.assetId === assetId);
  if (!asset) return { ok: false, detail: `Asset ${assetId} not found.`, createdAssetIds: [] };
  const snapshot = snapshots.filter((s) => s.assetId === assetId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const nextStatus = snapshot?.decision === 'READY' ? 'READY_TO_UPLOAD' : snapshot?.decision === 'REVIEW' ? 'READY_FOR_REVIEW' : snapshot?.decision === 'REJECT' ? 'NEEDS_REVISION' : asset.workflowStatus;
  if (nextStatus === asset.workflowStatus) return { ok: true, detail: `Workflow status for ${assetId} already ${asset.workflowStatus}.`, createdAssetIds: [] };
  await putPortfolioAsset({ ...asset, workflowStatus: nextStatus });
  return { ok: true, detail: `Workflow status for ${assetId} updated to ${nextStatus}.`, createdAssetIds: [] };
}
