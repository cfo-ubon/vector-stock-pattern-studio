import type { PortfolioAsset, SourceFileReference } from './types';
import { PORTFOLIO_ASSET_SCHEMA_VERSION, isWorkflowStatus } from './types';
import { generateAssetId } from './id';

export interface CreatePortfolioAssetInput {
  displayName: string;
  originalFilename: string;
  sourceFileReferences: SourceFileReference[];
  previewReference: string | null;
  metadataReference: string | null;
  createdAt?: number;
  generatorVersion?: string | null;
  styleDna?: string | null;
  presetId?: string | null;
  compositionType?: string | null;
  patternType?: string | null;
  generatorSeed?: string | null;
  productTargets?: string[];
  dimensions?: { width: number; height: number } | null;
  colorPalette?: string[];
  parentAssetId?: string | null;
  variationGroupId?: string | null;
  productionAssetId?: string | null;
  qualitySnapshotId?: string | null;
}

/** Determine an asset's dominant commercial type from its grouped source
 * files: a vector file (svg preferred, then eps/ai) always wins over a
 * raster preview or a bare JSON source, since that's the sellable file. */
export function pickAssetType(refs: SourceFileReference[]): SourceFileReference['role'] {
  const priority: SourceFileReference['role'][] = ['svg', 'eps', 'ai', 'png', 'jpg', 'json', 'preview', 'other'];
  for (const role of priority) {
    const found = refs.find((r) => r.role === role);
    if (found) return found.role;
  }
  return refs[0]?.role ?? 'other';
}

export function createPortfolioAsset(input: CreatePortfolioAssetInput): PortfolioAsset {
  const now = Date.now();
  const sourceHashes = input.sourceFileReferences.map((r) => r.sha256);
  const fileSizes: Record<string, number> = {};
  for (const ref of input.sourceFileReferences) fileSizes[ref.fileId] = ref.fileSize;

  return {
    assetId: generateAssetId(new Date(now)),
    displayName: input.displayName,
    originalFilename: input.originalFilename,
    assetType: pickAssetType(input.sourceFileReferences),
    createdAt: input.createdAt ?? now,
    importedAt: now,
    updatedAt: now,
    generatorVersion: input.generatorVersion ?? null,
    schemaVersion: PORTFOLIO_ASSET_SCHEMA_VERSION,
    styleDna: input.styleDna ?? null,
    presetId: input.presetId ?? null,
    compositionType: input.compositionType ?? null,
    patternType: input.patternType ?? null,
    generatorSeed: input.generatorSeed ?? null,
    productTargets: input.productTargets ?? [],
    collectionIds: [],
    tags: [],
    rating: 0,
    workflowStatus: 'DRAFT',
    isArchived: false,
    archivedAt: null,
    archiveReason: null,
    previewReference: input.previewReference,
    sourceFileReferences: input.sourceFileReferences,
    metadataReference: input.metadataReference,
    sourceHashes,
    fileSizes,
    dimensions: input.dimensions ?? null,
    colorPalette: input.colorPalette ?? [],
    notes: '',
    parentAssetId: input.parentAssetId ?? null,
    variationGroupId: input.variationGroupId ?? null,
    productionAssetId: input.productionAssetId ?? null,
    qualitySnapshotId: input.qualitySnapshotId ?? null,
  };
}

/** Defensive normalization for records loaded from storage — tolerates
 * partial/older shapes the same way `project/projectManager.ts`'s
 * `normalizeProject` does, so a future schema-version bump never crashes
 * on old records instead of migrating them. */
export function normalizePortfolioAsset(asset: PortfolioAsset): PortfolioAsset {
  return {
    ...asset,
    schemaVersion: asset.schemaVersion ?? PORTFOLIO_ASSET_SCHEMA_VERSION,
    productTargets: asset.productTargets ?? [],
    collectionIds: asset.collectionIds ?? [],
    tags: asset.tags ?? [],
    rating: asset.rating ?? 0,
    workflowStatus: isWorkflowStatus(asset.workflowStatus) ? asset.workflowStatus : 'DRAFT',
    isArchived: asset.isArchived ?? false,
    archivedAt: asset.archivedAt ?? null,
    archiveReason: asset.archiveReason ?? null,
    generatorSeed: asset.generatorSeed ?? null,
    sourceFileReferences: asset.sourceFileReferences ?? [],
    sourceHashes: asset.sourceHashes ?? [],
    fileSizes: asset.fileSizes ?? {},
    colorPalette: asset.colorPalette ?? [],
    notes: asset.notes ?? '',
    parentAssetId: asset.parentAssetId ?? null,
    variationGroupId: asset.variationGroupId ?? null,
    productionAssetId: asset.productionAssetId ?? null,
    qualitySnapshotId: asset.qualitySnapshotId ?? null,
  };
}

export function totalFileSize(asset: PortfolioAsset): number {
  return Object.values(asset.fileSizes).reduce((sum, n) => sum + n, 0);
}

export function isValidPortfolioAsset(value: unknown): value is PortfolioAsset {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<PortfolioAsset>;
  return (
    typeof a.assetId === 'string' &&
    typeof a.displayName === 'string' &&
    typeof a.originalFilename === 'string' &&
    typeof a.importedAt === 'number' &&
    Array.isArray(a.sourceFileReferences) &&
    isWorkflowStatus(a.workflowStatus)
  );
}
