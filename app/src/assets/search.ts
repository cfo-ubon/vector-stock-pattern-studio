import type { Asset, AssetSearchQuery } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 5 "Smart Search". Every
// filter reads a real field already on `AssetMetadata` (Section 2) —
// nothing here re-derives or guesses a property the metadata doesn't
// already carry.

function matchesKeyword(asset: Asset, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = [asset.metadata.name, asset.metadata.categoryId, asset.metadata.kind, asset.metadata.family, ...asset.metadata.patternTypes].join(' ').toLowerCase();
  return haystack.includes(needle);
}

/** Filters an asset pool by any combination of Section 5's named facets —
 * every unset field in `query` is simply not checked. */
export function searchAssets(assets: Asset[], query: AssetSearchQuery): Asset[] {
  return assets.filter((asset) => {
    if (query.keyword !== undefined && !matchesKeyword(asset, query.keyword)) return false;
    if (query.family !== undefined && asset.metadata.family !== query.family) return false;
    if (query.kind !== undefined && asset.metadata.kind !== query.kind) return false;
    if (query.styleDnaId !== undefined && asset.metadata.styleDnaId !== query.styleDnaId) return false;
    if (query.marketplaceId !== undefined && !asset.metadata.compatibility.marketplaces.includes(query.marketplaceId)) return false;
    if (query.color !== undefined && !asset.metadata.colorRoles.some((c) => c.toLowerCase() === query.color!.toLowerCase())) return false;
    if (query.patternType !== undefined && !asset.metadata.patternTypes.includes(query.patternType)) return false;
    if (query.complexityMin !== undefined && asset.metadata.complexity < query.complexityMin) return false;
    if (query.complexityMax !== undefined && asset.metadata.complexity > query.complexityMax) return false;
    return true;
  });
}
