// Cluster Avoidance — Build 003, Part 10. `placeClusterAnchors` places
// anchors via `placeZoneAnchors` using one *average* size-based `minDist`
// for every pair, then assigns each anchor's real size afterwards from a
// fixed rhythm cycle (Build 002, Section 7) indexed by array position, not
// spatial adjacency. Two anchors that happen to land near each other can
// both draw the cycle's largest step, so their real (post-assignment)
// required separation can exceed what the average-based spacing enforced
// — two large "hero" anchors reading as visually touching or colliding.
// This module fixes that with a short pairwise-repulsion relaxation pass
// run once every anchor's real size is known.

export interface SizedPoint {
  x: number;
  y: number;
  sizeMul: number;
}

const REPULSION_ITERATIONS = 12;

function wrapCoord(v: number, tileSize: number): number {
  return ((v % tileSize) + tileSize) % tileSize;
}

/** Shortest signed delta from b to a across the tile's wrap seam. */
function wrappedDelta(a: number, b: number, tileSize: number): number {
  let d = a - b;
  if (d > tileSize / 2) d -= tileSize;
  if (d < -tileSize / 2) d += tileSize;
  return d;
}

/** Pushes any pair of anchors apart whose *actual* required separation —
 * based on their real, post-size-rhythm `sizeMul`s, not the average used
 * when anchors were first placed — exceeds their current distance. Purely
 * geometric (doesn't touch `sizeMul`), toroidal (wraps the same way anchor
 * placement already does), and a no-op for any pair that was already far
 * enough apart, so typical (average-sized) anchors are left untouched. */
export function resolveClusterCollisions(
  points: SizedPoint[],
  baseRadius: number,
  minDistMul: number,
  tileSize: number,
): SizedPoint[] {
  const result = points.map((p) => ({ ...p }));
  for (let iter = 0; iter < REPULSION_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const required = baseRadius * minDistMul * ((a.sizeMul + b.sizeMul) * 0.5);
        const dx = wrappedDelta(a.x, b.x, tileSize);
        const dy = wrappedDelta(a.y, b.y, tileSize);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < required) {
          const safeDist = dist || 0.0001;
          const deficit = (required - safeDist) / 2;
          const nx = dx / safeDist;
          const ny = dy / safeDist;
          a.x = wrapCoord(a.x + nx * deficit, tileSize);
          a.y = wrapCoord(a.y + ny * deficit, tileSize);
          b.x = wrapCoord(b.x - nx * deficit, tileSize);
          b.y = wrapCoord(b.y - ny * deficit, tileSize);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return result;
}
