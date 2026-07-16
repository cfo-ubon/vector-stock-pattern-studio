// Real color-space math shared by the Trend Intelligence Engine (and
// anything else that needs to reason about a palette's actual character
// rather than just its hex strings) — HSL conversion, circular hue
// statistics (hue wraps at 360deg, so a plain arithmetic mean is wrong),
// and hue-distance for "how far is this color from that hue band".

export interface Hsl {
  h: number; // degrees, 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function hexToHsl(hex: string): Hsl {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0.5 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return { h, s, l };
}

/** Circular mean of a set of hues (degrees) — a plain arithmetic mean of
 * e.g. 350 and 10 would wrongly give 180 (green) instead of 0 (red). */
export function meanHue(hues: number[]): number {
  if (hues.length === 0) return 0;
  let sx = 0;
  let sy = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    sx += Math.cos(rad);
    sy += Math.sin(rad);
  }
  const rad = Math.atan2(sy / hues.length, sx / hues.length);
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function circularHueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export interface ColorSetStats {
  meanHue: number;
  meanSaturation: number;
  meanLightness: number;
}

/** Aggregate stats for a resolved color array (colors[0] is the tile
 * background, the rest are accents — see palettes/palettes.ts). Near-gray
 * colors (s < 0.08) are excluded from the hue mean since their hue is
 * essentially noise, but still count toward saturation/lightness. */
export function colorSetStats(colors: string[]): ColorSetStats {
  const accents = colors.length > 1 ? colors.slice(1) : colors;
  const hsls = accents.map(hexToHsl);
  const hues = hsls.filter((c) => c.s > 0.08).map((c) => c.h);
  const meanSaturation = hsls.reduce((a, c) => a + c.s, 0) / hsls.length;
  const meanLightness = hsls.reduce((a, c) => a + c.l, 0) / hsls.length;
  return { meanHue: hues.length > 0 ? meanHue(hues) : 0, meanSaturation, meanLightness };
}

/** Build 011, Section 1/3 (Artistic Balance Engine / Color Harmony
 * Intelligence): a single real, bounded (0-1) "how visually loud is this
 * resolved palette" score — shared by both sections rather than computed
 * twice. Blends mean accent saturation (vivid colors read as energetic)
 * with lightness *range* (a palette spanning near-black to near-white
 * accents reads as high-contrast/punchy; a palette whose accents cluster
 * around one lightness band reads as quiet/tonal) — both real HSL
 * measurements of the actual resolved hex colors a tile will draw with,
 * never a hand-typed per-palette score. A single flat-gray palette (no
 * saturation, no lightness spread) returns 0; a maximally saturated
 * palette spanning the full lightness range returns 1. */
/** Build 011, Section 3 (Color Harmony Intelligence): which accent color
 * (index into `colors.slice(1)`, i.e. everything except the background)
 * genuinely reads as the palette's own dominant hue — the real,
 * highest-saturation accent, ties broken toward the first occurrence. A
 * real, computed replacement for "just roll a uniformly random accent
 * index every time", so the same palette's own naturally boldest color
 * consistently leads instead of every accent being equally likely to be
 * treated as the tile's dominant color. Returns 0 for a single- or
 * zero-accent palette (nothing to choose between). */
export function computeDominantAccentIndex(colors: string[]): number {
  const accents = colors.length > 1 ? colors.slice(1) : colors;
  if (accents.length <= 1) return 0;
  let bestIndex = 0;
  let bestSaturation = -1;
  accents.forEach((c, i) => {
    const { s } = hexToHsl(c);
    if (s > bestSaturation) {
      bestSaturation = s;
      bestIndex = i;
    }
  });
  return bestIndex;
}

export function computePaletteEnergy(colors: string[]): number {
  const accents = colors.length > 1 ? colors.slice(1) : colors;
  if (accents.length === 0) return 0;
  const hsls = accents.map(hexToHsl);
  const meanSaturation = hsls.reduce((a, c) => a + c.s, 0) / hsls.length;
  const lightnesses = hsls.map((c) => c.l);
  const lightnessRange = Math.max(...lightnesses) - Math.min(...lightnesses);
  return Math.max(0, Math.min(1, meanSaturation * 0.65 + lightnessRange * 0.35));
}
