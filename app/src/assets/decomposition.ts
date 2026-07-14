import { h, computeBoundingBox, computeBoundingRadius } from '../engine/svgAst';
import { findMotifGroups, countNodes } from '../engine/svgGeometry';
import { familyForCategory, type MotifRole } from '../engine/motifFactory';
import { buildSvgDocument } from '../export/svgExporter';
import type { TileData } from '../engine/types';
import { buildAsset } from './extraction';
import type { Asset } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 8 "SVG Decomposition". Splits
// an already-rendered tile back into reusable per-motif assets — the
// second real extraction pathway, for artwork that only exists as a
// rendered `TileData` (e.g. a Saved Library item) rather than a fresh
// `GeneratedCollection`. Built entirely on `engine/svgGeometry.ts`'s real
// placement-parsing (`findMotifGroups`) — never a second SVG parser.
// Editability and Affinity Designer compatibility are structural
// guarantees, not claims: every extracted `node` is the exact same real
// `<path>`/`<g>` subtree the tile itself renders, never rasterized or
// flattened, and `buildSvgDocument` is the identical standalone-SVG
// wrapper every other export in this app already uses.

const COMPLEXITY_NODE_CEILING = 60;

function complexityFromNode(node: Asset['node']): number {
  return Math.round(Math.max(0, Math.min(100, (countNodes(node) / COMPLEXITY_NODE_CEILING) * 100)));
}

function usedColors(node: Asset['node'], palette: string[]): string[] {
  const paletteLower = new Map(palette.map((c) => [c.toLowerCase(), c]));
  const found = new Set<string>();
  const walk = (n: Asset['node']) => {
    const attrs = n.attrs ?? {};
    for (const key of ['fill', 'stroke']) {
      const v = attrs[key];
      if (typeof v === 'string') {
        const match = paletteLower.get(v.toLowerCase());
        if (match) found.add(match);
      }
    }
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return [...found];
}

/** Splits one rendered tile's real `motif-N` placement groups back into
 * standalone `Asset` records — one per distinct motif placement in the
 * tile, each carrying the real geometry of that placement's first
 * wrap-clone copy (the placement `<g transform>` wrapper itself is
 * stripped off, so the asset's own geometry starts at its own origin,
 * exactly like a fresh `FactoryMotif.node` would). */
export function decomposeTileIntoAssets(tileData: TileData, opts: { sourceCollectionId: string }): Asset[] {
  const groups = findMotifGroups(tileData.svg);
  const categoryId = tileData.params.categoryId;
  const family = familyForCategory(categoryId);
  const styleDnaId = tileData.params.styleDnaId;

  return groups
    .map((group, i) => {
      const firstCopy = (group.children ?? [])[0];
      const content = firstCopy?.children ?? [];
      if (content.length === 0) return null;
      const node = content.length === 1 ? content[0] : h('g', {}, content);
      const bounds = computeBoundingBox(node);
      const role = group.attrs?.['data-role'] as MotifRole | undefined;
      const kind = role === 'hero' ? 'heroMotif' : family === 'leaf' ? 'leaf' : family === 'flower' ? 'flower' : family === 'branch' ? 'branch' : family === 'icon' ? 'icon' : family === 'background' ? 'texture' : 'decorativeShape';
      return buildAsset({
        id: `asset::${opts.sourceCollectionId}::decomposed-${categoryId}-${i}`,
        name: `${categoryId} ${role ?? 'motif'} (decomposed)`,
        kind,
        family,
        role,
        categoryId,
        styleDnaId,
        complexity: complexityFromNode(node),
        node,
        width: bounds.width,
        height: bounds.height,
        radius: computeBoundingRadius(node),
        sourceCollectionId: opts.sourceCollectionId,
        sourceMotifIds: [String(group.attrs?.id ?? `motif-${i}`)],
        colorRoles: usedColors(node, tileData.colors),
      });
    })
    .filter((a): a is Asset => a !== null);
}

/** Wraps one asset's real geometry as a complete, standalone, editable SVG
 * document — the same `buildSvgDocument` primitive every Collection asset
 * and export builder already uses, never a second serializer. */
export function decomposeAssetToSvg(asset: Asset): string {
  return buildSvgDocument(asset.node, asset.width, asset.height);
}
