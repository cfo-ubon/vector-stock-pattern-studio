import type { PortfolioAsset, PortfolioFileRecord, SourceFileRole } from '../domain/types';
import { PORTFOLIO_ASSET_SCHEMA_VERSION } from '../domain/types';
import { isValidPortfolioAsset } from '../domain/asset';
import { loadPortfolioAssets, loadAllPortfolioFiles } from '../storage/portfolioStore';

// Sprint P1, Section 11 (Data Integrity) — "Portfolio Health Check" action.
// Every check here is read-only and reports issues; per the brief
// ("Do not silently repair destructive issues") nothing here mutates the
// catalog. `computeHealthReport` is pure (testable without IndexedDB);
// `runHealthCheck` is the thin async wrapper the UI actually calls.

export interface MissingSourceReference {
  assetId: string;
  fileId: string;
  role: SourceFileRole;
}

export interface DuplicateHashGroup {
  sha256: string;
  assetIds: string[];
}

export interface HealthCheckReport {
  generatedAt: number;
  recordCount: number;
  missingSourceReferences: MissingSourceReference[];
  missingPreviews: string[];
  duplicateHashGroups: DuplicateHashGroup[];
  orphanedFileIds: string[];
  invalidMetadataAssetIds: string[];
  migrationStatus: { upToDate: number; needsMigration: number; currentSchemaVersion: number };
}

export function computeHealthReport(assets: PortfolioAsset[], files: PortfolioFileRecord[]): HealthCheckReport {
  const fileIdSet = new Set(files.map((f) => f.fileId));
  const assetIdSet = new Set(assets.map((a) => a.assetId));

  const missingSourceReferences: MissingSourceReference[] = [];
  for (const asset of assets) {
    for (const ref of asset.sourceFileReferences) {
      if (!fileIdSet.has(ref.fileId)) missingSourceReferences.push({ assetId: asset.assetId, fileId: ref.fileId, role: ref.role });
    }
  }

  const missingPreviews = assets.filter((a) => a.previewReference === null).map((a) => a.assetId);

  const hashToAssetIds = new Map<string, Set<string>>();
  for (const asset of assets) {
    for (const hash of asset.sourceHashes) {
      if (!hashToAssetIds.has(hash)) hashToAssetIds.set(hash, new Set());
      hashToAssetIds.get(hash)!.add(asset.assetId);
    }
  }
  const duplicateHashGroups: DuplicateHashGroup[] = [...hashToAssetIds.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([sha256, ids]) => ({ sha256, assetIds: [...ids] }));

  const orphanedFileIds = files.filter((f) => !assetIdSet.has(f.assetId)).map((f) => f.fileId);

  const invalidMetadataAssetIds = assets.filter((a): boolean => !isValidPortfolioAsset(a)).map((a) => a.assetId);

  const upToDate = assets.filter((a) => a.schemaVersion === PORTFOLIO_ASSET_SCHEMA_VERSION).length;

  return {
    generatedAt: Date.now(),
    recordCount: assets.length,
    missingSourceReferences,
    missingPreviews,
    duplicateHashGroups,
    orphanedFileIds,
    invalidMetadataAssetIds,
    migrationStatus: { upToDate, needsMigration: assets.length - upToDate, currentSchemaVersion: PORTFOLIO_ASSET_SCHEMA_VERSION },
  };
}

export async function runHealthCheck(): Promise<HealthCheckReport> {
  const [assets, files] = await Promise.all([loadPortfolioAssets(), loadAllPortfolioFiles()]);
  return computeHealthReport(assets, files);
}

/** Every asset ID implicated in at least one duplicate-hash group —
 * convenient for feeding `PortfolioFilterQuery.duplicateAssetIds`. */
export function duplicateAssetIdsFromReport(report: HealthCheckReport): Set<string> {
  const ids = new Set<string>();
  for (const group of report.duplicateHashGroups) for (const id of group.assetIds) ids.add(id);
  return ids;
}
