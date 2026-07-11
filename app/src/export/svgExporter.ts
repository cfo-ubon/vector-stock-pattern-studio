import type { GenerateParams, SvgNode, TileData } from '../engine/types';
import { h, serialize, round } from '../engine/svgAst';
import { optimizeSvgTree } from '../engine/svgOptimizer';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { getPalette } from '../palettes/palettes';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const SVG_NS_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  version: '1.1',
} as const;

/** Exported artboard size in px for the single-tile SVG/EPS — the file
 * handed straight to a stock site's "seamless pattern" upload. The
 * viewBox stays at the tile's own coordinate system (SVG scales
 * losslessly), width/height just control the document size an editor
 * opens the file at. 3000x3000 clears every stock site's minimum while
 * keeping file size reasonable. */
export const SINGLE_EXPORT_PIXEL_SIZE = 3000;

/** Artboard size for the pre-tiled 3x3 SVG export. */
export const TILED_EXPORT_PIXEL_SIZE = 10000;

export function collectIds(node: SvgNode, ids: Set<string>) {
  if (node.attrs?.id) ids.add(String(node.attrs.id));
  node.children?.forEach((c) => collectIds(c, ids));
}

/** Deep-clone a subtree, suffixing every id and rewriting any `url(#id)`
 * references to match — needed because the pre-tiled export places several
 * copies of the same tile-content tree into one SVG document, and SVG ids
 * must be unique per document. */
export function remapIds(node: SvgNode, idMap: Map<string, string>): SvgNode {
  const attrs = node.attrs ? { ...node.attrs } : undefined;
  if (attrs) {
    if (typeof attrs.id === 'string' && idMap.has(attrs.id)) {
      attrs.id = idMap.get(attrs.id)!;
    }
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (typeof value === 'string') {
        const match = value.match(/^url\(#(.+)\)$/);
        if (match && idMap.has(match[1])) {
          attrs[key] = `url(#${idMap.get(match[1])})`;
        }
      }
    }
  }
  return { ...node, attrs, children: node.children?.map((c) => remapIds(c, idMap)) };
}

/** Suffix every id in a subtree with `-${suffix}` so it can be safely
 * embedded alongside other copies of the same tree in one document (e.g.
 * multiple gallery thumbnails, or a thumbnail next to the main preview,
 * both built from the same generator output). */
export function namespaceIds(node: SvgNode, suffix: string): SvgNode {
  const ids = new Set<string>();
  collectIds(node, ids);
  const idMap = new Map<string, string>();
  ids.forEach((id) => idMap.set(id, `${id}-${suffix}`));
  return remapIds(node, idMap);
}

/** Wraps arbitrary SvgNode content in a standalone `<svg>` document with the
 * standard XML header/namespace attrs — the shared primitive every export
 * builder in this file (and the Collection asset builders in
 * collection/collectionGenerator.ts, which produce raw SvgNode content
 * rather than a full TileData) uses instead of hand-rolling the same root
 * wrapper repeatedly. */
export function buildSvgDocument(content: SvgNode, width: number, height: number, viewBoxWidth = width, viewBoxHeight = height): string {
  const root = h(
    'svg',
    { ...SVG_NS_ATTRS, width: round(width), height: round(height), viewBox: `0 0 ${round(viewBoxWidth)} ${round(viewBoxHeight)}` },
    [content],
  );
  return `${XML_HEADER}\n${serialize(root)}\n`;
}

/** Single-tile export: one editable tile, viewBox matches the tile size
 * exactly. This is the file to hand to a stock site's "seamless pattern"
 * requirement, or to open in Affinity Designer for further editing.
 * Runs the SVG Optimizer (engine/svgOptimizer.ts) first — a lossless
 * structural cleanup (redundant `<g>` collapse, no-op transform removal)
 * applied at the export boundary rather than inside `buildTile` itself, so
 * every existing consumer of a plain `TileData` (preview rendering, the
 * Candidate/Scoring Engine, every test that asserts exact tile structure)
 * is completely unaffected — only the file the designer actually
 * downloads/uploads is optimized. */
export function buildSingleTileSvg(tileData: TileData): string {
  const { tileSize } = tileData.params;
  const { node: optimized } = optimizeSvgTree(tileData.svg);
  return buildSvgDocument(optimized, SINGLE_EXPORT_PIXEL_SIZE, SINGLE_EXPORT_PIXEL_SIZE, tileSize, tileSize);
}

/** Pre-tiled export: `cols` x `rows` literal, fully-editable copies of the
 * tile (not <use> references) so an Affinity Designer user can select and
 * tweak any individual repeat without "expanding" anything first. Also
 * optimizer-cleaned (see `buildSingleTileSvg`) — optimized once before
 * cloning, so the cleanup cost is paid a single time regardless of how
 * many `cols x rows` copies are produced, not once per copy. */
export function buildTiledSvg(tileData: TileData, cols = 3, rows = 3): string {
  const { tileSize } = tileData.params;
  const { node: optimizedSvg } = optimizeSvgTree(tileData.svg);
  const copies: SvgNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ids = new Set<string>();
      collectIds(optimizedSvg, ids);
      const idMap = new Map<string, string>();
      ids.forEach((id) => idMap.set(id, `${id}-r${r}-c${c}`));
      const cloned = remapIds(optimizedSvg, idMap);
      copies.push(h('g', { transform: `translate(${round(c * tileSize)} ${round(r * tileSize)})` }, [cloned]));
    }
  }
  const root = h(
    'svg',
    {
      ...SVG_NS_ATTRS,
      width: TILED_EXPORT_PIXEL_SIZE,
      height: TILED_EXPORT_PIXEL_SIZE,
      viewBox: `0 0 ${round(tileSize * cols)} ${round(tileSize * rows)}`,
    },
    [h('g', { id: 'pattern-tiled' }, copies)],
  );
  return `${XML_HEADER}\n${serialize(root)}\n`;
}

/** Human-readable palette/category/layout labels for a pattern's params —
 * the exact parts `buildExportFilename` slugifies into a file name.
 * Factored out of App.tsx (which used to have its own local copy of this
 * exact logic) so the Stock Submission Center's checklist/analyzer can
 * compute the real filename the app would actually export, instead of a
 * second, drifting reimplementation. */
export function buildFilenameParts(params: GenerateParams): string[] {
  const paletteName = params.customColors?.length ? 'custom colors' : getPalette(params.paletteId).label;
  const categoryName =
    params.mixCategoryIds && params.mixCategoryIds.length >= 2
      ? `mix ${params.mixCategoryIds.map((id) => GENERATORS[id]?.label ?? id).join(' x ')}`
      : (GENERATORS[params.categoryId]?.label ?? params.categoryId);
  const layoutName = LAYOUTS[params.layoutId]?.label ?? params.layoutId;
  return [paletteName, categoryName, layoutName];
}

/** Descriptive, filesystem-safe filename derived from what the pattern
 * actually looks like (palette + category + layout + seed), e.g.
 * "pastel-dream-botanical-half-drop-seamless-pattern-x7k2p9.svg". */
export function buildExportFilename(parts: string[], seed: string, suffix = ''): string {
  const slug = parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeSeed = seed.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seed';
  return `${slug}-seamless-pattern-${safeSeed}${suffix}.svg`;
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSvgFile(filename: string, svgString: string) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlobFile(filename.endsWith('.svg') ? filename : `${filename}.svg`, blob);
}
