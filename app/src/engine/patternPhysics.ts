import type { Placement } from './types';
import { periodicOffset } from './svgGeometry';
import { ROLE_IMPORTANCE } from './hierarchy';

// Pattern Physics (Composition Intelligence Foundation V2, Section 8) — a
// deterministic, geometry-only attraction pass: every placement drifts a
// bounded fraction of the way toward its nearest strictly-more-important
// neighbor (`ROLE_IMPORTANCE` from engine/hierarchy.ts — the same hero >
// secondary > filler > accent ranking paint order already uses, not a
// second vocabulary). This is the real mechanism behind the brief's
// example rules ("flower attracts leaves", "berries stay near branches")
// expressed at the geometry level this engine actually models — a role,
// not a botanical part — so no isolated decorative object is left with no
// visual anchor nearby. Pure and rng-free, like the rest of
// engine/compositionIntelligence.ts, so it composes safely in any pass
// order without disturbing seed determinism.

/** How far (relative to the pattern's own typical spacing) a placement will
 * reach to find something to be attracted to — bounded so a filler never
 * gets yanked clear across the tile toward a distant hero. */
const MAX_ATTRACT_RADIUS_FACTOR = 2.2;

function medianNearestNeighborDist(placements: Placement[], tileSize: number): number {
  if (placements.length < 2) return tileSize;
  const dists = placements
    .map((p, i) => {
      let best = Infinity;
      placements.forEach((o, j) => {
        if (i === j) return;
        const { dx, dy } = periodicOffset(p, o, tileSize);
        const d = Math.hypot(dx, dy);
        if (d < best) best = d;
      });
      return best;
    })
    .filter((d) => Number.isFinite(d));
  if (dists.length === 0) return tileSize;
  const sorted = [...dists].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** For each placement, finds its nearest strictly-higher-importance
 * neighbor (skipping placements with no role, or already the most
 * important role present) and pulls it a `strength`-controlled fraction of
 * the way toward that neighbor, bounded to a real local radius derived
 * from the pattern's own median spacing — never a fixed pixel constant, so
 * it scales correctly with density/motif size/tile size. A no-op when no
 * placement carries a role at all (nothing to attract toward). */
export function applyAttraction(placements: Placement[], tileSize: number, strength: number): Placement[] {
  if (strength <= 0 || placements.length < 2) return placements;
  const withImportance = placements.map((p) => ({ p, importance: p.role ? ROLE_IMPORTANCE[p.role] : 0 }));
  const hasAnyRole = withImportance.some((e) => e.importance > 0);
  if (!hasAnyRole) return placements;

  const radius = medianNearestNeighborDist(placements, tileSize) * MAX_ATTRACT_RADIUS_FACTOR;
  const maxPull = 0.4 * strength;

  return withImportance.map((entry) => {
    let target: Placement | null = null;
    let bestDist = Infinity;
    for (const other of withImportance) {
      if (other === entry || other.importance <= entry.importance) continue;
      const { dx, dy } = periodicOffset(entry.p, other.p, tileSize);
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        target = other.p;
      }
    }
    if (!target || bestDist > radius) return entry.p;
    const { dx, dy } = periodicOffset(entry.p, target, tileSize);
    return { ...entry.p, x: entry.p.x + dx * maxPull, y: entry.p.y + dy * maxPull };
  });
}
