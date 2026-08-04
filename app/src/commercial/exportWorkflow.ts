import type { PortfolioAsset, PortfolioFileRecord } from '../catalog/domain/types';
import type { Collection } from '../catalog/domain/collection';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import type { SubmissionStatus } from '../catalog/submission/submissionStatus';
import type { CommercialReadinessReport, CommercialPackageHistoryEntry } from './domain/types';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { buildCommercialPackage } from './packageBuilder';
import { exportAssetsAsZip } from '../batch/batchExportService';
import { buildCompressedZip, type ZipInputEntry } from '../backup/zipArchive';

// Hotfix v1.0.1 — Commercial Export UX. Every marketplace-specific artifact
// below is produced by `buildCommercialPackage()` (Build 031A, unmodified)
// or `exportAssetsAsZip()` (Build 018, unmodified) — this module only
// orchestrates *which* existing builder runs for *which* asset/marketplace
// and bundles the results, per the mission's explicit "Reuse existing
// Commercial Pipeline. Never duplicate." instruction. No new scoring,
// packaging, or SEO logic is added anywhere in this file.

/** Part 2's literal 6 marketplace options. Four map onto this app's real,
 * already-verified `MarketplaceProfile`s (Shutterstock/Adobe/Freepik/Etsy);
 * Getty and Custom have no wired profile (same honest gap already
 * documented in `WORKSPACE_LAYOUT.md`'s Marketplace/Getty folder), so they
 * fall back to the generic multi-file ZIP export every asset already
 * supports rather than fabricating marketplace-specific rules for them. */
export type ExportMarketplaceId = MarketplaceId | 'getty' | 'custom';

export interface ExportMarketplaceOption {
  id: ExportMarketplaceId;
  label: string;
  /** True when a real `MarketplaceProfile` backs this option — packages
   * are built via `buildCommercialPackage()`. False (Getty/Custom) uses
   * the generic export path instead. */
  wired: boolean;
  /** Part 3, "Marketplace Profile" — what a package for this marketplace
   * actually contains, for display only. Reuses the real profile's own
   * `exportPackageFiles` list where one exists. */
  exportFiles: string[];
}

const GENERIC_EXPORT_FILES = ['SVG', 'PNG (ถ้ามี)', 'EPS (ถ้ามี)', 'ในไฟล์ ZIP เดียว'];

export const EXPORT_MARKETPLACE_OPTIONS: ExportMarketplaceOption[] = [
  { id: 'shutterstock', label: MARKETPLACE_PROFILES.shutterstock.label, wired: true, exportFiles: MARKETPLACE_PROFILES.shutterstock.exportPackageFiles },
  { id: 'adobestock', label: MARKETPLACE_PROFILES.adobestock.label, wired: true, exportFiles: MARKETPLACE_PROFILES.adobestock.exportPackageFiles },
  { id: 'freepik', label: MARKETPLACE_PROFILES.freepik.label, wired: true, exportFiles: MARKETPLACE_PROFILES.freepik.exportPackageFiles },
  { id: 'getty', label: 'Getty Images', wired: false, exportFiles: GENERIC_EXPORT_FILES },
  { id: 'etsy', label: MARKETPLACE_PROFILES.etsy.label, wired: true, exportFiles: MARKETPLACE_PROFILES.etsy.exportPackageFiles },
  { id: 'custom', label: 'กำหนดเอง (Custom)', wired: false, exportFiles: GENERIC_EXPORT_FILES },
];

export function findExportMarketplaceOption(id: ExportMarketplaceId): ExportMarketplaceOption | undefined {
  return EXPORT_MARKETPLACE_OPTIONS.find((m) => m.id === id);
}

// --- Part 7: Export Status ------------------------------------------------

export type AssetExportStatusId = 'never-exported' | 'export-ready' | 'exported' | 'submitted' | 'accepted' | 'rejected' | 'archived';

export interface AssetExportStatus {
  id: AssetExportStatusId;
  label: string;
  /** Timestamp of the underlying event this status was derived from — null
   * for the two states that have no event yet (`never-exported`/`export-ready`). */
  at: number | null;
}

export const EXPORT_STATUS_LABEL_TH: Record<AssetExportStatusId, string> = {
  'never-exported': 'ยังไม่เคย Export',
  'export-ready': 'พร้อม Export',
  exported: 'Export แล้ว',
  submitted: 'ส่งแล้ว',
  accepted: 'ได้รับการอนุมัติ',
  rejected: 'ถูกปฏิเสธ',
  archived: 'เก็บถาวร',
};

function mapSubmissionStatusToExportStatus(status: SubmissionStatus): AssetExportStatusId | null {
  switch (status) {
    case 'SUBMITTED':
      return 'submitted';
    case 'APPROVED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    case 'ARCHIVED':
      return 'archived';
    // DRAFT/READY/QUEUED are pre-submission planning states on the
    // Submission Center's own record — not real export/submission
    // activity yet, so they don't produce an export-status event here.
    case 'DRAFT':
    case 'READY':
    case 'QUEUED':
    default:
      return null;
  }
}

export interface DeriveExportStatusInput {
  readiness: CommercialReadinessReport | null;
  submissionsForAsset: SubmissionRecord[];
  packageHistoryForAsset: CommercialPackageHistoryEntry[];
}

/** Reads only real, already-persisted events (submission status
 * transitions, commercial-package build history) and the already-computed
 * readiness band — never a new state machine, never a fabricated status.
 * Picks the single most recent real event across both sources; when
 * nothing has happened yet, falls back to the readiness band ("Export
 * Ready" vs "Never Exported"). */
export function deriveAssetExportStatus(input: DeriveExportStatusInput): AssetExportStatus {
  const events: { id: AssetExportStatusId; at: number }[] = [];
  for (const submission of input.submissionsForAsset) {
    const mapped = mapSubmissionStatusToExportStatus(submission.status);
    if (mapped) events.push({ id: mapped, at: submission.updatedAt });
  }
  for (const entry of input.packageHistoryForAsset) {
    events.push({ id: 'exported', at: entry.createdAt });
  }
  if (events.length > 0) {
    events.sort((a, b) => b.at - a.at);
    const latest = events[0];
    return { id: latest.id, label: EXPORT_STATUS_LABEL_TH[latest.id], at: latest.at };
  }
  if (input.readiness?.band === 'READY') {
    return { id: 'export-ready', label: EXPORT_STATUS_LABEL_TH['export-ready'], at: null };
  }
  return { id: 'never-exported', label: EXPORT_STATUS_LABEL_TH['never-exported'], at: null };
}

// --- Part 5/6: Bulk export -------------------------------------------------

export interface BulkExportAssetInput {
  asset: PortfolioAsset;
  files: PortfolioFileRecord[];
  readiness: CommercialReadinessReport | null;
  /** The best available submission for this asset+marketplace (if any) —
   * passed straight through to `buildCommercialPackage()`, never
   * regenerated. */
  submission: SubmissionRecord | null;
  collections: Collection[];
}

export interface BulkExportSkippedAsset {
  assetId: string;
  displayName: string;
  reason: string;
}

export interface BulkExportResult {
  marketplaceId: ExportMarketplaceId;
  marketplaceLabel: string;
  blob: Blob;
  filename: string;
  fileCount: number;
  createdAt: number;
  builtAssetIds: string[];
  skipped: BulkExportSkippedAsset[];
}

function formatDateStamp(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** Part 5: builds "one ZIP per marketplace" for a set of selected assets
 * (1 to however many are selected). For a wired marketplace, every asset's
 * individual commercial package is built via the existing, unmodified
 * `buildCommercialPackage()`, then all of those already-built package ZIPs
 * are bundled — as nested entries, never re-flattened or re-derived — into
 * one outer ZIP via `zipArchive.ts`'s existing `buildCompressedZip()|`. An
 * asset that fails to build (e.g. missing files) is skipped with an honest
 * reason rather than aborting the whole marketplace's export. For Getty/
 * Custom (no marketplace profile), the existing generic
 * `exportAssetsAsZip()` already produces one combined ZIP for all selected
 * assets, so it's used directly with no wrapping needed. */
export async function buildBulkExportForMarketplace(
  marketplace: ExportMarketplaceOption,
  inputs: BulkExportAssetInput[],
  now: number = Date.now(),
): Promise<BulkExportResult> {
  if (!marketplace.wired) {
    const assetIds = inputs.map((i) => i.asset.assetId);
    const { blob, filename } = await exportAssetsAsZip(assetIds, `bulk-export-${marketplace.id}`);
    return {
      marketplaceId: marketplace.id,
      marketplaceLabel: marketplace.label,
      blob,
      filename,
      fileCount: assetIds.length,
      createdAt: now,
      builtAssetIds: assetIds,
      skipped: [],
    };
  }

  const innerEntries: ZipInputEntry[] = [];
  const builtAssetIds: string[] = [];
  const skipped: BulkExportSkippedAsset[] = [];

  for (const input of inputs) {
    if (!input.readiness) {
      skipped.push({ assetId: input.asset.assetId, displayName: input.asset.displayName, reason: 'ยังไม่มีรายงาน Commercial Readiness สำหรับชิ้นงานนี้' });
      continue;
    }
    try {
      const packageResult = await buildCommercialPackage({
        asset: input.asset,
        files: input.files,
        marketplaceId: marketplace.id as MarketplaceId,
        readiness: input.readiness,
        submission: input.submission,
        collections: input.collections,
      });
      const data = new Uint8Array(await packageResult.blob.arrayBuffer());
      innerEntries.push({ name: packageResult.filename, data });
      builtAssetIds.push(input.asset.assetId);
    } catch (err) {
      skipped.push({ assetId: input.asset.assetId, displayName: input.asset.displayName, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  const { blob } = await buildCompressedZip(innerEntries);
  const filename = `bulk-export-${marketplace.id}-${builtAssetIds.length}-assets-${formatDateStamp(now)}.zip`;
  return {
    marketplaceId: marketplace.id,
    marketplaceLabel: marketplace.label,
    blob,
    filename,
    fileCount: innerEntries.length,
    createdAt: now,
    builtAssetIds,
    skipped,
  };
}
