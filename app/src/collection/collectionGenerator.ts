import type { GenerateParams, LayoutId } from '../engine/types';
import { buildTile } from '../engine/tile';
import { createRng } from '../engine/rng';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { LAYOUT_LIST } from '../layouts';
import { deriveSeed } from '../engine/candidateEngine';
import { generateMotifSet, buildMotifSheet, type FactoryMotif, type MotifFamily, familyForCategory } from '../engine/motifFactory';
import { buildBorderStrip, buildCornerUnit, type BorderEdge, type CornerId } from '../engine/borderCornerAssets';
import { buildSvgDocument } from '../export/svgExporter';
import { buildSiteMetadata, buildSeoTextFile, type SiteMetadata } from '../metadata/shutterstock';
import { buildShutterstockCsv, buildAdobeStockCsv } from '../metadata/csv';
import type { SavedItem } from '../components/SavedPanel';
import { resolveStyleDna, type StyleDna } from '../engine/styleDna';

// Professional Asset Factory Engine (PAF) — the Collection Generator. Turns
// one design concept (the current GenerateParams, optionally with an
// active Style DNA) into a full commercial asset package: 5 pattern
// variants sharing the same category/palette/style identity, border/corner
// assets built from a shared Motif Factory family, 4 motif sheets, PNG-
// preview-ready hero data, per-site metadata + SEO CSVs, and a Collection
// Manifest describing every asset/motif and the relationships between them.
//
// This module is deliberately DOM-free (no <canvas>, no download/zip
// calls) so the whole pipeline is unit-testable the same way every other
// engine module is — PNG rasterization and ZIP packaging happen one layer
// up, in App.tsx, exactly like every other raster/zip export in this app.

export const COLLECTION_SCHEMA_VERSION = 1;

export type AssetType =
  | 'heroPattern'
  | 'secondaryPattern'
  | 'coordinatePattern'
  | 'miniPattern'
  | 'stripePattern'
  | 'borderPattern'
  | 'cornerPattern'
  | 'spotMotifSheet'
  | 'singleMotifLibrary'
  | 'backgroundElements'
  | 'decorativeIcons'
  | 'metadata'
  | 'seoPackage';

export interface CollectionAsset {
  id: string;
  type: AssetType;
  label: string;
  filename: string;
  /** Full standalone SVG document string — present for every svg-based
   * asset type (everything except metadata/seoPackage, which carry `data`
   * instead). */
  svg?: string;
  /** Structured payload for the two non-SVG asset types. */
  data?: unknown;
  motifIds: string[];
  width?: number;
  height?: number;
}

export interface ManifestMotif {
  id: string;
  family: MotifFamily;
  role: string;
  category: string;
  complexity: number;
  tags: string[];
}

export interface CollectionConsistency {
  consistent: boolean;
  issues: string[];
}

export interface CollectionManifest {
  schemaVersion: number;
  collectionId: string;
  collectionName: string;
  createdAt: number;
  styleDnaId?: string;
  seed: string;
  palette: { id: string; colors: string[] };
  motifFamily: MotifFamily;
  assets: Array<{ id: string; type: AssetType; label: string; filename: string; motifIds: string[] }>;
  motifs: ManifestMotif[];
  relationships: Array<{ assetId: string; motifId: string }>;
  consistency: CollectionConsistency;
}

export interface GeneratedCollection {
  manifest: CollectionManifest;
  assets: CollectionAsset[];
  motifs: FactoryMotif[];
}

/** A different layout from `baseParams.layoutId` for the Secondary Pattern
 * to pair with — prefers a Style DNA's own alternate family member (re-
 * resolved from a distinct derived seed, so it may genuinely differ from
 * whichever layout the hero pattern picked) and otherwise falls back to
 * the next real layout in the registry, deterministically, so the same
 * base seed always pairs the same two layouts. */
function pickSecondaryLayout(baseParams: GenerateParams, styleDna: StyleDna | undefined, baseSeed: string): LayoutId {
  if (styleDna) {
    return resolveStyleDna(styleDna, deriveSeed(baseSeed, 'paf-secondary-style', 0)).layoutId;
  }
  const idx = LAYOUT_LIST.findIndex((l) => l.id === baseParams.layoutId);
  const next = LAYOUT_LIST[(idx + 1) % LAYOUT_LIST.length];
  return next.id;
}

/** Checks the collection's real assembled data for internal consistency —
 * a lightweight, real Designer-Assistant-style verification (not a full
 * Phase 8 engine, which doesn't exist yet — see the Style DNA milestone's
 * scope note for the same precedent) that would genuinely catch a real
 * bug: if any pattern-type asset's palette/style/category ever drifted
 * from the rest, this reports it instead of silently shipping a broken
 * "collection". */
export function verifyConsistency(patternParams: GenerateParams[]): CollectionConsistency {
  const issues: string[] = [];
  const paletteIds = new Set(patternParams.map((p) => p.paletteId));
  if (paletteIds.size > 1) issues.push(`palette differs across pattern assets: ${[...paletteIds].join(', ')}`);
  const styleIds = new Set(patternParams.map((p) => p.styleDnaId ?? 'none'));
  if (styleIds.size > 1) issues.push(`Style DNA differs across pattern assets: ${[...styleIds].join(', ')}`);
  const categoryIds = new Set(patternParams.map((p) => p.categoryId));
  if (categoryIds.size > 1) issues.push(`motif family (category) differs across pattern assets: ${[...categoryIds].join(', ')}`);
  return { consistent: issues.length === 0, issues };
}

export function generateCollection(baseParams: GenerateParams, styleDna?: StyleDna): GeneratedCollection {
  const baseSeed = baseParams.seed;
  const collectionId = `collection-${baseSeed}`;

  // 1. Five pattern-type assets, all sharing category/palette/Style DNA —
  // only layout/density/hierarchy/scale vary, each real buildTile output
  // with its own deterministic derived seed.
  const heroTile = buildTile({ ...baseParams, seed: deriveSeed(baseSeed, 'paf-hero', 0) });

  const secondaryLayout = pickSecondaryLayout(baseParams, styleDna, baseSeed);
  const secondaryTile = buildTile({
    ...baseParams,
    layoutId: secondaryLayout,
    hierarchy: HIERARCHY_PRESETS.denseLayered.value,
    seed: deriveSeed(baseSeed, 'paf-secondary', 0),
  });

  const coordinateTile = buildTile({
    ...baseParams,
    layoutId: 'scatter',
    density: Math.max(0.15, baseParams.density * 0.7),
    negativeSpace: Math.min(1, (baseParams.negativeSpace ?? 0) + 0.2),
    hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
    seed: deriveSeed(baseSeed, 'paf-coordinate', 0),
  });

  const miniTileSize = Math.max(400, Math.round((baseParams.tileSize * 0.5) / 100) * 100);
  const miniTile = buildTile({
    ...baseParams,
    tileSize: miniTileSize,
    motifSize: baseParams.motifSize * 0.55,
    density: Math.min(1, baseParams.density * 1.25),
    seed: deriveSeed(baseSeed, 'paf-mini', 0),
  });

  const stripeTile = buildTile({ ...baseParams, layoutId: 'stripe', seed: deriveSeed(baseSeed, 'paf-stripe', 0) });

  const patternTiles = [heroTile, secondaryTile, coordinateTile, miniTile, stripeTile];

  // 2. Motif Factory sets — independent motifs from the same category,
  // tagged by role, feeding the border/corner/sheet assets below.
  const borderMotifs = generateMotifSet(baseParams, { count: 4, role: 'accent', baseSeed: deriveSeed(baseSeed, 'paf-border-motifs', 0), sizeMul: 0.6 });
  const cornerMotifs = generateMotifSet(baseParams, { count: 4, role: 'accent', baseSeed: deriveSeed(baseSeed, 'paf-corner-motifs', 0), sizeMul: 0.6 });
  const spotMotifs = generateMotifSet(baseParams, { count: 12, role: 'hero', baseSeed: deriveSeed(baseSeed, 'paf-spot', 0) });
  const libraryMotifs = generateMotifSet(baseParams, { count: 16, role: 'secondary', baseSeed: deriveSeed(baseSeed, 'paf-library', 0) });
  const backgroundMotifs = generateMotifSet(baseParams, { count: 10, role: 'background', baseSeed: deriveSeed(baseSeed, 'paf-background', 0), sizeMul: 0.5 });
  const iconMotifs = generateMotifSet(baseParams, { count: 10, role: 'icon', baseSeed: deriveSeed(baseSeed, 'paf-icons', 0), sizeMul: 0.35 });
  const allMotifs = [...borderMotifs, ...cornerMotifs, ...spotMotifs, ...libraryMotifs, ...backgroundMotifs, ...iconMotifs];

  // 3. Border (4 edges) + Corner (4 corners) assets.
  const bandSize = Math.round(baseParams.tileSize * 0.18);
  const edges: BorderEdge[] = ['top', 'bottom', 'left', 'right'];
  const borderBuilds = edges.map((edge, i) =>
    buildBorderStrip({
      edge,
      length: baseParams.tileSize,
      band: bandSize,
      motifs: borderMotifs,
      rng: createRng(deriveSeed(baseSeed, 'paf-border-place', i)),
      backgroundColor: heroTile.backgroundColor,
      count: 8,
    }),
  );
  const corners: CornerId[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const cornerBuilds = corners.map((corner, i) =>
    buildCornerUnit({
      corner,
      band: bandSize,
      motifs: cornerMotifs,
      rng: createRng(deriveSeed(baseSeed, 'paf-corner-place', i)),
      backgroundColor: heroTile.backgroundColor,
      count: 6,
    }),
  );

  // 4. Isolated-motif sheets (transparent background, SVG only).
  const spotSheet = buildMotifSheet(spotMotifs, { cols: 4, cellSize: 220, padding: 20, idPrefix: 'spot' });
  const librarySheet = buildMotifSheet(libraryMotifs, { cols: 4, cellSize: 200, padding: 18, idPrefix: 'lib' });
  const backgroundSheet = buildMotifSheet(backgroundMotifs, { cols: 5, cellSize: 140, padding: 14, idPrefix: 'bg' });
  const iconSheet = buildMotifSheet(iconMotifs, { cols: 5, cellSize: 110, padding: 12, idPrefix: 'icon' });

  // 5. Metadata + SEO Package — 100% reuse of the existing per-site
  // metadata builders (metadata/shutterstock.ts, metadata/csv.ts), applied
  // to the hero pattern for per-site fields and to all 5 pattern assets
  // for the batch-upload CSVs.
  const siteMetadata: SiteMetadata[] = buildSiteMetadata(heroTile);
  const seoText = buildSeoTextFile(heroTile);
  const csvItems: SavedItem[] = patternTiles.map((t, i) => ({
    id: `${collectionId}-csv-${i}`,
    tileData: t,
    name: `${collectionId}-${['hero', 'secondary', 'coordinate', 'mini', 'stripe'][i]}`,
    createdAt: Date.now(),
    note: '',
    submissions: {},
  }));
  const shutterstockCsv = buildShutterstockCsv(csvItems, (item) => `${item.name}.eps`);
  const adobeStockCsv = buildAdobeStockCsv(csvItems, (item) => `${item.name}.eps`);

  // 6. Assemble CollectionAsset[].
  const assets: CollectionAsset[] = [
    { id: 'hero', type: 'heroPattern', label: 'Hero Pattern', filename: `${collectionId}-hero.svg`, svg: buildSvgDocument(heroTile.svg, 3000, 3000, heroTile.params.tileSize, heroTile.params.tileSize), motifIds: [] },
    { id: 'secondary', type: 'secondaryPattern', label: 'Secondary Pattern', filename: `${collectionId}-secondary.svg`, svg: buildSvgDocument(secondaryTile.svg, 3000, 3000, secondaryTile.params.tileSize, secondaryTile.params.tileSize), motifIds: [] },
    { id: 'coordinate', type: 'coordinatePattern', label: 'Coordinate Pattern', filename: `${collectionId}-coordinate.svg`, svg: buildSvgDocument(coordinateTile.svg, 3000, 3000, coordinateTile.params.tileSize, coordinateTile.params.tileSize), motifIds: [] },
    { id: 'mini', type: 'miniPattern', label: 'Mini Pattern', filename: `${collectionId}-mini.svg`, svg: buildSvgDocument(miniTile.svg, 3000, 3000, miniTile.params.tileSize, miniTile.params.tileSize), motifIds: [] },
    { id: 'stripe', type: 'stripePattern', label: 'Stripe Pattern', filename: `${collectionId}-stripe.svg`, svg: buildSvgDocument(stripeTile.svg, 3000, 3000, stripeTile.params.tileSize, stripeTile.params.tileSize), motifIds: [] },
    ...edges.map((edge, i) => ({
      id: `border-${edge}`,
      type: 'borderPattern' as const,
      label: `Border Pattern (${edge})`,
      filename: `${collectionId}-border-${edge}.svg`,
      svg: buildSvgDocument(borderBuilds[i].svg, borderBuilds[i].width, borderBuilds[i].height),
      motifIds: borderMotifs.map((m) => m.id),
      width: borderBuilds[i].width,
      height: borderBuilds[i].height,
    })),
    ...corners.map((corner, i) => ({
      id: `corner-${corner}`,
      type: 'cornerPattern' as const,
      label: `Corner Pattern (${corner})`,
      filename: `${collectionId}-corner-${corner}.svg`,
      svg: buildSvgDocument(cornerBuilds[i].svg, cornerBuilds[i].width, cornerBuilds[i].height),
      motifIds: cornerMotifs.map((m) => m.id),
      width: cornerBuilds[i].width,
      height: cornerBuilds[i].height,
    })),
    { id: 'spot-sheet', type: 'spotMotifSheet', label: 'Spot Motif Sheet', filename: `${collectionId}-spot-motif-sheet.svg`, svg: buildSvgDocument(spotSheet.svg, spotSheet.width, spotSheet.height), motifIds: spotMotifs.map((m) => m.id), width: spotSheet.width, height: spotSheet.height },
    { id: 'motif-library', type: 'singleMotifLibrary', label: 'Single Motif Library', filename: `${collectionId}-motif-library.svg`, svg: buildSvgDocument(librarySheet.svg, librarySheet.width, librarySheet.height), motifIds: libraryMotifs.map((m) => m.id), width: librarySheet.width, height: librarySheet.height },
    { id: 'background-elements', type: 'backgroundElements', label: 'Background Elements', filename: `${collectionId}-background-elements.svg`, svg: buildSvgDocument(backgroundSheet.svg, backgroundSheet.width, backgroundSheet.height), motifIds: backgroundMotifs.map((m) => m.id), width: backgroundSheet.width, height: backgroundSheet.height },
    { id: 'decorative-icons', type: 'decorativeIcons', label: 'Decorative Icons', filename: `${collectionId}-decorative-icons.svg`, svg: buildSvgDocument(iconSheet.svg, iconSheet.width, iconSheet.height), motifIds: iconMotifs.map((m) => m.id), width: iconSheet.width, height: iconSheet.height },
    { id: 'metadata', type: 'metadata', label: 'Metadata', filename: `${collectionId}-metadata.json`, data: { siteMetadata, seoText }, motifIds: [] },
    { id: 'seo-package', type: 'seoPackage', label: 'SEO Package', filename: `${collectionId}-seo-package.json`, data: { shutterstockCsv, adobeStockCsv, sites: siteMetadata.map((s) => s.id) }, motifIds: [] },
  ];

  // 7. Manifest — assets, motifs, explicit relationships, consistency check.
  const relationships = assets.flatMap((a) => a.motifIds.map((motifId) => ({ assetId: a.id, motifId })));
  const consistency = verifyConsistency(patternTiles.map((t) => t.params));

  const manifest: CollectionManifest = {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    collectionId,
    collectionName: `${familyForCategory(baseParams.categoryId)} collection — ${baseParams.categoryId}`,
    createdAt: Date.now(),
    styleDnaId: baseParams.styleDnaId,
    seed: baseSeed,
    palette: { id: baseParams.paletteId, colors: heroTile.colors },
    motifFamily: familyForCategory(baseParams.categoryId),
    assets: assets.map((a) => ({ id: a.id, type: a.type, label: a.label, filename: a.filename, motifIds: a.motifIds })),
    motifs: allMotifs.map((m) => ({ id: m.id, family: m.family, role: m.role, category: m.category, complexity: m.complexity, tags: m.tags })),
    relationships,
    consistency,
  };

  return { manifest, assets, motifs: allMotifs };
}
