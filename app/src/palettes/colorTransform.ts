// Color Transform primitives — small, generic hex<->HSL math with no
// knowledge of palettes, collections, or design intent. Collection
// Intelligence Engine Phase 4's Color Story Engine (collection/colorStory.ts)
// is the only current caller, but this file is deliberately independent of
// it (and of palettes/palettes.ts, which it does not import) so it stays a
// reusable, narrowly-scoped utility rather than growing collection-specific
// assumptions. No existing module is modified to add this — it's a new file.

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Standard RGB->HSL conversion (h in degrees, s/l as percentages). */
export function hexToHsl(hex: string): Hsl {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Standard HSL->RGB conversion, inverse of `hexToHsl`. */
export function hslToHex(hsl: Hsl): string {
  const h = ((hsl.h % 360) + 360) % 360 / 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex(v, v, v);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const r = hue2rgb(h + 1 / 3) * 255;
  const g = hue2rgb(h) * 255;
  const b = hue2rgb(h - 1 / 3) * 255;
  return rgbToHex(r, g, b);
}

/** Adds `deltaPercent` (can be negative) to a hex color's HSL lightness,
 * clamped to [0, 100]. */
export function adjustLightness(hex: string, deltaPercent: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(hsl.l + deltaPercent, 0, 100) });
}

/** Adds `deltaPercent` (can be negative) to a hex color's HSL saturation,
 * clamped to [0, 100]. */
export function adjustSaturation(hex: string, deltaPercent: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, s: clamp(hsl.s + deltaPercent, 0, 100) });
}

/** Rotates a hex color's hue by `degrees` (wraps around 360). */
export function rotateHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

/** Overrides a hex color's HSL lightness outright (not additive) — used by
 * Monochrome, which needs every color pulled onto one fixed lightness
 * ladder rather than shifted relative to its own starting point. */
export function setLightness(hex: string, lightness: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(lightness, 0, 100) });
}

/** Overrides a hex color's HSL hue outright (not additive) — used by
 * Monochrome to collapse every color in a palette onto one shared hue. */
export function setHue(hex: string, hue: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: ((hue % 360) + 360) % 360 });
}
