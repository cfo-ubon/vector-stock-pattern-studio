import type { Placement, Rng } from './types';
import { rngRange } from './rng';

export type MotifRole = 'hero' | 'secondary' | 'filler' | 'accent';

/** Visual hierarchy controls: what proportion of placements become each
 * role, and how much each role's own scale gets multiplied. Unlike the
 * ad-hoc hero/filler tiering baked into 4 individual layout files
 * (heroFlow, heroScatter, bouquet, densePremium — which already satisfy
 * "hierarchy" on their own and are skipped by applyHierarchy below to
 * avoid double-compounding), this is a layout-agnostic post-process pass
 * that gives every OTHER layout (grid, scatter, half-drop, s-curve, airy,
 * toss, ...) the same explicit, user-controllable hero/secondary/filler/
 * accent tiering for the first time. */
export interface HierarchyParams {
  heroRatio: number;
  secondaryRatio: number;
  fillerRatio: number;
  accentRatio: number;
  heroScale: number;
  secondaryScale: number;
  fillerScale: number;
  accentScale: number;
}

export const DEFAULT_HIERARCHY: HierarchyParams = {
  heroRatio: 0.12,
  secondaryRatio: 0.38,
  fillerRatio: 0.35,
  accentRatio: 0.15,
  heroScale: 1.6,
  secondaryScale: 1.0,
  fillerScale: 0.55,
  accentScale: 0.25,
};

export const HIERARCHY_PRESETS: Record<string, { label: string; value: HierarchyParams }> = {
  heroFocus: {
    label: 'Hero Focus',
    value: { heroRatio: 0.3, secondaryRatio: 0.35, fillerRatio: 0.25, accentRatio: 0.1, heroScale: 2.4, secondaryScale: 1.1, fillerScale: 0.5, accentScale: 0.2 },
  },
  balancedEditorial: { label: 'Balanced Editorial', value: DEFAULT_HIERARCHY },
  denseLayered: {
    label: 'Dense Layered',
    value: { heroRatio: 0.08, secondaryRatio: 0.32, fillerRatio: 0.45, accentRatio: 0.15, heroScale: 1.8, secondaryScale: 1.0, fillerScale: 0.6, accentScale: 0.3 },
  },
  airyPremium: {
    label: 'Airy Premium',
    value: { heroRatio: 0.06, secondaryRatio: 0.24, fillerRatio: 0.5, accentRatio: 0.2, heroScale: 2.0, secondaryScale: 0.9, fillerScale: 0.4, accentScale: 0.15 },
  },
  ditsyFloral: {
    label: 'Ditsy Floral',
    value: { heroRatio: 0.03, secondaryRatio: 0.17, fillerRatio: 0.55, accentRatio: 0.25, heroScale: 1.5, secondaryScale: 0.8, fillerScale: 0.35, accentScale: 0.15 },
  },
  allOverTextile: {
    label: 'All-over Textile',
    value: { heroRatio: 0.05, secondaryRatio: 0.55, fillerRatio: 0.3, accentRatio: 0.1, heroScale: 1.3, secondaryScale: 1.0, fillerScale: 0.65, accentScale: 0.3 },
  },
  minimalRepeat: {
    label: 'Minimal Repeat',
    value: { heroRatio: 0.02, secondaryRatio: 0.7, fillerRatio: 0.2, accentRatio: 0.08, heroScale: 1.2, secondaryScale: 1.0, fillerScale: 0.7, accentScale: 0.35 },
  },
};

/** Layouts that already build their own explicit hero/secondary/filler
 * tiers internally — applying the generic hierarchy pass on top would
 * multiply an already-large hero by heroScale again (double-compounding),
 * distorting the hand-tuned composition instead of improving it. */
export const HIERARCHY_EXEMPT_LAYOUTS = new Set(['heroFlow', 'heroScatter', 'bouquet', 'densePremium']);

function normalizeRatios(h: HierarchyParams): [number, number, number, number] {
  const sum = h.heroRatio + h.secondaryRatio + h.fillerRatio + h.accentRatio;
  if (sum <= 0) return [0, 1, 0, 0];
  return [h.heroRatio / sum, h.secondaryRatio / sum, h.fillerRatio / sum, h.accentRatio / sum];
}

/** Assigns hero/secondary/filler/accent to each placement deterministically
 * from the seeded rng, then multiplies its existing scale by the role's
 * scale factor — composes with whatever scale variation the layout itself
 * already produced rather than replacing it. */
export function applyHierarchy(placements: Placement[], hierarchy: HierarchyParams, rng: Rng): Placement[] {
  const [heroP, secondaryP, fillerP] = normalizeRatios(hierarchy);
  return placements.map((p) => {
    const t = rng();
    let role: MotifRole;
    let mul: number;
    if (t < heroP) {
      role = 'hero';
      mul = hierarchy.heroScale;
    } else if (t < heroP + secondaryP) {
      role = 'secondary';
      mul = hierarchy.secondaryScale;
    } else if (t < heroP + secondaryP + fillerP) {
      role = 'filler';
      mul = hierarchy.fillerScale;
    } else {
      role = 'accent';
      mul = hierarchy.accentScale;
    }
    // A touch of independent per-instance variation so same-role motifs
    // don't all land at exactly the same scale.
    const wobble = 1 + rngRange(rng, -0.06, 0.06);
    return { ...p, role, scale: Math.max(0.05, p.scale * mul * wobble) };
  });
}
