import type { MotifRole } from './hierarchy';
import { blendHex } from '../palettes/palettes';

// Build 010, Section 3 (Multi-layer Depth Engine). The audit
// (docs/build_reports/BUILD_010_AUDIT.md) found real, if implicit, depth
// ordering already shipped — per-role scale bands (engine/hierarchy.ts),
// paint-order z-layering (ROLE_LAYER_PRIORITY/sortByLayerPriority), and a
// detail-level gradient (engine/heroComplexity.ts, hero/secondary only) —
// but no distinct visual *treatment* per depth plane. This codebase has an
// explicit, tested "EPS-safe" convention that forbids real SVG opacity or
// blur entirely (see engine/types.ts's own doc comments on
// flatShadow/flatHighlight, and tile.test.ts's `feGaussianBlur` assertion),
// so atmospheric perspective can't be built the way most "depth" features
// would reach for. Every existing soft effect in this codebase expresses
// itself as a solid, pre-blended color instead (`blendHex`, already used by
// `buildFillerLayer` and every generator's own shading) — this module
// applies that exact idiom to depth: a background-reading motif (filler/
// accent) gets its own fill colors blended toward the tile's background
// color, receding it visually, while foreground roles (hero/secondary)
// stay untouched.

/** How strongly each receding role's own colors blend toward the
 * background, at `strength` 1 — accent (the smallest, most numerous,
 * most background-reading role) recedes further than filler. Hero/
 * secondary have no entry: they stay the untouched foreground plane. */
const DEPTH_RECEDE_FACTOR: Partial<Record<MotifRole, number>> = {
  filler: 0.35,
  accent: 0.55,
};

/** Blends a motif's own color array toward the tile's background color
 * (`colors[0]`) for background-reading roles (filler/accent), leaving the
 * background entry and every foreground role (hero/secondary/undefined)
 * untouched. `strength` <= 0, fewer than 2 colors, or a foreground role are
 * all strict no-ops (same array reference) — a tile that never opts into
 * `depthStrength` reproduces prior output byte-for-byte. Pure and
 * deterministic: a function of the colors/role/strength only, no rng. */
export function applyDepthColorShift(colors: string[], role: MotifRole | undefined, strength: number): string[] {
  if (strength <= 0 || colors.length < 2) return colors;
  const factor = role ? DEPTH_RECEDE_FACTOR[role] : undefined;
  if (!factor) return colors;
  const background = colors[0];
  const alpha = 1 - Math.min(1, strength) * factor;
  return colors.map((c, i) => (i === 0 ? c : blendHex(c, alpha, background)));
}
