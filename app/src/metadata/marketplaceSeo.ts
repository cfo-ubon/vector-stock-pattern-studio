import type { TileData } from '../engine/types';
import { buildSiteMetadata } from './shutterstock';
import { MARKETPLACE_PROFILES, type MarketplaceId, type MarketplaceProfile } from './marketplaceProfiles';
import { buildMarketplaceFilename } from './filenameEngine';

// Marketplace SEO generator — the "select a marketplace, instantly get a
// complete Title/Description/Keywords/Filename" step the UI needs. Doesn't
// regenerate title/description/keyword *text*: that stays owned by
// shutterstock.ts's `buildSiteMetadata` (the single source of truth for
// per-site copy, already marketplace-differentiated since v1.9). This
// module reshapes that same output into one flat, marketplace-specific
// result and attaches the Filename Engine's output — the piece
// `buildSiteMetadata` never had, since a filename isn't a "field" any
// stock site's own upload form shows.

export interface MarketplaceSeo {
  marketplaceId: MarketplaceId;
  title: string;
  /** Empty string for a marketplace with no description field
   * (`descriptionRules.required === false` and no Description field in
   * buildSiteMetadata, e.g. Adobe Stock/Freepik) rather than undefined —
   * callers can render an empty textarea without a null check. */
  description: string;
  keywords: string[];
  filename: string;
}

function titleField(fields: { label: string; value: string }[]): string {
  return fields.find((f) => f.label === 'Title' || f.label === 'Product Name')?.value ?? '';
}

function descriptionField(fields: { label: string; value: string }[]): string {
  return fields.find((f) => f.label === 'Description')?.value ?? '';
}

function keywordsField(fields: { label: string; value: string }[]): string {
  return fields.find((f) => f.label === 'Keywords' || f.label === 'Keywords / Tags' || f.label === 'Tags')?.value ?? '';
}

/** Generates one marketplace's complete SEO package for a pattern —
 * Title/Description/Keywords/Filename — in one call, exactly what the
 * Marketplace Profile Selector needs the moment the user picks a
 * marketplace. `customFilenameTemplate` threads through to the Filename
 * Engine for the "allow user customization" requirement. */
export function generateMarketplaceSeo(
  tileData: TileData,
  marketplaceId: MarketplaceId,
  customFilenameTemplate?: string,
): MarketplaceSeo {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const site = buildSiteMetadata(tileData).find((s) => s.id === marketplaceId);
  const fields = site?.fields ?? [];
  const keywordsRaw = keywordsField(fields);
  return {
    marketplaceId,
    title: titleField(fields),
    description: descriptionField(fields),
    keywords: keywordsRaw
      ? keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean)
      : [],
    filename: buildMarketplaceFilename(tileData.params, profile, customFilenameTemplate),
  };
}

export function generateAllMarketplaceSeo(tileData: TileData): Record<MarketplaceId, MarketplaceSeo> {
  const result = {} as Record<MarketplaceId, MarketplaceSeo>;
  for (const profile of Object.values(MARKETPLACE_PROFILES) as MarketplaceProfile[]) {
    result[profile.id] = generateMarketplaceSeo(tileData, profile.id);
  }
  return result;
}
