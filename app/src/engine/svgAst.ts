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

// --- Automatic bounding-radius computation -------------------------------
//
// Every generator variant hand-declares an approximate `radius` for the
// engine's wrap-clone decision (see engine/tile.ts). Hand estimates are
// easy to get subtly wrong for off-center appendages (ears, rays, curling
// leaves) — an underestimate means a motif near the tile edge silently
// loses its wrap-around copy, which shows up as a visible seam. To make
// that whole bug class impossible, the engine also computes a geometric
// bound directly from the actual shape data (circles, paths, polygons...)
// and takes the max of the two. This walks the real SvgNode tree through
// its own nested transforms, so it's correct regardless of how a motif is
// built internally.

export type Matrix = [number, number, number, number, number, number]; // a b c d e f

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function matMul(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMat(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Parse a `transform` attribute string composed of translate/rotate/scale
 * calls (the only functions this codebase ever emits) into one matrix. */
export function parseTransform(str: string): Matrix {
  let acc = IDENTITY;
  const re = /(translate|rotate|scale)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const nums = m[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let next: Matrix = IDENTITY;
    if (m[1] === 'translate') {
      next = [1, 0, 0, 1, nums[0] ?? 0, nums[1] ?? 0];
    } else if (m[1] === 'scale') {
      const sx = nums[0] ?? 1;
      const sy = nums.length > 1 ? nums[1] : sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (m[1] === 'rotate') {
      const rad = ((nums[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rotMat: Matrix = [cos, sin, -sin, cos, 0, 0];
      if (nums.length >= 3) {
        const [cx, cy] = [nums[1], nums[2]];
        next = matMul(matMul([1, 0, 0, 1, cx, cy], rotMat), [1, 0, 0, 1, -cx, -cy]);
      } else {
        next = rotMat;
      }
    }
    acc = matMul(acc, next);
  }
  return acc;
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0;
}

/** Extract every "extremal" local point from a path's `d` string, each
 * paired with an extra pad (used for arc radii). Bezier control points are
 * included even though the curve itself stays within their convex hull —
 * that makes this a guaranteed upper bound, never an underestimate. */
function pathPoints(d: string): Array<{ x: number; y: number; pad: number }> {
  const pts: Array<{ x: number; y: number; pad: number }> = [];
  let curX = 0;
  let curY = 0;
  const re = /([MLCQAZ])([^MLCQAZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    switch (m[1]) {
      case 'M':
      case 'L':
        pts.push({ x: nums[0], y: nums[1], pad: 0 });
        curX = nums[0];
        curY = nums[1];
        break;
      case 'C':
        pts.push({ x: nums[0], y: nums[1], pad: 0 });
        pts.push({ x: nums[2], y: nums[3], pad: 0 });
        pts.push({ x: nums[4], y: nums[5], pad: 0 });
        curX = nums[4];
        curY = nums[5];
        break;
      case 'Q':
        pts.push({ x: nums[0], y: nums[1], pad: 0 });
        pts.push({ x: nums[2], y: nums[3], pad: 0 });
        curX = nums[2];
        curY = nums[3];
        break;
      case 'A': {
        const rx = nums[0];
        const ry = nums[1];
        const pad = Math.max(rx, ry);
        const x = nums[5];
        const y = nums[6];
        // Pad both the arc's start (already-visited current point) and its
        // end — the arc can bulge out near either side of its sweep.
        pts.push({ x: curX, y: curY, pad });
        pts.push({ x, y, pad });
        curX = x;
        curY = y;
        break;
      }
      // 'Z' adds no new point (closes back to the already-recorded start).
    }
  }
  return pts;
}

function circleSamplePoints(cx: number, cy: number, rx: number, ry: number, count = 24): Array<{ x: number; y: number; pad: number }> {
  const pts: Array<{ x: number; y: number; pad: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), pad: 0 });
  }
  return pts;
}

interface WorldPoint {
  x: number;
  y: number;
  pad: number;
}

/** Walks the node tree applying every nested transform, and returns every
 * "extremal" point (already in the root's own coordinate space) each
 * shape's geometry contributes, plus a per-point pad (stroke half-width +
 * arc radius, where relevant) — the single shared point-extraction pass
 * both `computeBoundingRadius` and `computeBoundingBox` fold differently. */
function collectWorldPoints(node: SvgNode, parentMatrix: Matrix = IDENTITY): WorldPoint[] {
  const ownMatrix = node.attrs?.transform ? parseTransform(String(node.attrs.transform)) : IDENTITY;
  const combined = matMul(parentMatrix, ownMatrix);
  const strokePad = node.attrs?.['stroke-width'] ? num(node.attrs['stroke-width']) / 2 : 0;

  let localPoints: Array<{ x: number; y: number; pad: number }> = [];
  const a = node.attrs ?? {};
  switch (node.tag) {
    case 'circle':
      localPoints = circleSamplePoints(num(a.cx), num(a.cy), num(a.r), num(a.r));
      break;
    case 'ellipse':
      localPoints = circleSamplePoints(num(a.cx), num(a.cy), num(a.rx), num(a.ry));
      break;
    case 'rect': {
      const x = num(a.x);
      const y = num(a.y);
      const w = num(a.width);
      const hgt = num(a.height);
      localPoints = [
        { x, y, pad: 0 },
        { x: x + w, y, pad: 0 },
        { x, y: y + hgt, pad: 0 },
        { x: x + w, y: y + hgt, pad: 0 },
      ];
      break;
    }
    case 'line':
      localPoints = [
        { x: num(a.x1), y: num(a.y1), pad: 0 },
        { x: num(a.x2), y: num(a.y2), pad: 0 },
      ];
      break;
    case 'polygon':
    case 'polyline':
      localPoints = String(a.points ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((pair) => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y, pad: 0 };
        });
      break;
    case 'path':
      localPoints = pathPoints(String(a.d ?? ''));
      break;
    default:
      break;
  }

  const worldPoints: WorldPoint[] = localPoints.map((p) => {
    const [x, y] = applyMat(combined, p.x, p.y);
    return { x, y, pad: p.pad + strokePad };
  });

  for (const child of node.children ?? []) {
    worldPoints.push(...collectWorldPoints(child, combined));
  }

  return worldPoints;
}

/** True geometric bounding radius (max distance from the origin, in the
 * root motif's own coordinate space) of everything this node tree draws,
 * accounting for every nested transform and for stroke width. */
export function computeBoundingRadius(node: SvgNode, parentMatrix: Matrix = IDENTITY): number {
  let maxDist = 0;
  for (const p of collectWorldPoints(node, parentMatrix)) {
    const d = Math.hypot(p.x, p.y) + p.pad;
    if (d > maxDist) maxDist = d;
  }
  return maxDist;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** Axis-aligned bounding box (in the root motif's own coordinate space) of
 * everything this node tree draws — same transform/stroke-aware point set
 * `computeBoundingRadius` uses, folded into a box instead of a radius.
 * Falls back to a 1x1 box centered on the origin for an empty/degenerate
 * tree so callers never divide by a zero-size box. */
export function computeBoundingBox(node: SvgNode, parentMatrix: Matrix = IDENTITY): BoundingBox {
  const points = collectWorldPoints(node, parentMatrix);
  if (points.length === 0) return { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5, width: 1, height: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x - p.pad < minX) minX = p.x - p.pad;
    if (p.x + p.pad > maxX) maxX = p.x + p.pad;
    if (p.y - p.pad < minY) minY = p.y - p.pad;
    if (p.y + p.pad > maxY) maxY = p.y + p.pad;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
