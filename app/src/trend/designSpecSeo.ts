import type { TileData } from '../engine/types';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { truncateWords } from '../metadata/shutterstock';
import { buildMarketplaceFilename } from '../metadata/filenameEngine';
import { generateMarketplaceSeo, type MarketplaceSeo } from '../metadata/marketplaceSeo';
import type { DesignSpecification } from './designSpecTypes';

// SEO Engine (Section 9) — "Generate marketplace-specific Title,
// Description, Keywords, Filename, Collection Name, Asset Name using
// Marketplace Profiles." Deliberately does NOT re-implement per-site copy
// generation: metadata/shutterstock.ts's `buildSiteMetadata` (via
// `generateMarketplaceSeo`) stays the single source of truth for that.
// What this module adds is the piece neither of those knows about — the
// Design Specification's own market keywords (Section 2's Keyword Bundle,
// carried into `seoHints`) — blended into the generated copy so the
// result is genuinely market-driven rather than generic category text.

function slugifyKeyword(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Unlike the plain Marketplace Profile System's own default template
 * (`{palette}-{category}-{layout}-seamless-pattern-{seed}`, which has no
 * market-keyword placeholder at all), a Design-Spec-driven filename
 * defaults to leading with the primary keyword — a keyword-rich filename
 * is a real, well-known stock-marketplace SEO factor, and burying it
 * behind the generic default would defeat the whole point of this being
 * "market-driven". A caller-supplied `customFilenameTemplate` still wins,
 * same "allow user customization" precedent as the plain Filename Engine. */
const DEFAULT_DESIGN_SPEC_FILENAME_TEMPLATE = '{keyword}-{palette}-{category}-seamless-pattern-{seed}';

/** Front-loads the Design Spec's primary market keyword into a generated
 * title (marketplaces weight earlier words more heavily — the same fact
 * metadata/submissionCenter.ts's own UI copy documents) unless it's
 * already naturally present in the generated title. Stays within the
 * marketplace's own `titleRules.maxLength` by truncating the *generated*
 * portion at a word boundary — the keyword itself is never the part that
 * gets cut, since surfacing it is the whole point. */
export function blendKeywordIntoTitle(baseTitle: string, primaryKeyword: string, maxLength: number): string {
  const kw = primaryKeyword.trim();
  if (!kw) return baseTitle;
  if (baseTitle.toLowerCase().includes(kw.toLowerCase())) return baseTitle;
  const separator = ' — ';
  const budget = maxLength - kw.length - separator.length;
  if (budget <= 0) return truncateWords(kw, maxLength);
  return `${kw}${separator}${truncateWords(baseTitle, budget)}`;
}

/** Merges the Design Spec's primary + secondary keywords to the front of a
 * generated keyword list, deduped case-insensitively, trimmed to the
 * marketplace's own `keywordRules.maxCount` (and, where set, dropping any
 * keyword over `maxKeywordLength` — Etsy's 20-char tag cap). */
export function blendKeywordsIntoList(baseKeywords: string[], bundleKeywords: string[], maxCount: number, maxKeywordLength?: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...bundleKeywords, ...baseKeywords]) {
    const kw = raw.trim();
    if (!kw) continue;
    if (maxKeywordLength && kw.length > maxKeywordLength) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(kw);
    if (result.length >= maxCount) break;
  }
  return result;
}

/** Section 9's "Collection Name" — a human-readable display name (not a
 * filename), the primary keyword plus the matched Trend Pack's theme when
 * one is attached. */
export function buildDesignSpecCollectionName(spec: DesignSpecification): string {
  const theme = spec.trend?.theme;
  return theme ? `${spec.seoHints.primaryKeyword} — ${theme} Collection` : `${spec.seoHints.primaryKeyword} Collection`;
}

/** Section 9's "Asset Name" — one collection asset's own display name
 * (e.g. "Luxury Botanical Hero Pattern"). */
export function buildDesignSpecAssetName(spec: DesignSpecification, assetLabel: string): string {
  return `${spec.seoHints.primaryKeyword} ${assetLabel}`;
}

export interface DesignSpecSeo extends MarketplaceSeo {
  collectionName: string;
  assetName: string;
}

/** The Section 9 core: one marketplace's complete, market-driven SEO
 * package for a Design-Specification-generated tile — Title, Description,
 * Keywords, Filename, Collection Name, Asset Name, all resolved through
 * that marketplace's own Marketplace Profile rules. Pure/deterministic;
 * the caller supplies the already-generated `TileData` (from
 * `designSpecToParams.ts`'s `buildTileFromDesignSpec`) so this module
 * never re-derives generation output, only SEO copy. */
export function buildDesignSpecSeo(
  spec: DesignSpecification,
  tileData: TileData,
  marketplaceId: MarketplaceId,
  assetLabel = 'Hero Pattern',
  customFilenameTemplate?: string,
): DesignSpecSeo {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const generated = generateMarketplaceSeo(tileData, marketplaceId, customFilenameTemplate);

  const title = blendKeywordIntoTitle(generated.title, spec.seoHints.primaryKeyword, profile.titleRules.maxLength);

  const bundleKeywords = [spec.seoHints.primaryKeyword, ...spec.seoHints.secondaryKeywords];
  const keywords = blendKeywordsIntoList(generated.keywords, bundleKeywords, profile.keywordRules.maxCount, profile.keywordRules.maxKeywordLength);

  const description = generated.description
    ? truncateWords(
        `${generated.description} Perfect for ${spec.seoHints.commercialCategory} — ${spec.seoHints.audience} audience, ${spec.seoHints.season} collection.`,
        profile.descriptionRules.maxLength,
      )
    : generated.description;

  const filename = buildMarketplaceFilename(tileData.params, profile, customFilenameTemplate ?? DEFAULT_DESIGN_SPEC_FILENAME_TEMPLATE, {
    keyword: slugifyKeyword(spec.seoHints.primaryKeyword) || 'pattern',
  });

  return {
    ...generated,
    title,
    description,
    keywords,
    filename,
    collectionName: buildDesignSpecCollectionName(spec),
    assetName: buildDesignSpecAssetName(spec, assetLabel),
  };
}

/** Every marketplace's Design-Spec-driven SEO package in one call — the
 * Section 4/9 "Store SEO independently for every marketplace" requirement,
 * mirroring `metadata/marketplaceSeo.ts`'s existing `generateAllMarketplaceSeo`. */
export function buildAllDesignSpecSeo(spec: DesignSpecification, tileData: TileData, assetLabel = 'Hero Pattern'): Record<MarketplaceId, DesignSpecSeo> {
  const result = {} as Record<MarketplaceId, DesignSpecSeo>;
  for (const marketplaceId of Object.keys(MARKETPLACE_PROFILES) as MarketplaceId[]) {
    result[marketplaceId] = buildDesignSpecSeo(spec, tileData, marketplaceId, assetLabel);
  }
  return result;
}
