import type { SvgNode, SvgTag } from './types';

/** Tiny hyperscript-style helper for building SvgNode trees tersely. */
export function h(tag: SvgTag, attrs: Record<string, string | number> = {}, children: SvgNode[] = []): SvgNode {
  return { tag, attrs, children };
}

function escapeAttr(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Serialize an SvgNode tree to an XML string. This is the single renderer
 * used both to build the preview markup (injected via dangerouslySetInnerHTML)
 * and the exported .svg file, so the preview is guaranteed to match export
 * byte-for-byte in structure. Only plain SVG 1.1 attributes are emitted
 * (fill/stroke/transform/d/...) — no CSS filters or classes that a vector
 * editor like Affinity Designer might not round-trip. */
export function serialize(node: SvgNode, indent = 0): string {
  const pad = '  '.repeat(indent);
  const attrs = node.attrs
    ? Object.entries(node.attrs)
        .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
        .join(' ')
    : '';
  const openTag = attrs ? `<${node.tag} ${attrs}` : `<${node.tag}`;
  const children = node.children ?? [];
  if (children.length === 0) {
    return `${pad}${openTag} />`;
  }
  const inner = children.map((c) => serialize(c, indent + 1)).join('\n');
  return `${pad}${openTag}>\n${inner}\n${pad}</${node.tag}>`;
}

/** Deep-clone a node while applying a translate offset — used to build the
 * periodic wrap-around copies for seamless tiling without mutating the
 * original motif tree. */
export function translateClone(node: SvgNode, dx: number, dy: number): SvgNode {
  return h('g', { transform: `translate(${round(dx)} ${round(dy)})` }, [node]);
}

export function round(n: number, precision = 3): number {
  const f = 10 ** precision;
  return Math.round(n * f) / f;
}

/** Build a smooth closed blob path from N radial points using a Catmull-Rom
 * -> cubic Bezier conversion, useful for organic/botanical shapes. */
export function smoothClosedPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n < 3) return '';
  const get = (i: number) => points[((i % n) + n) % n];
  let d = `M ${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2[0])} ${round(p2[1])}`;
  }
  return d + ' Z';
}

export function polygonPoints(cx: number, cy: number, r: number, sides: number, rotationDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (rotationDeg + (360 / sides) * i) * (Math.PI / 180);
    pts.push(`${round(cx + r * Math.cos(angle))},${round(cy + r * Math.sin(angle))}`);
  }
  return pts.join(' ');
}
