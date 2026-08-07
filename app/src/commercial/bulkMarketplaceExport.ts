import { loadFilesForAsset } from '../catalog/storage/portfolioStore';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { Collection } from '../catalog/domain/collection';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import { detectDuplicateSubmission } from '../catalog/submission/submissionDuplicateDetection';
import { recordCommercialPackageBuilt } from './storage/commercialPackageHistoryStore';
import { saveSubmissionPackageToWorkspace } from '../workspace/workspaceExportIntegration';
import { downloadBlobFile } from '../export/svgExporter';
import { buildBulkExportForMarketplace, findExportMarketplaceOption, type ExportMarketplaceId, type BulkExportResult } from './exportWorkflow';
import type { CommercialReadinessReport } from './domain/types';

// AI-SBOS Mission, Part 6 (Marketplace Export) — extracted from
// PortfolioManagerView.tsx's own bulk-export handler (the only place this
// logic existed before) so Today's Production Workspace can offer the
// identical single/bulk marketplace export flow without a second
// implementation. Both call sites (PortfolioManagerView.tsx and
// ProductionHomeView.tsx) now call these same two functions — real reuse,
// not a duplicated copy that could drift.

export interface BulkMarketplaceExportContext {
  assets: PortfolioAsset[];
  submissions: SubmissionRecord[];
  submissionsByAsset: Map<string, SubmissionRecord[]>;
  readinessByAsset: Map<string, CommercialReadinessReport>;
  collections: Collection[];
}

/** Real duplicate-submission warnings (an already-approved/already-submitted
 * version exists for this asset+marketplace) — computed before export, not
 * silently discovered after a ZIP was already built. */
export function computeDuplicateSubmissionWarnings(assetIds: string[], marketplaceIds: ExportMarketplaceId[], ctx: BulkMarketplaceExportContext): string[] {
  const warnings: string[] = [];
  for (const assetId of assetIds) {
    const asset = ctx.assets.find((a) => a.assetId === assetId);
    if (!asset) continue;
    for (const marketplaceId of marketplaceIds) {
      const relevant = ctx.submissionsByAsset.get(assetId) ?? [];
      const nextVersion = (relevant.filter((s) => s.marketplaceId === marketplaceId).sort((a, b) => b.version - a.version)[0]?.version ?? 0) + 1;
      const result = detectDuplicateSubmission({ patternId: assetId, marketplaceId, version: nextVersion, productionAssetId: asset.productionAssetId }, ctx.submissions);
      if (result.conflicts.some((c) => c.reason === 'already-approved' || c.reason === 'already-submitted')) {
        warnings.push(`${asset.displayName} — ${findExportMarketplaceOption(marketplaceId)?.label ?? marketplaceId}: มีการส่งที่อนุมัติ/รอตรวจอยู่แล้ว`);
      }
    }
  }
  return warnings;
}

/** Builds one ZIP per marketplace (via `buildBulkExportForMarketplace`,
 * `commercial/exportWorkflow.ts`'s real per-marketplace package builder,
 * reused unmodified), triggers each ZIP's browser download, saves a copy to
 * the desktop Workspace when running under Electron, and records package-
 * build history — for 1..N assets and 1..N marketplaces at once. Throws on
 * failure; callers own their own busy/error UI state. */
export async function executeBulkMarketplaceExport(assetIds: string[], marketplaceIds: ExportMarketplaceId[], ctx: BulkMarketplaceExportContext): Promise<BulkExportResult[]> {
  const targetAssets = ctx.assets.filter((a) => assetIds.includes(a.assetId));
  const results: BulkExportResult[] = [];
  for (const marketplaceId of marketplaceIds) {
    const option = findExportMarketplaceOption(marketplaceId);
    if (!option) continue;
    const inputs = await Promise.all(
      targetAssets.map(async (asset) => {
        const files = await loadFilesForAsset(asset.assetId);
        const assetSubmissions = ctx.submissionsByAsset.get(asset.assetId) ?? [];
        const submission = assetSubmissions.find((s) => s.marketplaceId === marketplaceId) ?? null;
        return {
          asset,
          files,
          readiness: ctx.readinessByAsset.get(asset.assetId) ?? null,
          submission,
          collections: ctx.collections.filter((c) => asset.collectionIds.includes(c.id)),
        };
      }),
    );
    const result = await buildBulkExportForMarketplace(option, inputs);
    results.push(result);
    downloadBlobFile(result.filename, result.blob);
    void saveSubmissionPackageToWorkspace(option.id, result);
    for (const assetId of result.builtAssetIds) {
      await recordCommercialPackageBuilt({
        assetId,
        marketplaceId: option.id,
        status: 'BUILT',
        readinessScore: ctx.readinessByAsset.get(assetId)?.score ?? 0,
      });
    }
  }
  return results;
}
