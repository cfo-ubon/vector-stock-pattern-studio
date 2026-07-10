import type { SvgNode, TileData } from '../engine/types';
import { type Matrix, IDENTITY, matMul, applyMat, parseTransform } from '../engine/svgAst';
import { SINGLE_EXPORT_PIXEL_SIZE } from './svgExporter';

// EPS (Encapsulated PostScript) exporter — the upload format Shutterstock,
// Adobe Stock and Freepik actually accept for vectors. Instead of driving
// PostScript's own transform stack, every coordinate (including Bézier
// control points — affine maps preserve Béziers exactly) is flattened
// through the accumulated SVG transform plus a final Y-flip, so the output
// is a plain list of absolute moveto/lineto/curveto ops any interpreter
// renders identically. The tile uses only solid fills/strokes (no
// transparency, gradients, text or rasters — see blendHex in palettes.ts),
// which is exactly the subset PostScript Level 2 supports natively.

const KAPPA = 0.5522847498307936; // 4*(sqrt(2)-1)/3 — circle-from-cubics constant

type Seg =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Z' };

interface Style {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  linecap?: string;
  linejoin?: string;
}

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function hexToRgbCmd(hex: string): string {
  const p = (s: string) => parseInt(s, 16) / 255;
  return `${fmt(p(hex.slice(1, 3)))} ${fmt(p(hex.slice(3, 5)))} ${fmt(p(hex.slice(5, 7)))} setrgbcolor`;
}

/** Average scale factor of an affine matrix — used to convert an SVG
 * stroke-width into the equivalent absolute PostScript linewidth. Our
 * transforms are translate/rotate/uniform-scale, for which this is exact. */
function matrixScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

// --- shape -> segment-list converters (local, untransformed coords) ---

function rectSegs(x: number, y: number, w: number, hgt: number, rx: number): Seg[] {
  if (rx <= 0) {
    return [
      { op: 'M', x, y },
      { op: 'L', x: x + w, y },
      { op: 'L', x: x + w, y: y + hgt },
      { op: 'L', x, y: y + hgt },
      { op: 'Z' },
    ];
  }
  const r = Math.min(rx, w / 2, hgt / 2);
  const k = r * KAPPA;
  return [
    { op: 'M', x: x + r, y },
    { op: 'L', x: x + w - r, y },
    { op: 'C', x1: x + w - r + k, y1: y, x2: x + w, y2: y + r - k, x: x + w, y: y + r },
    { op: 'L', x: x + w, y: y + hgt - r },
    { op: 'C', x1: x + w, y1: y + hgt - r + k, x2: x + w - r + k, y2: y + hgt, x: x + w - r, y: y + hgt },
    { op: 'L', x: x + r, y: y + hgt },
    { op: 'C', x1: x + r - k, y1: y + hgt, x2: x, y2: y + hgt - r + k, x, y: y + hgt - r },
    { op: 'L', x, y: y + r },
    { op: 'C', x1: x, y1: y + r - k, x2: x + r - k, y2: y, x: x + r, y },
    { op: 'Z' },
  ];
}

function ellipseSegs(cx: number, cy: number, rx: number, ry: number): Seg[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { op: 'M', x: cx + rx, y: cy },
    { op: 'C', x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { op: 'C', x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { op: 'C', x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { op: 'C', x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { op: 'Z' },
  ];
}

function polySegs(pointsAttr: string, close: boolean): Seg[] {
  const nums = pointsAttr
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const segs: Seg[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    segs.push(i === 0 ? { op: 'M', x: nums[i], y: nums[i + 1] } : { op: 'L', x: nums[i], y: nums[i + 1] });
  }
  if (close && segs.length > 0) segs.push({ op: 'Z' });
  return segs;
}

/** Convert one SVG elliptical-arc segment (endpoint parameterization) into
 * cubic Béziers — the standard center-parameterization algorithm from the
 * SVG spec appendix, splitting into <=90° slices. */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): Seg[] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ op: 'L', x: x2, y: y2 }];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;
  // Scale radii up if they can't span the endpoints
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const sign = largeArc !== sweep ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const segsCount = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segsCount;
  const t = ((4 / 3) * Math.tan(delta / 4));
  const out: Seg[] = [];
  let theta = theta1;
  for (let i = 0; i < segsCount; i++) {
    const cos1 = Math.cos(theta);
    const sin1 = Math.sin(theta);
    const theta2 = theta + delta;
    const cos2 = Math.cos(theta2);
    const sin2 = Math.sin(theta2);
    // Unit-circle points and derivatives mapped back through the ellipse
    const ep = (c: number, s: number): [number, number] => [
      cx + rx * cosP * c - ry * sinP * s,
      cy + rx * sinP * c + ry * cosP * s,
    ];
    const ed = (c: number, s: number): [number, number] => [
      -rx * cosP * s - ry * sinP * c,
      -rx * sinP * s + ry * cosP * c,
    ];
    const [p1x, p1y] = ep(cos1, sin1);
    const [d1x, d1y] = ed(cos1, sin1);
    const [p2x, p2y] = ep(cos2, sin2);
    const [d2x, d2y] = ed(cos2, sin2);
    out.push({
      op: 'C',
      x1: p1x + t * d1x,
      y1: p1y + t * d1y,
      x2: p2x - t * d2x,
      y2: p2y - t * d2y,
      x: p2x,
      y: p2y,
    });
    theta = theta2;
  }
  return out;
}

/** Parse an SVG path `d` (absolute M/L/C/Q/A/Z — the full command set our
 * generators emit) into cubic/line segments. Q is exactly re-expressed as
 * a cubic; A goes through arcToCubics. */
function pathSegs(d: string): Seg[] {
  const tokens = d.match(/[MLCQAZmlcqaz]|-?[\d.]+(?:e-?\d+)?/g) ?? [];
  const segs: Seg[] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const read = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[MLCQAZmlcqaz]$/.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') {
        segs.push({ op: 'Z' });
        cx = sx;
        cy = sy;
      }
      continue;
    }
    switch (cmd) {
      case 'M': {
        cx = read();
        cy = read();
        sx = cx;
        sy = cy;
        segs.push({ op: 'M', x: cx, y: cy });
        cmd = 'L'; // subsequent implicit pairs are lineto per SVG spec
        break;
      }
      case 'L': {
        cx = read();
        cy = read();
        segs.push({ op: 'L', x: cx, y: cy });
        break;
      }
      case 'C': {
        const x1 = read();
        const y1 = read();
        const x2 = read();
        const y2 = read();
        const x = read();
        const y = read();
        segs.push({ op: 'C', x1, y1, x2, y2, x, y });
        cx = x;
        cy = y;
        break;
      }
      case 'Q': {
        const qx = read();
        const qy = read();
        const x = read();
        const y = read();
        // Exact quadratic -> cubic elevation
        segs.push({
          op: 'C',
          x1: cx + (2 / 3) * (qx - cx),
          y1: cy + (2 / 3) * (qy - cy),
          x2: x + (2 / 3) * (qx - x),
          y2: y + (2 / 3) * (qy - y),
          x,
          y,
        });
        cx = x;
        cy = y;
        break;
      }
      case 'A': {
        const rx = read();
        const ry = read();
        const rot = read();
        const laf = read();
        const swf = read();
        const x = read();
        const y = read();
        segs.push(...arcToCubics(cx, cy, rx, ry, rot, laf, swf, x, y));
        cx = x;
        cy = y;
        break;
      }
      default:
        i++; // skip stray token defensively
    }
  }
  return segs;
}

const num = (v: string | number | undefined, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

function shapeToSegs(node: SvgNode): Seg[] | null {
  const a = node.attrs ?? {};
  switch (node.tag) {
    case 'rect':
      return rectSegs(num(a.x), num(a.y), num(a.width), num(a.height), num(a.rx));
    case 'circle':
      return ellipseSegs(num(a.cx), num(a.cy), num(a.r), num(a.r));
    case 'ellipse':
      return ellipseSegs(num(a.cx), num(a.cy), num(a.rx), num(a.ry));
    case 'line':
      return [
        { op: 'M', x: num(a.x1), y: num(a.y1) },
        { op: 'L', x: num(a.x2), y: num(a.y2) },
      ];
    case 'polygon':
      return polySegs(String(a.points ?? ''), true);
    case 'polyline':
      return polySegs(String(a.points ?? ''), false);
    case 'path':
      return pathSegs(String(a.d ?? ''));
    default:
      return null;
  }
}

function emitSegs(segs: Seg[], m: Matrix, out: string[]) {
  out.push('newpath');
  for (const s of segs) {
    if (s.op === 'Z') {
      out.push('closepath');
    } else if (s.op === 'M' || s.op === 'L') {
      const [x, y] = applyMat(m, s.x, s.y);
      out.push(`${fmt(x)} ${fmt(y)} ${s.op === 'M' ? 'moveto' : 'lineto'}`);
    } else {
      const [x1, y1] = applyMat(m, s.x1, s.y1);
      const [x2, y2] = applyMat(m, s.x2, s.y2);
      const [x, y] = applyMat(m, s.x, s.y);
      out.push(`${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`);
    }
  }
}

const LINECAP: Record<string, number> = { butt: 0, round: 1, square: 2 };
const LINEJOIN: Record<string, number> = { miter: 0, round: 1, bevel: 2 };

function walk(node: SvgNode, parentM: Matrix, parentStyle: Style, out: string[]) {
  if (node.tag === 'defs' || node.tag === 'clipPath') return; // tile-clip handled by the page clip
  const a = node.attrs ?? {};
  const m = a.transform ? matMul(parentM, parseTransform(String(a.transform))) : parentM;
  const style: Style = {
    fill: a.fill !== undefined ? String(a.fill) : parentStyle.fill,
    stroke: a.stroke !== undefined ? String(a.stroke) : parentStyle.stroke,
    strokeWidth: a['stroke-width'] !== undefined ? num(a['stroke-width']) : parentStyle.strokeWidth,
    linecap: a['stroke-linecap'] !== undefined ? String(a['stroke-linecap']) : parentStyle.linecap,
    linejoin: a['stroke-linejoin'] !== undefined ? String(a['stroke-linejoin']) : parentStyle.linejoin,
  };

  const segs = shapeToSegs(node);
  if (segs) {
    const hasFill = !!style.fill && style.fill !== 'none';
    const hasStroke = !!style.stroke && style.stroke !== 'none' && (style.strokeWidth ?? 1) > 0;
    if (hasFill || hasStroke) {
      emitSegs(segs, m, out);
      if (hasFill && hasStroke) {
        out.push(hexToRgbCmd(style.fill!), 'gsave fill grestore');
      } else if (hasFill) {
        out.push(hexToRgbCmd(style.fill!), 'fill');
      }
      if (hasStroke) {
        out.push(hexToRgbCmd(style.stroke!));
        out.push(`${fmt((style.strokeWidth ?? 1) * matrixScale(m))} setlinewidth`);
        out.push(`${LINECAP[style.linecap ?? 'butt'] ?? 0} setlinecap`);
        out.push(`${LINEJOIN[style.linejoin ?? 'miter'] ?? 0} setlinejoin`);
        out.push('stroke');
      }
    }
  }

  node.children?.forEach((c) => walk(c, m, style, out));
}

/** Build a complete EPS document for one seamless tile, scaled up to a
 * `SINGLE_EXPORT_PIXEL_SIZE`-square artboard (matching the SVG export's
 * document size) — the file's own coordinate system is the tile's
 * `tileSize`, so this is a lossless uniform scale, same as the SVG's
 * width/height-vs-viewBox trick. The whole drawing is clipped to the
 * artboard exactly like the SVG's tile-clip. */
export function buildEps(tileData: TileData): string {
  const tileSize = tileData.params.tileSize;
  const target = SINGLE_EXPORT_PIXEL_SIZE;
  const scale = target / tileSize;
  const out: string[] = [];
  out.push('%!PS-Adobe-3.0 EPSF-3.0');
  out.push(`%%BoundingBox: 0 0 ${Math.ceil(target)} ${Math.ceil(target)}`);
  out.push(`%%HiResBoundingBox: 0 0 ${fmt(target)} ${fmt(target)}`);
  out.push('%%Pages: 1');
  out.push('%%LanguageLevel: 2');
  out.push('%%EndComments');
  out.push('%%Page: 1 1');
  out.push('gsave');
  out.push(`newpath 0 0 moveto ${fmt(target)} 0 lineto ${fmt(target)} ${fmt(target)} lineto 0 ${fmt(target)} lineto closepath clip newpath`);
  // SVG y-axis points down, PostScript up, and the tile's own coordinate
  // system needs scaling up to the target artboard size — flatten both
  // into one root matrix instead of scaling the CTM (keeps the emitted
  // numbers plain and interpreter-friendly).
  const flipAndScale: Matrix = [scale, 0, 0, -scale, 0, target];
  walk(tileData.svg, matMul(flipAndScale, IDENTITY), {}, out);
  out.push('grestore');
  out.push('showpage');
  out.push('%%EOF');
  return out.join('\n') + '\n';
}
