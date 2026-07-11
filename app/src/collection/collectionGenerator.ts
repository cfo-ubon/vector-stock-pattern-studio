import type { GenerateParams, LayoutId, SvgNode } from '../engine/types';
import { buildTile } from '../engine/tile';
import { createRng } from '../engine/rng';
import { h, round } from '../engine/svgAst';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { LAYOUT_LIST } from '../layouts';
import { deriveSeed } from '../engine/candidateEngine';
import { generateMotifSet, buildMotifSheet, type FactoryMotif, type MotifFamily, familyForCategory } from '../engine/motifFactory';
import { buildBorderStrip, buildCornerUnit, type BorderEdge, type CornerId } from '../engine/borderCornerAssets';
import { buildSvgDocument, namespaceIds } from '../export/svgExporter';
import { buildSiteMetadata, buildSeoTextFile, type SiteMetadata } from '../metadata/shutterstock';
import { buildShutterstockCsv, buildAdobeStockCsv } from '../metadata/csv';
import type { SavedItem } from '../components/SavedPanel';
import { resolveStyleDna, type StyleDna } from '../engine/styleDna';
import type { MarketplaceId } from '../metadata/marketplaceProfiles';

// Collection Studio Engine — v1.33 in-place evolution of the Professional
// Asset Factory Engine (v1.31, "PAF"). Same underlying idea (one Style DNA
// / seed drives every asset in a commercial collection) restructured to the
// leaner, renamed 10-asset shape the Collection Studio spec asks for: Hero/
// Secondary/Blender(renamed from "Coordinate")/Mini/Stripe patterns,
// Border/Corner assets, Spot Motif Sheet, one consolidated Decorative
// Elements Sheet (replaces v1.31's separate Background Elements +
// Decorative Icons + Single Motif Library sheets), and a new Collection
// Preview composite. Schema version bumped 1 -> 2 since this is a breaking
// asset-type rename/restructure, not an additive change.
//
// This module is deliberately DOM-free (no <canvas>, no download/zip
// calls) so the whole pipeline is unit-testable the same way every other
// engine module is — PNG rasterization and ZIP packaging happen one layer
// up, in App.tsx, exactly like every other raster/zip export in this app.

export const COLLECTION_SCHEMA_VERSION = 2;

export type AssetType =
  | 'heroPattern'
  | 'secondaryPattern'
  | 'blenderPattern'
  | 'miniPattern'
  | 'stripePattern'
  | 'borderPattern'
  | 'cornerPattern'
  | 'spotMotifSheet'
  | 'decorativeElementsSheet'
  | 'collectionPreview'
  | 'metadata'
  | 'seoPackage';

/** One marketplace's manually-edited SEO fields for a single asset —
 * intentionally separate from metadata/marketplaceSeo.ts's generated
 * `MarketplaceSeo` (which is always derived fresh from a TileData): this is
 * the *persisted override* layered on top, per the Marketplace Profile
 * System's "Project > Collection > Asset > SEO > {marketplace}" storage
 * requirement. Any field left undefined falls back to the generated
 * default wherever this is read. */
export interface AssetSeoOverride {
  title?: string;
  description?: string;
  keywords?: string[];
  filename?: string;
}

/** Per-marketplace SEO overrides for one asset. Optional/additive so
 * collections generated before this existed simply have no `seo` field —
 * every reader treats a missing marketplace entry as "use the generated
 * default", never as an error. */
export type AssetSeoStore = Partial<Record<MarketplaceId, AssetSeoOverride>>;

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
  /** Per-marketplace SEO overrides for this specific asset (see
   * `AssetSeoStore`). Absent on assets that have never had an override
   * saved. */
  seo?: AssetSeoStore;
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
  /** The resolved params behind each of the 5 pattern (tile) assets, in
   * Hero/Secondary/Blender/Mini/Stripe order — kept alongside the manifest
   * so collection/collectionScore.ts can compute richer consistency
   * scoring without re-deriving or re-parsing anything. */
  patternParams: GenerateParams[];
}

/** A different layout from `baseParams.layoutId` for the Secondary Pattern
 * to pair with — prefers a Style DNA's own alternate family member (re-
 * resolved from a distinct derived seed, so it may genuinely differ from
 * whichever layout the hero pattern picked) and otherwise falls back to
 * the next real layout in the registry, deterministically, so the same
 * base seed always pairs the same two layouts. */
function pickSecondaryLayout(baseParams: GenerateParams, styleDna: StyleDna | undefined, baseSeed: string): LayoutId {
  if (styleDna) {
    return resolveStyleDna(styleDna, deriveSeed(baseSeed, 'collection-secondary-style', 0)).layoutId;
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

/** Composite grid of scaled-down, non-destructive thumbnails of the
 * collection's other assets — the new "Collection Preview" asset. Each
 * source SvgNode keeps its own coordinate system (a pattern tile's viewBox
 * is its own tileSize, a sheet/strip's is its own width/height), so every
 * entry is uniformly scaled to fit its cell and id-namespaced (patterns
 * reuse fixed ids like "tile-clip" per tile.ts, which would collide once
 * several tiles share one document). Deliberately no embedded SVG text
 * labels: the SvgNode/SvgTag model has no text-content node type today,
 * and extending it is out of scope for this asset — labels are plain HTML
 * in the Collection Workspace UI instead, the same way Gallery/other
 * panels already label thumbnails outside the SVG itself. */
export function buildCollectionPreview(
  entries: Array<{ id: string; node: SvgNode; width: number; height: number }>,
  opts: { cols: number; cellSize: number; padding: number; backgroundColor: string },
): { svg: SvgNode; width: number; height: number } {
  const { cols, cellSize, padding, backgroundColor } = opts;
  const rows = Math.max(1, Math.ceil(entries.length / cols));
  const width = cols * cellSize;
  const height = rows * cellSize;
  const inner = cellSize - padding * 2;

  const cells = entries.map((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellSize;
    const cy = row * cellSize;
    const scale = Math.min(inner / entry.width, inner / entry.height);
    const offsetX = cx + padding + (inner - entry.width * scale) / 2;
    const offsetY = cy + padding + (inner - entry.height * scale) / 2;
    const namespaced = namespaceIds(entry.node, `preview-${entry.id}`);
    return h('g', { id: `preview-cell-${entry.id}` }, [
      h('rect', { x: round(cx + 1), y: round(cy + 1), width: round(cellSize - 2), height: round(cellSize - 2), fill: backgroundColor }),
      h('g', { transform: `translate(${round(offsetX)} ${round(offsetY)}) scale(${round(scale)})` }, [namespaced]),
    ]);
  });

  return { svg: h('g', { id: 'collection-preview' }, cells), width, height };
}

export function generateCollection(baseParams: GenerateParams, styleDna?: StyleDna, collectionNameOverride?: string): GeneratedCollection {
  const baseSeed = baseParams.seed;
  const collectionId = `collection-${baseSeed}`;

  // 1. Five pattern-type assets, all sharing category/palette/Style DNA —
  // only layout/density/hierarchy/scale vary, each real buildTile output
  // with its own deterministic derived seed.
  const heroTile = buildTile({ ...baseParams, seed: deriveSeed(baseSeed, 'collection-hero', 0) });

  const secondaryLayout = pickSecondaryLayout(baseParams, styleDna, baseSeed);
  const secondaryTile = buildTile({
    ...baseParams,
    layoutId: secondaryLayout,
    hierarchy: HIERARCHY_PRESETS.denseLayered.value,
    seed: deriveSeed(baseSeed, 'collection-secondary', 0),
  });

  const blenderTile = buildTile({
    ...baseParams,
    layoutId: 'scatter',
    density: Math.max(0.15, baseParams.density * 0.7),
    negativeSpace: Math.min(1, (baseParams.negativeSpace ?? 0) + 0.2),
    hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
    seed: deriveSeed(baseSeed, 'collection-blender', 0),
  });

  const miniTileSize = Math.max(400, Math.round((baseParams.tileSize * 0.5) / 100) * 100);
  const miniTile = buildTile({
    ...baseParams,
    tileSize: miniTileSize,
    motifSize: baseParams.motifSize * 0.55,
    density: Math.min(1, baseParams.density * 1.25),
    seed: deriveSeed(baseSeed, 'collection-mini', 0),
  });

  const stripeTile = buildTile({ ...baseParams, layoutId: 'stripe', seed: deriveSeed(baseSeed, 'collection-stripe', 0) });

  const patternTiles = [heroTile, secondaryTile, blenderTile, miniTile, stripeTile];

  // 2. Motif Factory sets — independent motifs from the same category,
  // tagged by role, feeding the border/corner/sheet assets below. The
  // Decorative Elements Sheet consolidates what v1.31 built as two
  // separate sets (Background Elements + Decorative Icons) into one.
  const borderMotifs = generateMotifSet(baseParams, { count: 4, role: 'accent', baseSeed: deriveSeed(baseSeed, 'collection-border-motifs', 0), sizeMul: 0.6 });
  const cornerMotifs = generateMotifSet(baseParams, { count: 4, role: 'accent', baseSeed: deriveSeed(baseSeed, 'collection-corner-motifs', 0), sizeMul: 0.6 });
  const spotMotifs = generateMotifSet(baseParams, { count: 12, role: 'hero', baseSeed: deriveSeed(baseSeed, 'collection-spot', 0) });
  const decorativeMotifs = generateMotifSet(baseParams, { count: 16, role: 'accent', baseSeed: deriveSeed(baseSeed, 'collection-decorative', 0), sizeMul: 0.45 });
  const allMotifs = [...borderMotifs, ...cornerMotifs, ...spotMotifs, ...decorativeMotifs];

  // 3. Border (4 edges) + Corner (4 corners) assets.
  const bandSize = Math.round(baseParams.tileSize * 0.18);
  const edges: BorderEdge[] = ['top', 'bottom', 'left', 'right'];
  const borderBuilds = edges.map((edge, i) =>
    buildBorderStrip({
      edge,
      length: baseParams.tileSize,
      band: bandSize,
      motifs: borderMotifs,
      rng: createRng(deriveSeed(baseSeed, 'collection-border-place', i)),
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
      rng: createRng(deriveSeed(baseSeed, 'collection-corner-place', i)),
      backgroundColor: heroTile.backgroundColor,
      count: 6,
    }),
  );

  // 4. Isolated-motif sheets (transparent background, SVG only).
  const spotSheet = buildMotifSheet(spotMotifs, { cols: 4, cellSize: 220, padding: 20, idPrefix: 'spot' });
  const decorativeSheet = buildMotifSheet(decorativeMotifs, { cols: 4, cellSize: 170, padding: 16, idPrefix: 'decor' });

  // 5. Metadata + SEO Package — 100% reuse of the existing per-site
  // metadata builders (metadata/shutterstock.ts, metadata/csv.ts), applied
  // to the hero pattern for per-site fields and to all 5 pattern assets
  // for the batch-upload CSVs.
  const siteMetadata: SiteMetadata[] = buildSiteMetadata(heroTile);
  const seoText = buildSeoTextFile(heroTile);
  const csvItems: SavedItem[] = patternTiles.map((t, i) => ({
    id: `${collectionId}-csv-${i}`,
    tileData: t,
    name: `${collectionId}-${['hero', 'secondary', 'blender', 'mini', 'stripe'][i]}`,
    createdAt: Date.now(),
    note: '',
    submissions: {},
  }));
  const shutterstockCsv = buildShutterstockCsv(csvItems, (item) => `${item.name}.eps`);
  const adobeStockCsv = buildAdobeStockCsv(csvItems, (item) => `${item.name}.eps`);

  // 6. Collection Preview — one composite of the 5 pattern tiles + one
  // representative border edge/corner + both sheets.
  const preview = buildCollectionPreview(
    [
      { id: 'hero', node: heroTile.svg, width: heroTile.params.tileSize, height: heroTile.params.tileSize },
      { id: 'secondary', node: secondaryTile.svg, width: secondaryTile.params.tileSize, height: secondaryTile.params.tileSize },
      { id: 'blender', node: blenderTile.svg, width: blenderTile.params.tileSize, height: blenderTile.params.tileSize },
      { id: 'mini', node: miniTile.svg, width: miniTile.params.tileSize, height: miniTile.params.tileSize },
      { id: 'stripe', node: stripeTile.svg, width: stripeTile.params.tileSize, height: stripeTile.params.tileSize },
      { id: 'border', node: borderBuilds[0].svg, width: borderBuilds[0].width, height: borderBuilds[0].height },
      { id: 'corner', node: cornerBuilds[0].svg, width: cornerBuilds[0].width, height: cornerBuilds[0].height },
      { id: 'spot', node: spotSheet.svg, width: spotSheet.width, height: spotSheet.height },
      { id: 'decorative', node: decorativeSheet.svg, width: decorativeSheet.width, height: decorativeSheet.height },
    ],
    { cols: 3, cellSize: 340, padding: 16, backgroundColor: heroTile.backgroundColor },
  );

  // 7. Assemble CollectionAsset[].
  const assets: CollectionAsset[] = [
    { id: 'hero', type: 'heroPattern', label: 'Hero Pattern', filename: `${collectionId}-hero.svg`, svg: buildSvgDocument(heroTile.svg, 3000, 3000, heroTile.params.tileSize, heroTile.params.tileSize), motifIds: [] },
    { id: 'secondary', type: 'secondaryPattern', label: 'Secondary Pattern', filename: `${collectionId}-secondary.svg`, svg: buildSvgDocument(secondaryTile.svg, 3000, 3000, secondaryTile.params.tileSize, secondaryTile.params.tileSize), motifIds: [] },
    { id: 'blender', type: 'blenderPattern', label: 'Blender Pattern', filename: `${collectionId}-blender.svg`, svg: buildSvgDocument(blenderTile.svg, 3000, 3000, blenderTile.params.tileSize, blenderTile.params.tileSize), motifIds: [] },
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
    { id: 'decorative-sheet', type: 'decorativeElementsSheet', label: 'Decorative Elements Sheet', filename: `${collectionId}-decorative-elements-sheet.svg`, svg: buildSvgDocument(decorativeSheet.svg, decorativeSheet.width, decorativeSheet.height), motifIds: decorativeMotifs.map((m) => m.id), width: decorativeSheet.width, height: decorativeSheet.height },
    { id: 'collection-preview', type: 'collectionPreview', label: 'Collection Preview', filename: `${collectionId}-preview.svg`, svg: buildSvgDocument(preview.svg, preview.width, preview.height), motifIds: [], width: preview.width, height: preview.height },
    { id: 'metadata', type: 'metadata', label: 'Metadata', filename: `${collectionId}-metadata.json`, data: { siteMetadata, seoText }, motifIds: [] },
    { id: 'seo-package', type: 'seoPackage', label: 'SEO Package', filename: `${collectionId}-seo-package.json`, data: { shutterstockCsv, adobeStockCsv, sites: siteMetadata.map((s) => s.id) }, motifIds: [] },
  ];

  // 8. Manifest — assets, motifs, explicit relationships, consistency check.
  const relationships = assets.flatMap((a) => a.motifIds.map((motifId) => ({ assetId: a.id, motifId })));
  const consistency = verifyConsistency(patternTiles.map((t) => t.params));

  const manifest: CollectionManifest = {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    collectionId,
    collectionName: collectionNameOverride ?? `${familyForCategory(baseParams.categoryId)} collection — ${baseParams.categoryId}`,
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

  return { manifest, assets, motifs: allMotifs, patternParams: patternTiles.map((t) => t.params) };
}
