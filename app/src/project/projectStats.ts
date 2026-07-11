import type { Project } from './projectTypes';
import { STOCK_SITES } from '../metadata/shutterstock';

// Project Dashboard stats + the Asset Browser's data source — both derived
// purely from a Project's own already-persisted data (no separate stored
// counters that could drift from reality).

export interface ProjectAssetEntry {
  collectionId: string;
  collectionName: string;
  assetId: string;
  assetType: string;
  label: string;
  filename: string;
  svg?: string;
}

/** Flattens every asset across every Collection in the project into one
 * browsable list — the Asset Browser's data source. Real assets from
 * already-generated collections, not a separate cross-collection library
 * (Style DNA's precedent: Motif Factory output stays per-collection, this
 * just makes it browsable project-wide). */
export function listProjectAssets(project: Project): ProjectAssetEntry[] {
  return project.collections.flatMap((entry) =>
    entry.collection.assets.map((a) => ({
      collectionId: entry.id,
      collectionName: entry.collection.manifest.collectionName,
      assetId: a.id,
      assetType: a.type,
      label: a.label,
      filename: a.filename,
      svg: a.svg,
    })),
  );
}

export type MetadataStatus = 'complete' | 'partial' | 'missing';
export type ExportStatusLabel = 'exported' | 'never';
export type UploadStatusSummary = 'allReady' | 'inProgress' | 'notStarted' | 'noCollections';

export interface ProjectStats {
  collectionsCount: number;
  assetsCount: number;
  svgCount: number;
  metadataStatus: MetadataStatus;
  exportStatus: ExportStatusLabel;
  uploadStatus: UploadStatusSummary;
}

export function computeProjectStats(project: Project): ProjectStats {
  const assets = listProjectAssets(project);
  const svgCount = assets.filter((a) => !!a.svg).length;

  const withMetadata = project.collections.filter((c) => c.collection.assets.some((a) => a.type === 'metadata')).length;
  const metadataStatus: MetadataStatus =
    project.collections.length === 0
      ? 'missing'
      : withMetadata === project.collections.length
        ? 'complete'
        : withMetadata > 0
          ? 'partial'
          : 'missing';

  const exportStatus: ExportStatusLabel = project.exportHistory.length > 0 ? 'exported' : 'never';

  const allStatuses = project.collections.flatMap((c) => STOCK_SITES.map((s) => c.uploadStatus[s.id] ?? 'pending'));
  const uploadStatus: UploadStatusSummary =
    project.collections.length === 0
      ? 'noCollections'
      : allStatuses.every((s) => s === 'ready' || s === 'uploaded')
        ? 'allReady'
        : allStatuses.some((s) => s === 'ready' || s === 'uploaded' || s === 'rejected')
          ? 'inProgress'
          : 'notStarted';

  return {
    collectionsCount: project.collections.length,
    assetsCount: assets.length,
    svgCount,
    metadataStatus,
    exportStatus,
    uploadStatus,
  };
}
