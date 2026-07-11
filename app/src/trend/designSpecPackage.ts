import type { TileData } from '../engine/types';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { buildPackageTextFilesFromSeo, type PackageTextFile } from '../metadata/exportPackage';
import { buildDesignSpecSeo, type DesignSpecSeo } from './designSpecSeo';
import type { DesignSpecification } from './designSpecTypes';

// Marketplace Package (Section 10) — "For every marketplace generate SVG,
// PNG Preview, SEO, Filename, Metadata, Manifest, ZIP." Reuses the
// *existing* metadata/exportPackage.ts's `buildPackageTextFilesFromSeo`
// for the standard title/description/keywords/filename/metadata.json set
// (no duplicated package-building logic — the same "SEO Engine builds on
// the existing Marketplace Profile System" precedent this whole Trend
// Intelligence Studio milestone has followed) and adds the one file this
// Design-Spec-driven flow specifically needs on top: `manifest.json`,
// tying the package back to the Project/Trend Pack/Keyword Bundle that
// produced it. SVG and the rasterized PNG preview (and the ZIP itself)
// are added one layer up wherever a zip is actually assembled (App.tsx),
// the same DOM-free-engine-layer convention every other export in this
// app follows — this module stays pure/unit-testable.

export const DESIGN_SPEC_PACKAGE_SCHEMA_VERSION = 1;

export interface DesignSpecManifest {
  schemaVersion: number;
  generatedAt: string;
  seed: string;
  marketplace: MarketplaceId;
  project: { id: string; name: string };
  trend: { trendPackId: string; theme: string; mood: string } | null;
  keywordBundle: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    season: string;
    audience: string;
    commercialCategory: string;
  };
  collectionName: string;
  assetName: string;
  /** Every file this marketplace's complete package contains — the text/
   * JSON files this module builds, plus `pattern.svg`/`preview.png`
   * (added one layer up), so the manifest documents the *actual* zip
   * contents even though this module never touches the SVG/PNG itself. */
  files: string[];
}

function buildManifest(
  spec: DesignSpecification,
  seed: string,
  marketplaceId: MarketplaceId,
  seo: DesignSpecSeo,
  files: string[],
): DesignSpecManifest {
  return {
    schemaVersion: DESIGN_SPEC_PACKAGE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    seed,
    marketplace: marketplaceId,
    project: { id: spec.project.id, name: spec.project.name },
    trend: spec.trend,
    keywordBundle: {
      primaryKeyword: spec.seoHints.primaryKeyword,
      secondaryKeywords: spec.seoHints.secondaryKeywords,
      season: spec.seoHints.season,
      audience: spec.seoHints.audience,
      commercialCategory: spec.seoHints.commercialCategory,
    },
    collectionName: seo.collectionName,
    assetName: seo.assetName,
    files,
  };
}

/** Builds one marketplace's complete Marketplace Package text/JSON files
 * directly from a Design Specification — title.txt/description.txt/
 * keywords.txt/filename.txt/metadata.json (via the existing, unmodified
 * `buildPackageTextFilesFromSeo`) plus manifest.json. `seed` is a separate
 * argument (not read from the spec) matching `designSpecToParams.ts`'s
 * `buildTileFromDesignSpec` convention — the caller passes the same seed
 * used to build `tileData` so the manifest accurately records it. */
export function buildDesignSpecPackageTextFiles(
  spec: DesignSpecification,
  tileData: TileData,
  marketplaceId: MarketplaceId,
  seed: string,
  assetLabel = 'Hero Pattern',
  customFilenameTemplate?: string,
): PackageTextFile[] {
  const seo = buildDesignSpecSeo(spec, tileData, marketplaceId, assetLabel, customFilenameTemplate);
  const baseFiles = buildPackageTextFilesFromSeo(tileData, marketplaceId, seo);
  const files = [...baseFiles.map((f) => f.name), 'pattern.svg', 'preview.png', 'manifest.json'];
  const manifest = buildManifest(spec, seed, marketplaceId, seo, files);
  return [...baseFiles, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }];
}

/** Every marketplace's Design-Spec-driven package text files in one call
 * — Section 10's "for every marketplace generate..." requirement, mirroring
 * `designSpecSeo.ts`'s `buildAllDesignSpecSeo`. */
export function buildAllDesignSpecPackageTextFiles(
  spec: DesignSpecification,
  tileData: TileData,
  seed: string,
  assetLabel = 'Hero Pattern',
): Record<MarketplaceId, PackageTextFile[]> {
  const result = {} as Record<MarketplaceId, PackageTextFile[]>;
  for (const marketplaceId of Object.keys(MARKETPLACE_PROFILES) as MarketplaceId[]) {
    result[marketplaceId] = buildDesignSpecPackageTextFiles(spec, tileData, marketplaceId, seed, assetLabel);
  }
  return result;
}
