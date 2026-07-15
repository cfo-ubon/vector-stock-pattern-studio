import type { GenerateParams, Motif, Rng, SvgNode } from './types';
import { createRng } from './rng';
import { h, computeBoundingBox, computeBoundingRadius, round, type BoundingBox } from './svgAst';
import { countNodes } from './svgGeometry';
import { GENERATORS } from '../generators';
import { resolveColors, getPalette } from '../palettes/palettes';

// Motif Factory (Professional Asset Factory Engine, roadmap milestone PAF)
// — every other engine module before this one treats a "motif" as purely
// ephemeral: engine/tile.ts's placement loop calls a generator's
// `createMotif` once per placement and immediately wraps/discards the
// result. This module is what's genuinely new: it calls the *same*
// generator functions independently of any tile placement and keeps the
// result as a standalone, inspectable, taggable object — the basis for
// every non-seamless-tile asset type in a Collection (Single Motif Library,
// Spot Motif Sheet, Background Elements, Decorative Icons, and the motifs a
// Border/Corner strip places).

export type MotifFamily =
  | 'flower' | 'leaf' | 'branch' | 'berry' | 'icon' | 'decorative' | 'background' | 'geometric';

export type MotifRole = 'hero' | 'secondary' | 'filler' | 'accent' | 'icon' | 'background';

/** Every registered category's dominant motif family — a plain lookup
 * table (not a chain of if/else per category) driving family tagging. Most
 * categories draw more than one kind of shape internally, so this names
 * whichever family best characterizes what that category is *for*. */
const CATEGORY_FAMILY: Record<string, MotifFamily> = {
  botanical: 'flower',
  tropical: 'leaf',
  organic: 'background',
  boho: 'decorative',
  lineart: 'decorative',
  mandala: 'decorative',
  damask: 'decorative',
  cute: 'icon',
  seasonal: 'icon',
  retro: 'decorative',
  plaid: 'background',
  animalprint: 'background',
  paisley: 'decorative',
  terrazzo: 'background',
  geometric: 'geometric',
};

export function familyForCategory(categoryId: string): MotifFamily {
  return CATEGORY_FAMILY[categoryId] ?? 'decorative';
}

export interface MotifAnchor {
  /** 'base' = bottom-center of the bounding box (how the motif "roots"),
   * 'tip' = top-center, 'center' = geometric center — derived purely from
   * the real computed bounding box, not hand-authored attachment metadata
   * (no such data exists in any generator today). */
  label: 'base' | 'tip' | 'center';
  x: number;
  y: number;
}

export interface MotifBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface FactoryMotif {
  id: string;
  family: MotifFamily;
  role: MotifRole;
  category: string;
  styleDnaId?: string;
  node: SvgNode;
  radius: number;
  bounds: MotifBounds;
  anchors: MotifAnchor[];
  /** 0..100 — node count relative to a typical single-motif complexity
   * ceiling (COMPLEXITY_NODE_CEILING), clamped. A real structural measure
   * (reuses svgGeometry.ts's countNodes), not a hardcoded score. */
  complexity: number;
  /** Hex colors from the resolved palette that this specific motif's SVG
   * actually references (scanned from real fill/stroke attribute values),
   * not just "whatever colors were available" — an empty-fill/pure-line
   * motif can genuinely reference only one or two. */
  colorRoles: string[];
  tags: string[];
}

function anchorsFromBounds(bounds: BoundingBox): MotifAnchor[] {
  const cx = (bounds.minX + bounds.maxX) / 2;
  return [
    { label: 'base', x: round(cx), y: round(bounds.maxY) },
    { label: 'tip', x: round(cx), y: round(bounds.minY) },
    { label: 'center', x: round(cx), y: round((bounds.minY + bounds.maxY) / 2) },
  ];
}

const COMPLEXITY_NODE_CEILING = 60;

function computeComplexity(node: SvgNode): number {
  const nodes = countNodes(node);
  return Math.round(Math.max(0, Math.min(100, (nodes / COMPLEXITY_NODE_CEILING) * 100)));
}

/** Scans every fill/stroke attribute value in the tree and keeps whichever
 * ones are real hex colors from the resolved palette (case-insensitive,
 * skips 'none'/unset) — real per-motif usage, not the full palette. */
function usedColorsFromPalette(node: SvgNode, palette: string[]): string[] {
  const paletteLower = new Map(palette.map((c) => [c.toLowerCase(), c]));
  const found = new Set<string>();
  const walk = (n: SvgNode) => {
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

/** Builds one standalone FactoryMotif by calling a category's real
 * `createMotif` directly (the exact same function `tile.ts` calls per
 * placement) — independent of any tile/layout, tagged with the metadata a
 * Collection asset needs to track relationships and describe its library.
 * `index` is the caller-supplied position within its own motif set (used
 * as both the id suffix and the generator's `colorSeed`) — deliberately not
 * a module-level counter, so the exact same call always produces the exact
 * same motif regardless of how many other motifs were generated earlier in
 * the app's lifetime. */
export function createFactoryMotif(opts: {
  categoryId: string;
  rng: Rng;
  colors: string[];
  size: number;
  role: MotifRole;
  index: number;
  styleDnaId?: string;
  tags?: string[];
}): FactoryMotif {
  const generator = GENERATORS[opts.categoryId] ?? Object.values(GENERATORS)[0];
  // Build 004, Section 1: same role hint tile.ts now passes at its own
  // createMotif call site.
  const motif: Motif = generator.createMotif(opts.rng, opts.colors, opts.size, opts.index, { role: opts.role });
  const safeRadius = Math.max(motif.radius, computeBoundingRadius(motif.node));
  const bounds = computeBoundingBox(motif.node);
  return {
    id: `motif-${generator.id}-${opts.role}-${opts.index}`,
    family: familyForCategory(generator.id),
    role: opts.role,
    category: generator.id,
    styleDnaId: opts.styleDnaId,
    node: motif.node,
    radius: safeRadius,
    bounds,
    anchors: anchorsFromBounds(bounds),
    complexity: computeComplexity(motif.node),
    colorRoles: usedColorsFromPalette(motif.node, opts.colors),
    tags: [generator.id, opts.role, familyForCategory(generator.id), ...(opts.tags ?? [])],
  };
}

/** Generates `count` independent motifs for one category, deterministically
 * derived from `baseSeed` (never `Math.random`) — the basis for Single
 * Motif Library / Spot Motif Sheet / Background Elements / Decorative Icons.
 * `sizeMul` lets callers request a smaller/larger family member (icons and
 * background elements are drawn noticeably smaller than hero motifs). */
export function generateMotifSet(
  params: GenerateParams,
  opts: { count: number; role: MotifRole; baseSeed: string; sizeMul?: number },
): FactoryMotif[] {
  const rng = createRng(`motif-factory::${opts.baseSeed}::${opts.role}`);
  const isValidHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  const custom = params.customColors?.filter(isValidHex) ?? [];
  const colors = custom.length >= 2 ? custom.slice(0, 6) : resolveColors(getPalette(params.paletteId), params.colorCount);
  const size = params.motifSize * (opts.sizeMul ?? 1);
  const motifs: FactoryMotif[] = [];
  for (let i = 0; i < opts.count; i++) {
    motifs.push(
      createFactoryMotif({
        categoryId: params.categoryId,
        rng,
        colors,
        size,
        role: opts.role,
        index: i,
        styleDnaId: params.styleDnaId,
      }),
    );
  }
  return motifs;
}

/** Lays a set of independent motifs out in a simple reference grid, each in
 * its own identified group, on a transparent background (no background
 * rect) — the shared builder behind every "isolated motifs, SVG only"
 * Collection asset: Spot Motif Sheet, Single Motif Library, Background
 * Elements, and Decorative Icons all differ only in *which* motif set and
 * cell size they're built from, not in this layout logic. */
export function buildMotifSheet(
  motifs: FactoryMotif[],
  opts: { cols: number; cellSize: number; padding: number; idPrefix: string },
): { svg: SvgNode; width: number; height: number } {
  const { cols, cellSize, padding, idPrefix } = opts;
  const rows = Math.max(1, Math.ceil(motifs.length / cols));
  const width = cols * cellSize;
  const height = rows * cellSize;
  const targetSize = cellSize - padding * 2;

  const groups = motifs.map((motif, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellSize + cellSize / 2;
    const cy = row * cellSize + cellSize / 2;
    const naturalSize = Math.max(motif.bounds.width, motif.bounds.height) || 1;
    const scale = Math.min(targetSize / naturalSize, 6);
    const mcx = (motif.bounds.minX + motif.bounds.maxX) / 2;
    const mcy = (motif.bounds.minY + motif.bounds.maxY) / 2;
    return h(
      'g',
      { id: `${idPrefix}-${motif.id}`, transform: `translate(${round(cx)} ${round(cy)}) scale(${round(scale)}) translate(${round(-mcx)} ${round(-mcy)})` },
      [motif.node],
    );
  });

  return { svg: h('g', { id: `${idPrefix}-sheet` }, groups), width, height };
}
