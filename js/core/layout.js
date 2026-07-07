import { range } from './rng.js';

export const COMPOSITIONS = ['S-Curve Flow', 'Diagonal Drift', 'Grid Balanced', 'Half-Drop Brick', 'Scatter Airy'];

export const PATTERN_TYPES = ['Hero Motif', 'Secondary Motif', 'Coordinate Texture', 'Mini Ditsy', 'Blender Texture'];

// Normalized (0..1) anchor fractions per composition, used to place the
// hero-tier motifs. "Scatter Airy" has no fixed set — it is generated
// randomly per-seed instead.
const FRACTION_SETS = {
  'S-Curve Flow': [
    [0.08, 0.08], [0.30, 0.14], [0.55, 0.08], [0.80, 0.16],
    [0.14, 0.38], [0.42, 0.44], [0.68, 0.36], [0.92, 0.42],
    [0.10, 0.68], [0.36, 0.74], [0.62, 0.66], [0.88, 0.72],
    [0.20, 0.92], [0.48, 0.88], [0.74, 0.94],
  ],
  'Diagonal Drift': [
    [0.08, 0.10], [0.26, 0.22], [0.44, 0.34], [0.62, 0.46], [0.80, 0.58],
    [0.14, 0.46], [0.32, 0.58], [0.50, 0.70], [0.68, 0.82],
    [0.18, 0.82], [0.40, 0.92], [0.86, 0.30],
  ],
  'Grid Balanced': [
    [0.12, 0.12], [0.37, 0.12], [0.62, 0.12], [0.87, 0.12],
    [0.12, 0.37], [0.37, 0.37], [0.62, 0.37], [0.87, 0.37],
    [0.12, 0.62], [0.37, 0.62], [0.62, 0.62], [0.87, 0.62],
    [0.12, 0.87], [0.37, 0.87], [0.62, 0.87], [0.87, 0.87],
  ],
  'Half-Drop Brick': [
    [0.10, 0.10], [0.35, 0.10], [0.60, 0.10], [0.85, 0.10],
    [0.225, 0.35], [0.475, 0.35], [0.725, 0.35], [0.975, 0.35],
    [0.10, 0.60], [0.35, 0.60], [0.60, 0.60], [0.85, 0.60],
    [0.225, 0.85], [0.475, 0.85], [0.725, 0.85],
  ],
};

export function heroAnchors(composition, view, rng, patternType) {
  const set = FRACTION_SETS[composition];
  const fractions = set || Array.from({ length: 14 }, () => [range(rng, 0.08, 0.92), range(rng, 0.08, 0.92)]);
  let anchors = fractions.map(([fx, fy], i) => ({
    x: fx * view + range(rng, -view * 0.012, view * 0.012),
    y: fy * view + range(rng, -view * 0.012, view * 0.012),
    rot: i % 2 ? range(rng, 8, 26) : range(rng, -26, -8),
  }));
  if (patternType === 'Coordinate Texture' || patternType === 'Mini Ditsy') {
    anchors = anchors.filter((_, i) => i % 2 === 0);
  }
  return anchors;
}

// Duplicates a point across the tile edges/corners it's close enough to,
// so motifs near a border reappear on the opposite side for a seamless repeat.
export function wrapCopies(x, y, view, margin) {
  const left = x < margin, right = x > view - margin;
  const top = y < margin, bottom = y > view - margin;
  const out = [[x, y]];
  if (left) out.push([x + view, y]);
  if (right) out.push([x - view, y]);
  if (top) out.push([x, y + view]);
  if (bottom) out.push([x, y - view]);
  if (left && top) out.push([x + view, y + view]);
  if (right && bottom) out.push([x - view, y - view]);
  if (left && bottom) out.push([x + view, y - view]);
  if (right && top) out.push([x - view, y + view]);
  return out;
}

export function occupancyGuard() {
  const points = [];
  return (x, y, minDist) => {
    for (const p of points) {
      const dx = p[0] - x, dy = p[1] - y;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }
    points.push([x, y]);
    return true;
  };
}

export function densityProfile(patternType) {
  switch (patternType) {
    case 'Hero Motif': return { hero: 1, secondary: 0.4, filler: 0.5, accent: 0.6, heroScale: 1 };
    case 'Secondary Motif': return { hero: 0, secondary: 1.3, filler: 0.8, accent: 0.7, heroScale: 0.85 };
    case 'Coordinate Texture': return { hero: 0, secondary: 0.5, filler: 1.4, accent: 0.7, heroScale: 0.65 };
    case 'Mini Ditsy': return { hero: 0, secondary: 0.2, filler: 0.9, accent: 1.6, heroScale: 0.45 };
    default: return { hero: 0, secondary: 0.05, filler: 0.3, accent: 2.2, heroScale: 0.35 }; // Blender Texture
  }
}
