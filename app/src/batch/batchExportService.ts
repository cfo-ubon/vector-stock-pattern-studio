import type { PortfolioAsset } from '../catalog/domain/types';
import { buildZip, type ZipEntry } from '../export/zip';
import { getPortfolioAsset, loadFilesForAsset } from '../catalog/storage/portfolioStore';
import { buildAssetZipEntries, AssetExportIntegrityError, PORTFOLIO_EXPORT_MANIFEST_VERSION, type PortfolioExportManifestFileEntry } from '../catalog/services/exportAsset';

// Build 018 ("Revenue First", Priority 6 — portfolio export workflow).
// Generalizes `catalog/services/exportAsset.ts`'s existing single-asset
// ZIP builder to many assets in one archive, reusing its hash-verified
// `buildAssetZipEntries` core unchanged (see that function's own doc
// comment) rather than re-implementing hash verification or zip-entry
// construction. Each asset gets its own subfolder (named from its
// display name + id) so multiple assets sharing a filename never
// collide across the whole batch, and one combined `manifest.json`
// lists every asset + its files instead of one manifest per asset.

export interface BatchExportManifestAssetEntry {
  assetId: string;
  folder: string;
  asset: PortfolioAsset;
  files: PortfolioExportManifestFileEntry[];
}

export interface BatchExportManifest {
  manifestVersion: number;
  exportedAt: number;
  assetCount: number;
  assets: BatchExportManifestAssetEntry[];
}

/** Filesystem-safe folder name for one asset within the combined
 * archive — same slugify convention `catalog/services/exportAsset.ts`'s
 * `exportAssetById` already uses for its own top-level zip filename. */
function assetFolderName(asset: PortfolioAsset): string {
  const safe = asset.displayName.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'asset'}-${asset.assetId}`;
}

/** Builds one combined ZIP containing every given asset's source files,
 * each under its own subfolder, plus one manifest listing all of them.
 * Any single asset's integrity failure aborts the whole export (same
 * fail-fast guarantee `buildAssetExportZip` gives for one asset) rather
 * than silently shipping a partial archive. */
export async function buildBatchExportZip(assetIds: string[]): Promise<Blob> {
  const usedNames = new Set<string>(['manifest.json']);
  const zipEntries: ZipEntry[] = [];
  const manifestAssets: BatchExportManifestAssetEntry[] = [];

  for (const assetId of assetIds) {
    const asset = await getPortfolioAsset(assetId);
    if (!asset) throw new AssetExportIntegrityError(`Asset ${assetId} not found in the catalog — cannot export.`);
    const files = await loadFilesForAsset(assetId);
    const folder = assetFolderName(asset);

    const folderUsedNames = new Set<string>();
    const { entries, manifestFiles } = await buildAssetZipEntries(asset, files, folderUsedNames);
    for (const entry of entries) {
      zipEntries.push({ name: `${folder}/${entry.name}`, data: entry.data });
    }
    usedNames.add(folder);
    manifestAssets.push({ assetId: asset.assetId, folder, asset, files: manifestFiles });
  }

  const manifest: BatchExportManifest = {
    manifestVersion: PORTFOLIO_EXPORT_MANIFEST_VERSION,
    exportedAt: Date.now(),
    assetCount: assetIds.length,
    assets: manifestAssets,
  };
  zipEntries.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });

  return buildZip(zipEntries);
}

/** Convenience wrapper matching `exportAssetById`'s
 * `{ blob, filename }` shape, for a batch of assets instead of one. */
export async function exportAssetsAsZip(assetIds: string[], archiveName = 'batch-export'): Promise<{ blob: Blob; filename: string }> {
  const blob = await buildBatchExportZip(assetIds);
  const safeName = archiveName.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'batch-export';
  return { blob, filename: `${safeName}-${assetIds.length}-patterns.zip` };
}
