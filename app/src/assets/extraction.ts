import { createRng } from '../engine/rng';
import { deriveSeed } from '../engine/candidateEngine';
import { computeBoundingRadius } from '../engine/svgAst';
import type { FactoryMotif, MotifFamily } from '../engine/motifFactory';
import { buildBorderStrip, buildCornerUnit, type BorderEdge, type CornerId } from '../engine/borderCornerAssets';
import type { GeneratedCollection } from '../collection/collectionGenerator';
import { getMotifKnowledge, getRecommendedFamilyCombinations } from '../knowledge/motif';
import { getStyleKnowledge } from '../knowledge/style';
import type { Asset, AssetCompatibility, AssetKind } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 1 "Asset Extraction". Every
// extracted asset's `node` is real, already-generated geometry: per-motif
// assets are lifted directly from `GeneratedCollection.motifs`
// (`FactoryMotif`, Professional Asset Factory Engine) with zero
// regeneration, and Border/Frame assets are reconstructed by calling the
// exact same `buildBorderStrip`/`buildCornerUnit` functions
// `collection/collectionGenerator.ts` itself calls, with the exact same
// deterministic seed derivation (`deriveSeed(collection.manifest.seed,
// 'collection-border-place'|'collection-corner-place', i)`) — this
// reproduces the identical SVG a fresh `generateCollection()` call would
// have produced, not an approximation, and never duplicates the border/
// corner *layout algorithm* itself (that logic stays exactly where it
// already lives, in `engine/borderCornerAssets.ts`).

/** Section 1's "Hero Motifs" always wins over a motif's own family — the
 * brief lists it as its own category distinct from the family-based ones. */
function kindForMotif(motif: FactoryMotif): AssetKind {
  if (motif.role === 'hero') return 'heroMotif';
  switch (motif.family) {
    case 'leaf':
      return 'leaf';
    case 'flower':
      return 'flower';
    case 'branch':
      return 'branch';
    case 'icon':
      return 'icon';
    case 'background':
      return 'texture';
    case 'berry':
    case 'decorative':
    case 'geometric':
    default:
      return 'decorativeShape';
  }
}

function buildCompatibility(categoryId: string, styleDnaId: string | undefined): AssetCompatibility {
  const familiesFromRecommendations = getRecommendedFamilyCombinations(categoryId).map((g) => g.family as MotifFamily);
  const style = styleDnaId ? getStyleKnowledge(styleDnaId) : undefined;
  return {
    patternGrammars: getMotifKnowledge(categoryId)?.compatiblePatternGrammars ?? [],
    compatibleFamilies: [...new Set(familiesFromRecommendations)],
    marketplaces: style?.recommendedMarketplaces ?? [],
  };
}

/** Every extraction/decomposition entry point (this file and
 * `decomposition.ts`) builds an `Asset` through this one function, so the
 * metadata-derivation rules (kind→family precedence, compatibility
 * lookups) can never drift between the two real entry points. */
export function buildAsset(opts: {
  id: string;
  name: string;
  kind: AssetKind;
  family: MotifFamily;
  role?: FactoryMotif['role'];
  categoryId: string;
  styleDnaId?: string;
  complexity: number;
  node: Asset['node'];
  width: number;
  height: number;
  radius: number;
  sourceCollectionId: string;
  sourceMotifIds: string[];
  colorRoles: string[];
  createdAt?: number;
  version?: number;
}): Asset {
  return {
    metadata: {
      id: opts.id,
      name: opts.name,
      kind: opts.kind,
      family: opts.family,
      // Optional fields are only assigned as real keys when defined — the
      // hand-rolled JSON Schema validator's `typeOf(undefined)` falls
      // through to `'object'` (it has no `undefined` case, since real
      // JSON never carries one), so a key literally set to `undefined`
      // would fail a `"type": "string"` check even though the field is
      // legitimately optional. Omitting the key entirely is both the
      // schema-valid representation and the accurate one (unset, not
      // "present but wrong type").
      ...(opts.role !== undefined ? { role: opts.role } : {}),
      categoryId: opts.categoryId,
      ...(opts.styleDnaId !== undefined ? { styleDnaId: opts.styleDnaId } : {}),
      complexity: opts.complexity,
      patternTypes: getMotifKnowledge(opts.categoryId)?.compatiblePatternGrammars ?? [],
      compatibility: buildCompatibility(opts.categoryId, opts.styleDnaId),
      editable: true,
      version: opts.version ?? 1,
      createdAt: opts.createdAt ?? Date.now(),
      sourceCollectionId: opts.sourceCollectionId,
      sourceMotifIds: opts.sourceMotifIds,
      colorRoles: opts.colorRoles,
    },
    node: opts.node,
    width: opts.width,
    height: opts.height,
    radius: opts.radius,
  };
}

function assetFromFactoryMotif(motif: FactoryMotif, sourceCollectionId: string): Asset {
  return buildAsset({
    id: `asset::${sourceCollectionId}::${motif.id}`,
    name: `${motif.category} ${motif.role} ${kindForMotif(motif)}`,
    kind: kindForMotif(motif),
    family: motif.family,
    role: motif.role,
    categoryId: motif.category,
    styleDnaId: motif.styleDnaId,
    complexity: motif.complexity,
    node: motif.node,
    width: motif.bounds.width,
    height: motif.bounds.height,
    radius: motif.radius,
    sourceCollectionId,
    sourceMotifIds: [motif.id],
    colorRoles: motif.colorRoles,
  });
}

const BORDER_EDGES: BorderEdge[] = ['top', 'bottom', 'left', 'right'];
const CORNERS: CornerId[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** Reconstructs the exact 4 Border assets `generateCollection` built —
 * same motif pool (the collection's real filler-role `FactoryMotif`s),
 * same seed, same band/length/count — via the real
 * `engine/borderCornerAssets.ts` builder, not a re-implementation. */
function extractBorderAssets(collection: GeneratedCollection): Asset[] {
  const fillerMotifs = collection.motifs.filter((m) => m.role === 'filler');
  if (fillerMotifs.length === 0) return [];
  const tileSize = collection.patternParams[0]?.tileSize ?? 3000;
  const bandSize = Math.round(tileSize * 0.18);
  const backgroundColor = collection.patternTiles[0]?.backgroundColor ?? '#ffffff';
  const categoryId = fillerMotifs[0].category;
  const styleDnaId = collection.manifest.styleDnaId;

  return BORDER_EDGES.map((edge, i) => {
    const build = buildBorderStrip({
      edge,
      length: tileSize,
      band: bandSize,
      motifs: fillerMotifs,
      rng: createRng(deriveSeed(collection.manifest.seed, 'collection-border-place', i)),
      backgroundColor,
      count: 8,
    });
    const motifIds = [...new Set(build.placements.map((p) => p.motifId))];
    return buildAsset({
      id: `asset::${collection.manifest.collectionId}::border-${edge}`,
      name: `${categoryId} border (${edge})`,
      kind: 'border',
      family: fillerMotifs[0].family,
      categoryId,
      styleDnaId,
      complexity: Math.round(fillerMotifs.reduce((sum, m) => sum + m.complexity, 0) / fillerMotifs.length),
      node: build.svg,
      width: build.width,
      height: build.height,
      radius: computeBoundingRadius(build.svg),
      sourceCollectionId: collection.manifest.collectionId,
      sourceMotifIds: motifIds,
      colorRoles: [...new Set(fillerMotifs.flatMap((m) => m.colorRoles))],
    });
  });
}

/** Reconstructs the exact 4 Corner assets the same way — Section 1 names
 * this extraction category "Frames" (a corner treatment is the reusable
 * "framing" unit; see `relationships.ts` for the real Border↔Corner
 * relationship this shares constituent motifs with). */
function extractFrameAssets(collection: GeneratedCollection): Asset[] {
  const fillerMotifs = collection.motifs.filter((m) => m.role === 'filler');
  if (fillerMotifs.length === 0) return [];
  const tileSize = collection.patternParams[0]?.tileSize ?? 3000;
  const bandSize = Math.round(tileSize * 0.18);
  const backgroundColor = collection.patternTiles[0]?.backgroundColor ?? '#ffffff';
  const categoryId = fillerMotifs[0].category;
  const styleDnaId = collection.manifest.styleDnaId;

  return CORNERS.map((corner, i) => {
    const build = buildCornerUnit({
      corner,
      band: bandSize,
      motifs: fillerMotifs,
      rng: createRng(deriveSeed(collection.manifest.seed, 'collection-corner-place', i)),
      backgroundColor,
      count: 6,
    });
    const motifIds = [...new Set(build.placements.map((p) => p.motifId))];
    return buildAsset({
      id: `asset::${collection.manifest.collectionId}::corner-${corner}`,
      name: `${categoryId} frame corner (${corner})`,
      kind: 'frame',
      family: fillerMotifs[0].family,
      categoryId,
      styleDnaId,
      complexity: Math.round(fillerMotifs.reduce((sum, m) => sum + m.complexity, 0) / fillerMotifs.length),
      node: build.svg,
      width: build.width,
      height: build.height,
      radius: computeBoundingRadius(build.svg),
      sourceCollectionId: collection.manifest.collectionId,
      sourceMotifIds: motifIds,
      colorRoles: [...new Set(fillerMotifs.flatMap((m) => m.colorRoles))],
    });
  });
}

/** Section 1 — extracts every reusable asset a Collection can contribute:
 * one Asset per real `FactoryMotif` (Hero Motifs/Leaves/Flowers/Branches/
 * Textures/Icons/Decorative Shapes, by family+role) plus the 4 Border and
 * 4 Frame assets reconstructed from the collection's real filler-motif
 * pool. Spot Motif Sheets and Decorative Element Sheets are *not*
 * separately extracted — they're composite arrangements of the same
 * `FactoryMotif`s already extracted individually above, so re-extracting
 * them would just duplicate the same reusable geometry under a second id. */
export function extractAssetsFromCollection(collection: GeneratedCollection): Asset[] {
  const motifAssets = collection.motifs.map((m) => assetFromFactoryMotif(m, collection.manifest.collectionId));
  const borderAssets = extractBorderAssets(collection);
  const frameAssets = extractFrameAssets(collection);
  return [...motifAssets, ...borderAssets, ...frameAssets];
}
