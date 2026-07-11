import type { TileData } from '../engine/types';
import { generateMarketplaceSeo, type MarketplaceSeo } from './marketplaceSeo';
import { validateMarketplaceSeo, type ValidationIssue } from './marketplaceValidation';
import { MARKETPLACE_PROFILES, type MarketplaceId } from './marketplaceProfiles';

// Export Package — the marketplace-specific "download package" spec asks
// for: SVG, Preview, title.txt, description.txt, keywords.txt,
// filename.txt, metadata.json. This module builds the text/JSON pieces
// (pure, DOM-free, unit-testable); the SVG and rasterized PNG preview are
// added one layer up wherever a zip is actually assembled (App.tsx, same
// as every other raster/zip export in this app — svgExporter.ts's
// `buildSingleTileSvg` and the existing `rasterizeSvgToPngBlob` are reused
// as-is, nothing new needed there).

export interface PackageTextFile {
  name: string;
  content: string;
}

/** The text/JSON files for one marketplace's export package, built from an
 * already-resolved `MarketplaceSeo` — used whenever the caller has (or
 * might have) user-edited title/description/keywords, e.g. the Marketplace
 * Profile Selector's own overrides: regenerating from scratch here would
 * silently discard those edits right before download. */
export function buildPackageTextFilesFromSeo(tileData: TileData, marketplaceId: MarketplaceId, seo: MarketplaceSeo): PackageTextFile[] {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const issues = validateMarketplaceSeo(seo, profile);

  const files: PackageTextFile[] = [{ name: 'title.txt', content: seo.title }];
  if (profile.descriptionRules.required || seo.description) {
    files.push({ name: 'description.txt', content: seo.description });
  }
  files.push({ name: 'keywords.txt', content: seo.keywords.join(', ') });
  files.push({ name: 'filename.txt', content: seo.filename });
  files.push({ name: 'metadata.json', content: buildMetadataJson(tileData, marketplaceId, seo, issues) });
  return files;
}

/** Convenience wrapper for the common case (no user edits yet): generates
 * the SEO fresh, then builds the same file set. */
export function buildMarketplacePackageTextFiles(
  tileData: TileData,
  marketplaceId: MarketplaceId,
  customFilenameTemplate?: string,
): PackageTextFile[] {
  const seo = generateMarketplaceSeo(tileData, marketplaceId, customFilenameTemplate);
  return buildPackageTextFilesFromSeo(tileData, marketplaceId, seo);
}

/** Section 7, "Marketplace Package Profile" — describes what a complete
 * export package for this marketplace must contain, structured for a
 * future export engine to consume (per the brief's explicit "prepare
 * metadata, do not implement export yet"). Every field is read straight
 * off the marketplace's own real profile, nothing new is decided here. */
export interface MarketplacePackageProfile {
  marketplaceId: MarketplaceId;
  label: string;
  requiredFiles: string[];
  supportedFileTypes: string[];
  primaryFormat: 'svg' | 'eps';
  previewRequirements: { minWidth: number; minHeight: number; format: string; notes: string };
}

export function buildMarketplacePackageProfile(marketplaceId: MarketplaceId): MarketplacePackageProfile {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  return {
    marketplaceId,
    label: profile.label,
    requiredFiles: profile.exportPackageFiles,
    supportedFileTypes: profile.supportedFileTypes,
    primaryFormat: profile.filenameRules.extension,
    previewRequirements: profile.previewRequirements,
  };
}

function buildMetadataJson(tileData: TileData, marketplaceId: MarketplaceId, seo: MarketplaceSeo, issues: ValidationIssue[]): string {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  return JSON.stringify(
    {
      marketplace: marketplaceId,
      marketplaceLabel: profile.label,
      generatedAt: new Date().toISOString(),
      seed: tileData.params.seed,
      category: tileData.params.categoryId,
      palette: tileData.params.paletteId,
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      filename: seo.filename,
      defaultCategory: profile.defaultCategory,
      validation: { ready: issues.every((i) => i.severity !== 'error'), issues },
    },
    null,
    2,
  );
}
