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
