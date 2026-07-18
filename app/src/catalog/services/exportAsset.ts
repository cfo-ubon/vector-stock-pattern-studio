import type { PortfolioAsset, PortfolioFileRecord } from '../domain/types';
import { buildZip, type ZipEntry } from '../../export/zip';
import { getPortfolioAsset, loadFilesForAsset } from '../storage/portfolioStore';
import { sha256Hex } from '../domain/hash';

// Sprint P1, Section 12 (Export and Portability — P1 Minimum). Reuses the
// app's existing dependency-free ZIP writer (`export/zip.ts`, STORE
// method — no recompression) exactly the way the Stock Submission
// Center's package export already does, so every source file (including
// the preview and any JSON source, both already among
// `sourceFileReferences` tagged by role) lands in the archive byte-for-
// byte. `manifest.json` carries the versioned catalog metadata + a
// per-file hash/size listing rather than duplicating that as separate
// files, mirroring `metadata/exportPackage.ts`'s existing
// `metadata.json` convention.

export const PORTFOLIO_EXPORT_MANIFEST_VERSION = 1;

export interface PortfolioExportManifestFileEntry {
  fileId: string;
  filename: string;
  role: PortfolioFileRecord['role'];
  sha256: string;
  fileSize: number;
}

export interface PortfolioExportManifest {
  manifestVersion: number;
  exportedAt: number;
  asset: PortfolioAsset;
  files: PortfolioExportManifestFileEntry[];
}

export class AssetExportIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetExportIntegrityError';
  }
}

/** Disambiguates same-named files across roles (e.g. a `preview.png` and
 * a differently-imported `preview.png` in the rare case of a manual
 * rename collision) the same way `metadata/filenameEngine.ts`'s
 * `dedupeFilename` does elsewhere in the app — appends `-2`, `-3`, ...
 * before the extension on collision. */
function dedupeZipName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${base}-${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/** Verifies every one of one asset's source files against its recorded
 * hash and returns the zip-ready entries + manifest rows for it, WITHOUT
 * wrapping them in a zip yet — the shared core both `buildAssetExportZip`
 * (single asset, own `manifest.json` at the archive root) and
 * `batch/batchExportService.ts` (Build 018, many assets, one namespaced
 * subfolder + entry per asset inside one combined archive) build on, so
 * the hash-integrity check has exactly one implementation regardless of
 * how many assets end up in the final archive. */
export async function buildAssetZipEntries(
  asset: PortfolioAsset,
  files: PortfolioFileRecord[],
  usedNames: Set<string> = new Set(),
): Promise<{ entries: ZipEntry[]; manifestFiles: PortfolioExportManifestFileEntry[] }> {
  const entries: ZipEntry[] = [];
  const manifestFiles: PortfolioExportManifestFileEntry[] = [];

  for (const ref of asset.sourceFileReferences) {
    const record = files.find((f) => f.fileId === ref.fileId);
    if (!record) throw new AssetExportIntegrityError(`Source file "${ref.filename}" (${ref.fileId}) is missing from storage — cannot export.`);

    const buffer = await record.blob.arrayBuffer();
    const actualHash = await sha256Hex(buffer);
    if (actualHash !== record.sha256) {
      throw new AssetExportIntegrityError(`Stored file "${record.filename}" failed its integrity check (hash mismatch) — export aborted.`);
    }

    const zipName = dedupeZipName(record.filename, usedNames);
    entries.push({ name: zipName, data: new Uint8Array(buffer) });
    manifestFiles.push({ fileId: record.fileId, filename: zipName, role: record.role, sha256: record.sha256, fileSize: record.fileSize });
  }

  return { entries, manifestFiles };
}

/** Builds a portable ZIP for one catalog asset. Verifies every file
 * body's real byte hash against its recorded `sha256` immediately before
 * zipping (Section 14: "hash integrity" test coverage) — a mismatch
 * throws `AssetExportIntegrityError` rather than silently exporting
 * corrupted/substituted content. */
export async function buildAssetExportZip(asset: PortfolioAsset, files: PortfolioFileRecord[]): Promise<Blob> {
  const usedNames = new Set<string>(['manifest.json']);
  const { entries: zipEntries, manifestFiles } = await buildAssetZipEntries(asset, files, usedNames);

  const manifest: PortfolioExportManifest = {
    manifestVersion: PORTFOLIO_EXPORT_MANIFEST_VERSION,
    exportedAt: Date.now(),
    asset,
    files: manifestFiles,
  };
  zipEntries.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });

  return buildZip(zipEntries);
}

export async function exportAssetById(assetId: string): Promise<{ blob: Blob; filename: string }> {
  const asset = await getPortfolioAsset(assetId);
  if (!asset) throw new AssetExportIntegrityError(`Asset ${assetId} not found in the catalog.`);
  const files = await loadFilesForAsset(assetId);
  const blob = await buildAssetExportZip(asset, files);
  const safeName = asset.displayName.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || asset.assetId;
  return { blob, filename: `${safeName}-${asset.assetId}.zip` };
}
