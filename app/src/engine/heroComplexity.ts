import type { SvgNode, Rng } from './types';
import type { MotifRole } from './hierarchy';
import { h, round } from './svgAst';
import { rngRange, rngPick } from './rng';

// Hero Motif Complexity — Project Phoenix V2, Section 3: "Increasing size
// alone is NOT sufficient. When a motif becomes Hero, automatically
// increase internal complexity." Rewriting per-generator shape logic to
// draw a genuinely different, more elaborate variant for every one of the
// app's ~19 categories is a redesign of every generator, not a visual-
// quality pass — instead this module adds a real, generator-agnostic
// detail overlay (concentric ring, radiating texture/vein lines, a nested
// inner contour) on top of whatever shape a generator already drew,
// scaled by the placement's hierarchy role. This
// is applied *universally* across every category from one integration
// point (engine/tile.ts, right after `generator.createMotif`), which is
// more consistent than hand-tuning 19 separate generators would be, not a
// fallback for not doing that. Every overlay primitive is strictly
// bounded within the motif's own known radius, so it never risks a wrap-
// seam (the radius used for edge-inclusion tests in tile.ts is computed
// *before* the overlay is added and stays a valid, if slightly
// conservative, bound).

/** 0-100 — how much extra detail a role gets. Secondary gets a real but
 * smaller boost than hero (Section 4: complexity should differ by tier,
 * not just be on/off); filler and accent get none — they stay exactly the
 * generator's own baseline shape, which is what keeps them cheap in both
 * node count and visual weight relative to hero/secondary. */
const ROLE_DETAIL_LEVEL: Record<MotifRole, number> = {
  hero: 100,
  secondary: 55,
  filler: 0,
  accent: 0,
};

export function detailLevelForRole(role: MotifRole | undefined): number {
  return role ? ROLE_DETAIL_LEVEL[role] : 0;
}

/** A concentric ring outline just inside the motif's own bounding radius —
 * "inner decorative rings" (Section 3's own example). Stroke width scales
 * with `level` so hero rings read heavier than secondary ones (Section 4's
 * "Line Weight" hierarchy criterion). */
function buildInnerRing(radius: number, level: number, rng: Rng, color: string): SvgNode {
  const ringRadius = radius * rngRange(rng, 0.55, 0.72);
  const strokeWidth = radius * (0.012 + (level / 100) * 0.01);
  return h('circle', { cx: 0, cy: 0, r: round(ringRadius), fill: 'none', stroke: color, 'stroke-width': round(strokeWidth) });
}

/** Short radiating lines from near-center outward — "texture lines" /
 * "veins" (Section 3's own examples). Deliberately capped small (2-3
 * lines): this runs per hero/secondary *instance*, and a tile can easily
 * place hundreds of them (e.g. a dense radial medallion layout), so the
 * per-instance node cost has to stay low even though the *visual* effect
 * (a real radiating-vein texture) reads clearly at any count. */
function buildTextureLines(radius: number, level: number, rng: Rng, color: string): SvgNode {
  const count = level >= 90 ? 3 : 2;
  const innerR = radius * 0.15;
  const outerR = radius * rngRange(rng, 0.5, 0.68);
  const strokeWidth = radius * 0.01;
  const startAngle = rngRange(rng, 0, Math.PI * 2);
  const lines: SvgNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / count) * Math.PI * 2 + rngRange(rng, -0.12, 0.12);
    const x1 = Math.cos(angle) * innerR;
    const y1 = Math.sin(angle) * innerR;
    const x2 = Math.cos(angle) * outerR;
    const y2 = Math.sin(angle) * outerR;
    lines.push(h('line', { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), stroke: color, 'stroke-width': round(strokeWidth), 'stroke-linecap': 'round' }));
  }
  return h('g', {}, lines);
}

/** A smaller inset polygon (nested geometry / contour variation, Section
 * 3's own examples) — a rotated triangle/square/hexagon sized well inside
 * the motif's own footprint, reading as a deliberate inner-construction
 * line rather than a second competing shape. */
function buildNestedContour(radius: number, rng: Rng, color: string): SvgNode {
  const sides = rngPick(rng, [3, 4, 6] as const);
  const r = radius * rngRange(rng, 0.38, 0.52);
  const rotation = rngRange(rng, 0, 360);
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    points.push(`${round(Math.cos(angle) * r)},${round(Math.sin(angle) * r)}`);
  }
  const strokeWidth = radius * 0.014;
  return h('polygon', { points: points.join(' '), fill: 'none', stroke: color, 'stroke-width': round(strokeWidth), transform: `rotate(${round(rotation)})` });
}

export interface HeroComplexityOptions {
  role: MotifRole | undefined;
  /** The motif's own bounding radius (pre-placement-scale, local units) —
   * every overlay primitive is sized as a fraction of this, so it always
   * stays within the motif's already-known footprint. */
  radius: number;
  /** Resolved colors for this specific placement (index 0 = background) —
   * the overlay always draws in an accent color, never the background. */
  colors: string[];
}

/** Adds a real, bounded detail overlay on top of `motifNode` for hero/
 * secondary placements; returns `motifNode` completely unchanged for
 * filler/accent/undefined roles (a strict no-op — every pattern generated
 * before this existed, or any layout that never assigns a role, is
 * pixel-identical to before). Deterministic: same rng sequence position
 * always produces the same overlay.
 *
 * Trigger probabilities are deliberately conservative (average ~1-2 extra
 * nodes per secondary, ~2-3 per hero) rather than "every hero always gets
 * every primitive": this runs once per hero/secondary *instance*, and some
 * layouts place hundreds of them in one tile (a dense radial medallion, a
 * large scatter), so the per-instance cost has to stay small even though
 * the aggregate visual effect — a real ring/vein/contour on every hero,
 * lighter but still real texture on every secondary — reads clearly. */
export function applyHeroDetailOverlay(motifNode: SvgNode, opts: HeroComplexityOptions, rng: Rng): SvgNode {
  const level = detailLevelForRole(opts.role);
  if (level <= 0 || opts.radius <= 0) return motifNode;
  const accents = opts.colors.length > 1 ? opts.colors.slice(1) : opts.colors;
  const color = rngPick(rng, accents);
  const levelFrac = level / 100;

  const overlays: SvgNode[] = [];
  if (rng() < levelFrac * 0.7) overlays.push(buildInnerRing(opts.radius, level, rng, color));
  if (rng() < levelFrac * 0.4) overlays.push(buildTextureLines(opts.radius, level, rng, color));
  if (level >= 90 && rng() < 0.35) overlays.push(buildNestedContour(opts.radius, rng, color));

  if (overlays.length === 0) return motifNode;
  return h('g', {}, [motifNode, ...overlays]);
}
