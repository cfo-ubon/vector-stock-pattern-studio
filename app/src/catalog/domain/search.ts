import type { PortfolioAsset, SourceFileRole, WorkflowStatus } from './types';
import { totalFileSize } from './asset';

// Sprint P1, Section 8 (Search and Filters). Same convention as
// `assets/search.ts`/`workbench/globalSearch.ts` — a synchronous
// `.filter()` chain over an already-loaded in-memory array, every clause
// optional-and-AND'd, no search index (nothing in this codebase indexes
// anything; a P1 catalog is not yet at the scale where that would pay
// for itself — see `docs/portfolio/PORTFOLIO_MANAGER_ARCHITECTURE.md`
// for the explicit call on this).

export interface PortfolioFilterQuery {
  keyword?: string;
  workflowStatus?: WorkflowStatus[];
  archived?: 'active' | 'archived' | 'all';
  assetType?: SourceFileRole[];
  ratingMin?: number;
  generatorVersion?: string;
  importedAfter?: number;
  importedBefore?: number;
  createdAfter?: number;
  createdBefore?: number;
  missingPreview?: boolean;
  missingSvg?: boolean;
  missingJson?: boolean;
  /** Asset IDs flagged by a duplicate scan (see `services/healthCheck.ts`)
   * — passed in rather than recomputed here, since duplicate detection is
   * a whole-catalog operation, not a per-asset predicate. */
  duplicateAssetIds?: ReadonlySet<string>;
  onlyDuplicates?: boolean;
}

function matchesKeyword(asset: PortfolioAsset, keyword: string): boolean {
  const haystack = [
    asset.assetId,
    asset.displayName,
    asset.originalFilename,
    ...asset.tags,
    asset.styleDna ?? '',
    asset.presetId ?? '',
    asset.compositionType ?? '',
    asset.patternType ?? '',
    asset.notes,
    asset.generatorVersion ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

export function searchPortfolioAssets(assets: PortfolioAsset[], query: PortfolioFilterQuery): PortfolioAsset[] {
  return assets.filter((asset) => {
    if (query.keyword && query.keyword.trim() && !matchesKeyword(asset, query.keyword.trim())) return false;
    if (query.workflowStatus && query.workflowStatus.length > 0 && !query.workflowStatus.includes(asset.workflowStatus)) return false;

    const archived = query.archived ?? 'active';
    if (archived === 'active' && asset.isArchived) return false;
    if (archived === 'archived' && !asset.isArchived) return false;

    if (query.assetType && query.assetType.length > 0 && !query.assetType.includes(asset.assetType)) return false;
    if (query.ratingMin !== undefined && asset.rating < query.ratingMin) return false;
    if (query.generatorVersion && asset.generatorVersion !== query.generatorVersion) return false;

    if (query.importedAfter !== undefined && asset.importedAt < query.importedAfter) return false;
    if (query.importedBefore !== undefined && asset.importedAt > query.importedBefore) return false;
    if (query.createdAfter !== undefined && asset.createdAt < query.createdAfter) return false;
    if (query.createdBefore !== undefined && asset.createdAt > query.createdBefore) return false;

    if (query.missingPreview && asset.previewReference !== null) return false;
    if (query.missingSvg && asset.sourceFileReferences.some((r) => r.role === 'svg')) return false;
    if (query.missingJson && asset.sourceFileReferences.some((r) => r.role === 'json')) return false;

    if (query.onlyDuplicates && !(query.duplicateAssetIds?.has(asset.assetId) ?? false)) return false;

    return true;
  });
}

export type PortfolioSortKey =
  | 'importedDesc'
  | 'importedAsc'
  | 'createdDesc'
  | 'createdAsc'
  | 'name'
  | 'rating'
  | 'workflowStatus'
  | 'fileSize';

const WORKFLOW_ORDER: Record<WorkflowStatus, number> = {
  DRAFT: 0,
  NEEDS_REVISION: 1,
  READY_FOR_REVIEW: 2,
  READY_TO_UPLOAD: 3,
  SUBMITTED: 4,
  APPROVED: 5,
  REJECTED: 6,
};

export function sortPortfolioAssets(assets: PortfolioAsset[], sortKey: PortfolioSortKey): PortfolioAsset[] {
  const sorted = [...assets];
  switch (sortKey) {
    case 'importedDesc':
      return sorted.sort((a, b) => b.importedAt - a.importedAt);
    case 'importedAsc':
      return sorted.sort((a, b) => a.importedAt - b.importedAt);
    case 'createdDesc':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'createdAsc':
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case 'name':
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'workflowStatus':
      return sorted.sort((a, b) => WORKFLOW_ORDER[a.workflowStatus] - WORKFLOW_ORDER[b.workflowStatus]);
    case 'fileSize':
      return sorted.sort((a, b) => totalFileSize(b) - totalFileSize(a));
    default:
      return sorted;
  }
}

/** A short, human-readable summary of which filters are currently active
 * — Section 8: "Show result count and an active-filter summary." */
export function describeActiveFilters(query: PortfolioFilterQuery): string[] {
  const parts: string[] = [];
  if (query.keyword?.trim()) parts.push(`"${query.keyword.trim()}"`);
  if (query.workflowStatus && query.workflowStatus.length > 0) parts.push(`status: ${query.workflowStatus.join(', ')}`);
  if (query.archived === 'archived') parts.push('archived only');
  if (query.archived === 'all') parts.push('including archived');
  if (query.assetType && query.assetType.length > 0) parts.push(`type: ${query.assetType.join(', ')}`);
  if (query.ratingMin !== undefined) parts.push(`rating >= ${query.ratingMin}`);
  if (query.generatorVersion) parts.push(`generator ${query.generatorVersion}`);
  if (query.missingPreview) parts.push('missing preview');
  if (query.missingSvg) parts.push('missing SVG');
  if (query.missingJson) parts.push('missing JSON');
  if (query.onlyDuplicates) parts.push('duplicate warnings only');
  return parts;
}
