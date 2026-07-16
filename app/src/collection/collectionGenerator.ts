import type { GenerateParams, LayoutId, SvgNode, TileData } from '../engine/types';
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
import { buildColorStory } from './colorStory';
import { buildMotifReuseReport, type CollectionMotifPlacement, type MotifReuseReport } from './motifReuse';

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
// Commercial Collection Engine Phase 4 (schema version 2 -> 3, additive
// this time — every existing field/asset id/order is unchanged, so
// `patternParams`'s fixed hero/secondary/blender/mini/stripe index order
// that components/ProjectPanel.tsx depends on is untouched) adds two more
// asset types Section 2 of that brief names and this engine didn't produce
// yet: `backgroundTexture` (a subtle, tone-on-tone all-over wash meant to
// sit under other assets — digital-paper/background-layer use, not a
// sellable focal pattern) and `individualMotif` (a handful of the
// collection's hero motifs exported standalone, one per file, distinct
// from the existing Spot Motif Sheet composite). It also assigns every
// pattern-type asset a genuinely distinct layout (`allocateLayout`,
// Section 5, "Layout Variation") instead of letting Mini Pattern silently
// inherit the Hero Pattern's own layout the way it used to.
//
// Commercial Collection Engine Phase 4b (schema version 3 -> 4, additive
// again — `patternParams` is still untouched) closes the last 2 of the 12
// named asset kinds a follow-up, more detailed brief asked for:
// `densePattern` and `airyPattern`, built from the already-registered
// `densePremium`/`airy` layouts (Project PHOENIX's Cluster Composition
// Engine, unmodified) the same way Background Texture was added — appended
// to `patternTiles` only, never to `patternParams`. It also consolidates
// the border/corner/decorative motif sets into a real shared pool
// (`collection/motifReuse.ts`, Section 6 "Motif Reuse Engine") instead of 3
// independently-generated sets that happened to look similar.
//
// This module is deliberately DOM-free (no <canvas>, no download/zip
// calls) so the whole pipeline is unit-testable the same way every other
// engine module is — PNG rasterization and ZIP packaging happen one layer
// up, in App.tsx, exactly like every other raster/zip export in this app.

export const COLLECTION_SCHEMA_VERSION = 4;

export type AssetType =
  | 'heroPattern'
  | 'secondaryPattern'
  | 'blenderPattern'
  | 'miniPattern'
  | 'stripePattern'
  | 'backgroundTexture'
  | 'densePattern'
  | 'airyPattern'
  | 'borderPattern'
  | 'cornerPattern'
  | 'spotMotifSheet'
  | 'individualMotif'
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
   * scoring without re-deriving or re-parsing anything. Fixed shape/order
   * on purpose: components/ProjectPanel.tsx indexes into this array by
   * position (`PATTERN_ASSET_INDEX`), so it is never reordered or resized
   * — the newer Background Texture pattern (below) lives in `patternTiles`
   * instead, not here. */
  patternParams: GenerateParams[];
  /** Every pattern-type `TileData` actually built for this collection —
   * the same 5 `patternParams` covers, in the same order, *plus*
   * Background Texture, Dense Pattern, and Airy Pattern (Commercial
   * Collection Engine Phase 4/4b, Section 2) at the end, in that order.
   * Additive: exists so collection/collectionScore.ts can compute real
   * layout/motif-diversity dimensions (Section 9) and
   * trend/collectionPlan.ts can build preview metadata, without
   * re-deriving or re-parsing anything and without disturbing
   * `patternParams`'s own fixed shape. */
  patternTiles: TileData[];
  /** Section 6, "Motif Reuse Engine" — which motifs genuinely reach more
   * than one asset, and with what real rotation/scale variants. */
  motifReuse: MotifReuseReport;
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

/** Deterministically resolves a layout that isn't already in `used`: keeps
 * `preferred` when it's still free, otherwise walks `LAYOUT_LIST`
 * cyclically starting from `preferred`'s position until a free layout is
 * found. Section 5, "Layout Variation" — every pattern-type asset in a
 * collection must read as a genuinely different composition strategy, not
 * a re-palette of the same one (Mini Pattern used to silently inherit
 * whatever layout Hero Pattern picked; it no longer does). With 14
 * registered layouts and at most 6 pattern-type assets per collection this
 * always succeeds well before the list is exhausted — the final fallback
 * (returning `preferred` anyway) only matters if that ever changes. */
function allocateLayout(preferred: LayoutId, used: Set<LayoutId>): LayoutId {
  if (!used.has(preferred)) return preferred;
  const idx = LAYOUT_LIST.findIndex((l) => l.id === preferred);
  for (let i = 1; i <= LAYOUT_LIST.length; i++) {
    const candidate = LAYOUT_LIST[(idx + i) % LAYOUT_LIST.length].id;
    if (!used.has(candidate)) return candidate;
  }
  return preferred;
}

/** Checks the collection's real assembled data for internal consistency —
 * a lightweight, real Designer-Assistant-style verification (not a full
 * Phase 8 engine, which doesn't exist yet — see the Style DNA milestone's
 * scope note for the same precedent) that would genuinely catch a real
 * bug: if any pattern-type asset's palette/style/category ever drifted
 * from the rest, this reports it instead of silently shipping a broken
 * "collection". `motifs` is optional (defaults to none checked) so
 * existing callers that only ever cared about pattern params keep working
 * unchanged — Section 4 "Motif Consistency" callers pass the collection's
 * full factory-generated motif set to additionally confirm every
 * border/corner/spot/decorative/individual motif shares one motif
 * family, not just the 5 seamless-tile pattern assets. */
export function verifyConsistency(patternParams: GenerateParams[], motifs: FactoryMotif[] = []): CollectionConsistency {
  const issues: string[] = [];
  const paletteIds = new Set(patternParams.map((p) => p.paletteId));
  if (paletteIds.size > 1) issues.push(`palette differs across pattern assets: ${[...paletteIds].join(', ')}`);
  const styleIds = new Set(patternParams.map((p) => p.styleDnaId ?? 'none'));
  if (styleIds.size > 1) issues.push(`Style DNA differs across pattern assets: ${[...styleIds].join(', ')}`);
  const categoryIds = new Set(patternParams.map((p) => p.categoryId));
  if (categoryIds.size > 1) issues.push(`motif family (category) differs across pattern assets: ${[...categoryIds].join(', ')}`);
  if (motifs.length > 0) {
    const motifCategoryIds = new Set(motifs.map((m) => m.category));
    if (motifCategoryIds.size > 1) issues.push(`motif family (category) differs across factory-generated motifs: ${[...motifCategoryIds].join(', ')}`);
  }
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

/** Fixed asset count independent of Individual Motif count: 8 pattern-type
 * tiles (Hero/Secondary/Blender/Mini/Stripe/Background/Dense/Airy) + 4
 * border + 4 corner + Spot Motif Sheet + Decorative Elements Sheet +
 * Collection Preview + Metadata + SEO Package. Section 12's "10/25/50/100
 * related assets" only varies Individual Motif count on top of this —
 * every other asset kind is a fixed, required part of the collection
 * structure (`collectionScore.ts`'s `REQUIRED_ASSET_TYPES`), so shrinking
 * below this floor would break commercialReadiness completeness. */
const FIXED_NON_INDIVIDUAL_ASSET_COUNT = 21;
const BASE_INDIVIDUAL_MOTIF_COUNT = 6;
const MAX_COLLECTION_SIZE = 100;

export function generateCollection(
  baseParams: GenerateParams,
  styleDna?: StyleDna,
  collectionNameOverride?: string,
  requestedCollectionSize?: number,
): GeneratedCollection {
  const baseSeed = baseParams.seed;
  const collectionId = `collection-${baseSeed}`;

  // 1. Six pattern-type assets, all sharing category/palette/Style DNA —
  // only layout/density/hierarchy/scale/color-lightness vary, each real
  // buildTile output with its own deterministic derived seed. Section 5,
  // "Layout Variation": every one of these gets a genuinely distinct
  // layout via `allocateLayout`, tracked in `usedLayouts` as each is
  // assigned, starting from the Hero Pattern's own (user-chosen) layout.
  const usedLayouts = new Set<LayoutId>([baseParams.layoutId]);
  const heroTile = buildTile({ ...baseParams, seed: deriveSeed(baseSeed, 'collection-hero', 0) });

  const secondaryLayout = allocateLayout(pickSecondaryLayout(baseParams, styleDna, baseSeed), usedLayouts);
  usedLayouts.add(secondaryLayout);
  const secondaryTile = buildTile({
    ...baseParams,
    layoutId: secondaryLayout,
    hierarchy: HIERARCHY_PRESETS.denseLayered.value,
    seed: deriveSeed(baseSeed, 'collection-secondary', 0),
  });

  const blenderLayout = allocateLayout('scatter', usedLayouts);
  usedLayouts.add(blenderLayout);
  const blenderTile = buildTile({
    ...baseParams,
    layoutId: blenderLayout,
    density: Math.max(0.15, baseParams.density * 0.7),
    negativeSpace: Math.min(1, (baseParams.negativeSpace ?? 0) + 0.2),
    hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
    seed: deriveSeed(baseSeed, 'collection-blender', 0),
  });

  // Mini Pattern's own preferred layout is 'halfDrop' (a conventional
  // choice for a small-scale ditsy repeat in real textile collections) —
  // previously this asset had no `layoutId` override at all and silently
  // inherited whichever layout Hero Pattern used.
  const miniLayout = allocateLayout('halfDrop', usedLayouts);
  usedLayouts.add(miniLayout);
  const miniTileSize = Math.max(400, Math.round((baseParams.tileSize * 0.5) / 100) * 100);
  const miniTile = buildTile({
    ...baseParams,
    layoutId: miniLayout,
    tileSize: miniTileSize,
    motifSize: baseParams.motifSize * 0.55,
    density: Math.min(1, baseParams.density * 1.25),
    seed: deriveSeed(baseSeed, 'collection-mini', 0),
  });

  const stripeLayout = allocateLayout('stripe', usedLayouts);
  usedLayouts.add(stripeLayout);
  const stripeTile = buildTile({ ...baseParams, layoutId: stripeLayout, seed: deriveSeed(baseSeed, 'collection-stripe', 0) });

  // Background Texture (Section 2) — a subtle, low-contrast, tone-on-tone
  // all-over wash meant to sit *underneath* other assets (digital-paper /
  // background-layer use), not a sixth sellable focal pattern, so it is
  // deliberately excluded from the CSV/metadata pattern list below. Reuses
  // the Color Story Engine's "light" variant (Section 3) of the
  // collection's own actually-resolved colors (`heroTile.colors`, which
  // already accounts for `customColors`/palette truncation — the same
  // colors the manifest itself records) so it reads as a coordinated wash
  // of the real collection palette rather than an unrelated pattern.
  const backgroundLayout = allocateLayout('gridMinimal', usedLayouts);
  usedLayouts.add(backgroundLayout);
  const backgroundColorStory = buildColorStory(heroTile.colors);
  const backgroundTile = buildTile({
    ...baseParams,
    layoutId: backgroundLayout,
    customColors: backgroundColorStory.light.colors,
    colorCount: Math.max(2, Math.min(baseParams.colorCount, 3)),
    motifSize: baseParams.motifSize * 0.5,
    density: Math.min(1, baseParams.density * 0.85),
    seed: deriveSeed(baseSeed, 'collection-background-texture', 0),
  });

  // Dense Pattern + Airy Pattern (new Commercial Collection Engine Phase 4
  // brief, Section 2) — the two remaining named asset kinds this generator
  // didn't produce yet. Both reuse *existing, already-registered* layouts
  // (`densePremium`/`airy` — Project PHOENIX's Cluster Composition Engine
  // powers both already, unmodified here) rather than inventing new layout
  // logic. Like Background Texture, both are additive: they extend
  // `patternTiles` (freely resizable) but never `patternParams` (fixed
  // 5-element shape components/ProjectPanel.tsx depends on).
  const denseLayout = allocateLayout('densePremium', usedLayouts);
  usedLayouts.add(denseLayout);
  const denseTile = buildTile({
    ...baseParams,
    layoutId: denseLayout,
    density: Math.min(1, baseParams.density * 1.4),
    negativeSpace: Math.max(0, (baseParams.negativeSpace ?? 0) - 0.15),
    hierarchy: HIERARCHY_PRESETS.denseLayered.value,
    seed: deriveSeed(baseSeed, 'collection-dense', 0),
  });

  const airyLayout = allocateLayout('airy', usedLayouts);
  usedLayouts.add(airyLayout);
  const airyTile = buildTile({
    ...baseParams,
    layoutId: airyLayout,
    density: Math.max(0.1, baseParams.density * 0.55),
    negativeSpace: Math.min(1, (baseParams.negativeSpace ?? 0) + 0.3),
    hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
    seed: deriveSeed(baseSeed, 'collection-airy', 0),
  });

  const patternTiles = [heroTile, secondaryTile, blenderTile, miniTile, stripeTile];
  const allPatternTiles = [...patternTiles, backgroundTile, denseTile, airyTile];

  // 2. Motif Factory sets — independent motifs from the same category,
  // tagged by role, feeding the border/corner/sheet assets below. The
  // Decorative Elements Sheet consolidates what v1.31 built as two
  // separate sets (Background Elements + Decorative Icons) into one.
  //
  // Motif Reuse Engine (Section 6, added Phase 4b): `fillerMotifPool` is
  // generated *once* and reused — not regenerated — across Border, Corner,
  // and the first few slots of the Decorative Elements Sheet, so those 9
  // assets genuinely share real motif geometry (`collection/motifReuse.ts`
  // reports exactly which motifs and how many assets each reaches) instead
  // of 3 independently-random sets that only happened to look similar.
  // Spot Motifs stay their own pool (role 'hero', Individual Motifs already
  // reuses a slice of it below — pre-existing, unchanged) since border/
  // corner/decorative accents are a different creative role than hero
  // motifs.
  const fillerMotifPool = generateMotifSet(baseParams, { count: 8, role: 'filler', baseSeed: deriveSeed(baseSeed, 'collection-filler-pool', 0), sizeMul: 0.6 });
  const spotMotifs = generateMotifSet(baseParams, { count: 12, role: 'hero', baseSeed: deriveSeed(baseSeed, 'collection-spot', 0) });
  const decorativeAccents = generateMotifSet(baseParams, { count: 12, role: 'accent', baseSeed: deriveSeed(baseSeed, 'collection-decorative', 0), sizeMul: 0.45 });
  const borderMotifs = fillerMotifPool;
  const cornerMotifs = fillerMotifPool;
  const decorativeMotifs = [...fillerMotifPool.slice(0, 4), ...decorativeAccents];
  // Finalized once Individual Motif padding (Section 12, below) decides
  // whether any additional pad motifs are needed.
  const uniqueMotifsById = new Map<string, FactoryMotif>();
  for (const m of [...fillerMotifPool, ...spotMotifs, ...decorativeAccents]) uniqueMotifsById.set(m.id, m);

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

  // Motif Reuse Engine (Section 6) — the real rotation/scale variant each
  // shared filler motif got at each placement, tagged with which asset used
  // it, straight from `buildBorderStrip`/`buildCornerUnit`'s own real
  // placement decisions (never re-derived or guessed).
  const motifPlacementLog: CollectionMotifPlacement[] = [
    ...edges.flatMap((edge, i) => borderBuilds[i].placements.map((p) => ({ ...p, assetId: `border-${edge}` }))),
    ...corners.flatMap((corner, i) => cornerBuilds[i].placements.map((p) => ({ ...p, assetId: `corner-${corner}` }))),
  ];

  // 4. Isolated-motif sheets (transparent background, SVG only).
  const spotSheet = buildMotifSheet(spotMotifs, { cols: 4, cellSize: 220, padding: 20, idPrefix: 'spot' });
  const decorativeSheet = buildMotifSheet(decorativeMotifs, { cols: 4, cellSize: 170, padding: 16, idPrefix: 'decor' });

  // 4b. Individual Motifs (Section 2) — a handful of the collection's own
  // hero motifs, each exported as its own standalone SVG document (not a
  // sheet composite like Spot Motif Sheet above). Reuses `spotMotifs`
  // directly rather than generating a separate motif set, so every
  // Individual Motif asset is guaranteed to be one of the exact same
  // motifs already tracked in `allMotifs`/the manifest's relationships —
  // no duplicate generation, no risk of drifting from the shared motif
  // family.
  //
  // Section 12, "Performance" (10/25/50/100-asset collections) — the only
  // asset kind this generator scales with `requestedCollectionSize` is
  // Individual Motifs, and it scales by *reuse first*: the still-unused
  // remainder of `spotMotifs`, then the entire `fillerMotifPool`, then
  // `decorativeAccents` are all already-generated geometry this collection
  // built anyway for other assets — exporting them standalone costs one
  // cheap SVG-document wrap, not a regeneration. Only once every already-
  // generated motif is exhausted does this fall back to `generateMotifSet`
  // for genuinely new geometry, and only for the exact remainder still
  // needed to reach the requested size (never more).
  const baseIndividualCount = Math.min(BASE_INDIVIDUAL_MOTIF_COUNT, spotMotifs.length);
  const targetTotalAssets = requestedCollectionSize !== undefined
    ? Math.min(MAX_COLLECTION_SIZE, Math.max(FIXED_NON_INDIVIDUAL_ASSET_COUNT + baseIndividualCount, requestedCollectionSize))
    : FIXED_NON_INDIVIDUAL_ASSET_COUNT + baseIndividualCount;
  const targetIndividualMotifCount = targetTotalAssets - FIXED_NON_INDIVIDUAL_ASSET_COUNT;
  const extraNeeded = Math.max(0, targetIndividualMotifCount - baseIndividualCount);

  const reusableExtraMotifs: FactoryMotif[] = [...spotMotifs.slice(baseIndividualCount), ...fillerMotifPool, ...decorativeAccents];
  const reusedExtras = reusableExtraMotifs.slice(0, extraNeeded);
  const stillNeeded = extraNeeded - reusedExtras.length;
  const padMotifs = stillNeeded > 0
    ? generateMotifSet(baseParams, { count: stillNeeded, role: 'accent', baseSeed: deriveSeed(baseSeed, 'collection-pad-motifs', 0), sizeMul: 0.5 })
    : [];
  for (const m of padMotifs) uniqueMotifsById.set(m.id, m);
  const allMotifs = [...uniqueMotifsById.values()];

  const individualMotifs = [...spotMotifs.slice(0, baseIndividualCount), ...reusedExtras, ...padMotifs];
  const individualMotifBuilds = individualMotifs.map((motif) => {
    const size = Math.max(motif.bounds.width, motif.bounds.height) || 1;
    const pad = size * 0.15;
    const box = size + pad * 2;
    const cx = (motif.bounds.minX + motif.bounds.maxX) / 2;
    const cy = (motif.bounds.minY + motif.bounds.maxY) / 2;
    const centered = h('g', { transform: `translate(${round(box / 2 - cx)} ${round(box / 2 - cy)})` }, [motif.node]);
    return { motif, svg: centered, size: box };
  });

  // 5. Metadata + SEO Package — 100% reuse of the existing per-site
  // metadata builders (metadata/shutterstock.ts, metadata/csv.ts), applied
  // to the hero pattern for per-site fields and to all 5 pattern assets
  // for the batch-upload CSVs.
  const siteMetadata: SiteMetadata[] = buildSiteMetadata(heroTile);
  const seoText = buildSeoTextFile(heroTile);
  // Dense/Airy Pattern are real sellable focal patterns (unlike Background
  // Texture, which stays excluded per its own documented rationale above),
  // so they're appended to the sellable-pattern CSV list too.
  const sellablePatternTiles = [...patternTiles, denseTile, airyTile];
  const csvItems: SavedItem[] = sellablePatternTiles.map((t, i) => ({
    id: `${collectionId}-csv-${i}`,
    tileData: t,
    name: `${collectionId}-${['hero', 'secondary', 'blender', 'mini', 'stripe', 'dense', 'airy'][i]}`,
    createdAt: Date.now(),
    note: '',
    submissions: {},
  }));
  const shutterstockCsv = buildShutterstockCsv(csvItems, (item) => `${item.name}.eps`);
  const adobeStockCsv = buildAdobeStockCsv(csvItems, (item) => `${item.name}.eps`);

  // 6. Collection Preview — one composite of the 6 pattern tiles + one
  // representative border edge/corner + both sheets.
  const preview = buildCollectionPreview(
    [
      { id: 'hero', node: heroTile.svg, width: heroTile.params.tileSize, height: heroTile.params.tileSize },
      { id: 'secondary', node: secondaryTile.svg, width: secondaryTile.params.tileSize, height: secondaryTile.params.tileSize },
      { id: 'blender', node: blenderTile.svg, width: blenderTile.params.tileSize, height: blenderTile.params.tileSize },
      { id: 'mini', node: miniTile.svg, width: miniTile.params.tileSize, height: miniTile.params.tileSize },
      { id: 'stripe', node: stripeTile.svg, width: stripeTile.params.tileSize, height: stripeTile.params.tileSize },
      { id: 'background-texture', node: backgroundTile.svg, width: backgroundTile.params.tileSize, height: backgroundTile.params.tileSize },
      { id: 'dense', node: denseTile.svg, width: denseTile.params.tileSize, height: denseTile.params.tileSize },
      { id: 'airy', node: airyTile.svg, width: airyTile.params.tileSize, height: airyTile.params.tileSize },
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
    { id: 'background-texture', type: 'backgroundTexture', label: 'Background Texture', filename: `${collectionId}-background-texture.svg`, svg: buildSvgDocument(backgroundTile.svg, 3000, 3000, backgroundTile.params.tileSize, backgroundTile.params.tileSize), motifIds: [] },
    { id: 'dense-pattern', type: 'densePattern', label: 'Dense Pattern', filename: `${collectionId}-dense.svg`, svg: buildSvgDocument(denseTile.svg, 3000, 3000, denseTile.params.tileSize, denseTile.params.tileSize), motifIds: [] },
    { id: 'airy-pattern', type: 'airyPattern', label: 'Airy Pattern', filename: `${collectionId}-airy.svg`, svg: buildSvgDocument(airyTile.svg, 3000, 3000, airyTile.params.tileSize, airyTile.params.tileSize), motifIds: [] },
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
    ...individualMotifBuilds.map((build, i) => ({
      id: `individual-motif-${i + 1}`,
      type: 'individualMotif' as const,
      label: `Individual Motif ${i + 1}`,
      filename: `${collectionId}-individual-motif-${i + 1}.svg`,
      svg: buildSvgDocument(build.svg, build.size, build.size),
      motifIds: [build.motif.id],
      width: build.size,
      height: build.size,
    })),
    { id: 'collection-preview', type: 'collectionPreview', label: 'Collection Preview', filename: `${collectionId}-preview.svg`, svg: buildSvgDocument(preview.svg, preview.width, preview.height), motifIds: [], width: preview.width, height: preview.height },
    { id: 'metadata', type: 'metadata', label: 'Metadata', filename: `${collectionId}-metadata.json`, data: { siteMetadata, seoText }, motifIds: [] },
    { id: 'seo-package', type: 'seoPackage', label: 'SEO Package', filename: `${collectionId}-seo-package.json`, data: { shutterstockCsv, adobeStockCsv, sites: siteMetadata.map((s) => s.id) }, motifIds: [] },
  ];

  // 8. Manifest — assets, motifs, explicit relationships, consistency check.
  // Section 4, "Motif Consistency": checks both the 5 core pattern-type
  // assets' shared category/palette/Style DNA (as before) *and* every
  // factory-generated motif's shared family (`allMotifs` — border/corner/
  // spot/decorative, which Individual Motifs reuse rather than duplicate).
  const relationships = assets.flatMap((a) => a.motifIds.map((motifId) => ({ assetId: a.id, motifId })));
  const consistency = verifyConsistency(patternTiles.map((t) => t.params), allMotifs);

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

  const motifReuse = buildMotifReuseReport(relationships, allMotifs, motifPlacementLog);

  return {
    manifest,
    assets,
    motifs: allMotifs,
    patternParams: patternTiles.map((t) => t.params),
    patternTiles: allPatternTiles,
    motifReuse,
  };
}
