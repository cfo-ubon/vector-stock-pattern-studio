import type { SvgNode, TileData } from '../engine/types';
import { h, serialize, round } from '../engine/svgAst';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const SVG_NS_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  version: '1.1',
} as const;

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

/** Single-tile export: one editable tile, viewBox matches the tile size
 * exactly. This is the file to hand to a stock site's "seamless pattern"
 * requirement, or to open in Affinity Designer for further editing. */
export function buildSingleTileSvg(tileData: TileData): string {
  const { tileSize } = tileData.params;
  const root = h(
    'svg',
    {
      ...SVG_NS_ATTRS,
      width: round(tileSize),
      height: round(tileSize),
      viewBox: `0 0 ${round(tileSize)} ${round(tileSize)}`,
    },
    [tileData.svg],
  );
  return `${XML_HEADER}\n${serialize(root)}\n`;
}

/** Pre-tiled export: `cols` x `rows` literal, fully-editable copies of the
 * tile (not <use> references) so an Affinity Designer user can select and
 * tweak any individual repeat without "expanding" anything first. */
export function buildTiledSvg(tileData: TileData, cols = 3, rows = 3): string {
  const { tileSize } = tileData.params;
  const copies: SvgNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ids = new Set<string>();
      collectIds(tileData.svg, ids);
      const idMap = new Map<string, string>();
      ids.forEach((id) => idMap.set(id, `${id}-r${r}-c${c}`));
      const cloned = remapIds(tileData.svg, idMap);
      copies.push(h('g', { transform: `translate(${round(c * tileSize)} ${round(r * tileSize)})` }, [cloned]));
    }
  }
  const root = h(
    'svg',
    {
      ...SVG_NS_ATTRS,
      width: round(tileSize * cols),
      height: round(tileSize * rows),
      viewBox: `0 0 ${round(tileSize * cols)} ${round(tileSize * rows)}`,
    },
    [h('g', { id: 'pattern-tiled' }, copies)],
  );
  return `${XML_HEADER}\n${serialize(root)}\n`;
}

export function downloadSvgFile(filename: string, svgString: string) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
