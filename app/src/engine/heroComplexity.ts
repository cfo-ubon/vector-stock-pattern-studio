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
//
// Build 001.1, Section 1 (Hero Complexity Engine): the brief's "increasing
// size alone is NOT sufficient" applies to this overlay's own first
// iteration too — Build 001 shipped 3 primitives (ring, texture lines,
// nested contour). This build adds `buildDecorativeDots` (Decorative
// Shapes / Micro Decorations) and `buildAccentArc` (a hero-only
// Supporting Accent Element), so a hero motif is richer along more of the
// brief's own named axes, not just "the same 3 primitives, more often".
// Style DNA stays intact throughout: every primitive draws in a color
// already resolved for this placement (`opts.colors`) and never reaches
// past the motif's own established radius or introduces a new color, so
// the overlay reads as "this motif, more detailed" rather than a
// stylistically foreign sticker.

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

/** Build 011, Section 6 (Premium Detail Distribution): the brief's "hero
 * highest, secondary medium, background simplified" implies background
 * (filler) still carries *some* detail, just clearly less than secondary —
 * a flat 0 makes filler indistinguishable from accent, i.e. "simplified"
 * reads as "featureless" instead. Opt-in via `detailDistribution` (below)
 * so every existing caller/preset that never sets it keeps the exact prior
 * two-tier behavior. */
const ROLE_DETAIL_LEVEL_DISTRIBUTED: Record<MotifRole, number> = {
  hero: 100,
  secondary: 55,
  filler: 15,
  accent: 0,
};

export function detailLevelForRole(role: MotifRole | undefined, distributed?: boolean): number {
  if (!role) return 0;
  return (distributed ? ROLE_DETAIL_LEVEL_DISTRIBUTED : ROLE_DETAIL_LEVEL)[role];
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

/** Build 001.1, Section 1 (Hero Complexity Engine) — "Decorative Shapes" /
 * "Micro Decorations": a small ring of tiny filled dots just outside the
 * motif's own core, evenly spaced but with a jittered start angle so the
 * ring itself never reads as identical between instances. Hero-only
 * (like `buildNestedContour`/`buildAccentArc`) and capped small — a tile
 * can place hundreds of hero+secondary instances, so keeping this off
 * secondary specifically (which Build 001 already gave a ring + texture
 * lines) keeps the aggregate node cost bounded even in dense layouts. */
function buildDecorativeDots(radius: number, rng: Rng, color: string): SvgNode {
  const count = rngPick(rng, [3, 4] as const);
  const ringR = radius * rngRange(rng, 0.72, 0.85);
  const dotR = radius * 0.05;
  const startAngle = rngRange(rng, 0, Math.PI * 2);
  const dots: SvgNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / count) * Math.PI * 2;
    dots.push(h('circle', { cx: round(Math.cos(angle) * ringR), cy: round(Math.sin(angle) * ringR), r: round(dotR), fill: color }));
  }
  return h('g', {}, dots);
}

/** Build 001.1, Section 1 — "Supporting Accent Element": a single short,
 * off-center arc stroke, reading as a highlight/accent mark rather than a
 * structural line — hero-only (Section 4's "complexity should differ by
 * tier", and this is deliberately the richest, most hero-exclusive
 * primitive here alongside the nested contour). Drawn via a two-point
 * quadratic path rather than a full circle so it stays a partial,
 * asymmetric mark instead of one more concentric ring. */
function buildAccentArc(radius: number, rng: Rng, color: string): SvgNode {
  const arcR = radius * rngRange(rng, 0.58, 0.7);
  const startAngle = rngRange(rng, 0, Math.PI * 2);
  const sweep = rngRange(rng, 0.9, 1.6); // radians — a partial arc, never a full ring
  const endAngle = startAngle + sweep;
  const x1 = Math.cos(startAngle) * arcR;
  const y1 = Math.sin(startAngle) * arcR;
  const x2 = Math.cos(endAngle) * arcR;
  const y2 = Math.sin(endAngle) * arcR;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const strokeWidth = radius * 0.016;
  const d = `M ${round(x1)} ${round(y1)} A ${round(arcR)} ${round(arcR)} 0 ${largeArc} 1 ${round(x2)} ${round(y2)}`;
  return h('path', { d, fill: 'none', stroke: color, 'stroke-width': round(strokeWidth), 'stroke-linecap': 'round' });
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
  /** Build 001.1, Section 1: total placement count on this tile, when the
   * caller already knows it (`engine/tile.ts` does). Optional and unused
   * below 400 instances — only damps the two newest, hero-only primitives
   * (`buildDecorativeDots`/`buildAccentArc`) once a tile's own instance
   * count is high enough that their aggregate node cost, multiplied
   * across every hero, becomes the difference between fitting inside
   * `knowledge/rules`' hard SVG node budget and not. Undefined behaves as
   * "no damping" — every existing caller/test that never passes this
   * field is completely unaffected. */
  instanceCount?: number;
  /** Build 005, Section 7 (Premium Detail System): this placement's own
   * final rendered scale multiplier (`engine/types.ts`'s `Placement.scale`
   * — already computed by hierarchy/cluster/physics, not a new number).
   * Refines the role-based `level` continuously by *actual* rendered
   * size ("zoom level"), not just discrete role tiers — a hero placed
   * unusually large for its role (a wide scaleJitter roll, a strong
   * cluster hero scale) gets a real detail boost past its role's own
   * baseline; one placed unusually small for its role gets pulled back
   * toward filler-like simplicity, maintaining SVG efficiency at the low
   * end. Undefined leaves the pre-existing role-only behavior unchanged
   * (every caller that predates this option). */
  relativeScale?: number;
  /** Build 011, Section 6 (Premium Detail Distribution): selects
   * `ROLE_DETAIL_LEVEL_DISTRIBUTED` (filler gets a small nonzero level)
   * instead of the original flat `ROLE_DETAIL_LEVEL` (filler always 0).
   * Undefined/false reproduces the exact prior two-tier behavior — a
   * strict no-op for every caller/preset that doesn't set it. */
  detailDistribution?: boolean;
}

/** 1.0 at a baseline (unscaled) placement, growing toward 1.25 for a
 * large instance and shrinking toward ~0.7-0.9 for a small one — a
 * continuous, bounded refinement, never a replacement for the role-based
 * `level` above (a filler/accent placement still gets 0 regardless of
 * how this factor evaluates; `level <= 0` short-circuits in the caller
 * before this ever gets multiplied in). */
function sizeFactorFor(relativeScale: number | undefined): number {
  if (relativeScale === undefined) return 1;
  return Math.max(0.7, Math.min(1.25, 0.85 + relativeScale * 0.2));
}

/** Above this many placements on one tile, a tile-wide "how many heroes
 * are there, really" effect makes even a small per-hero node addition
 * compound into hundreds of extra nodes — so the two newest primitives
 * scale their own trigger probability down rather than firing at their
 * normal rate on every single hero regardless of how many there are. */
const DENSITY_DAMPING_THRESHOLD = 400;

function densityDamping(instanceCount: number | undefined): number {
  if (!instanceCount || instanceCount <= DENSITY_DAMPING_THRESHOLD) return 1;
  return Math.max(0.25, DENSITY_DAMPING_THRESHOLD / instanceCount);
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
  const level = detailLevelForRole(opts.role, opts.detailDistribution);
  if (level <= 0 || opts.radius <= 0) return motifNode;
  const accents = opts.colors.length > 1 ? opts.colors.slice(1) : opts.colors;
  const color = rngPick(rng, accents);
  const levelFrac = (level / 100) * sizeFactorFor(opts.relativeScale);

  const damping = densityDamping(opts.instanceCount);
  const overlays: SvgNode[] = [];
  if (rng() < levelFrac * 0.7) overlays.push(buildInnerRing(opts.radius, level, rng, color));
  if (rng() < levelFrac * 0.4) overlays.push(buildTextureLines(opts.radius, level, rng, color));
  if (level >= 90 && rng() < 0.18 * damping) overlays.push(buildDecorativeDots(opts.radius, rng, color));
  if (level >= 90 && rng() < 0.35) overlays.push(buildNestedContour(opts.radius, rng, color));
  if (level >= 90 && rng() < 0.22 * damping) overlays.push(buildAccentArc(opts.radius, rng, color));

  if (overlays.length === 0) return motifNode;
  return h('g', {}, [motifNode, ...overlays]);
}
