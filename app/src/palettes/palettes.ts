import type { Rng } from '../engine/types';
import { rngPick } from '../engine/rng';
import { COMMERCIAL_COLOR_STORIES } from './commercialColorStories';

export interface Palette {
  id: string;
  label: string;
  /** Colors ordered lightest/background-friendly first where relevant. */
  colors: string[];
}

// Flat-design friendly palette library. Each has 6 curated colors; the UI's
// "color count" control samples the first N (kept in a pleasant order) so a
// palette still reads as coherent whether the user picks 2 or 6 colors.
export const PALETTES: Palette[] = [
  { id: 'pastel-dream', label: 'Pastel Dream', colors: ['#FFF6EC', '#FFD6E0', '#C9E4DE', '#C6DEF1', '#FBE4C8', '#DBCDF0'] },
  { id: 'earth-tone', label: 'Earth Tone', colors: ['#F4EDE4', '#D9A566', '#A9714B', '#6B4C3A', '#8F9E7B', '#3E4630'] },
  { id: 'vibrant-pop', label: 'Vibrant Pop', colors: ['#FFFFFF', '#FF3366', '#FFC93C', '#00C2A8', '#5B5FEF', '#1B1B1F'] },
  { id: 'monochrome-blue', label: 'Monochrome Blue', colors: ['#EAF2FB', '#B7D3EE', '#7FAFDD', '#4A7FB5', '#264D73', '#0F2438'] },
  { id: 'jewel-tones', label: 'Jewel Tones', colors: ['#F7F1E8', '#7A2048', '#1B4B5A', '#B8862B', '#2E5339', '#1A1423'] },
  { id: 'candy-shop', label: 'Candy Shop', colors: ['#FFFDF7', '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#B983FF'] },
  { id: 'autumn-harvest', label: 'Autumn Harvest', colors: ['#FFF3E0', '#E07A5F', '#F2CC8F', '#81B29A', '#3D405B', '#BC6C25'] },
  { id: 'ocean-breeze', label: 'Ocean Breeze', colors: ['#F0F9FA', '#A6E3E9', '#71C9CE', '#3B8686', '#0B5563', '#012E3B'] },
  { id: 'terracotta', label: 'Terracotta', colors: ['#FBF3EE', '#E2A16F', '#C46B4E', '#8C4A3A', '#4E3B31', '#D8C3A5'] },
  { id: 'mono-charcoal', label: 'Monochrome Charcoal', colors: ['#F5F5F5', '#D4D4D4', '#A3A3A3', '#737373', '#404040', '#171717'] },
  { id: 'sage-terracotta', label: 'Sage & Terracotta', colors: ['#F7F2EA', '#D8C7A1', '#9CAF88', '#C97D5D', '#5F7A61', '#7A4B3A'] },
  { id: 'blush-gold', label: 'Blush & Gold', colors: ['#FFF8F2', '#F6C9CE', '#E8A6A0', '#D4A85A', '#B76E79', '#8C5A44'] },
  { id: 'retro-sunset', label: 'Retro Sunset', colors: ['#FFF1E0', '#F7A072', '#EF6F6C', '#C4436B', '#6A3E7A', '#2E2360'] },
  { id: 'coastal-neutral', label: 'Coastal Neutral', colors: ['#F6F4EF', '#E4DCC8', '#A9BBA6', '#7C9A92', '#4E6E64', '#2F4A48'] },
  { id: 'berry-punch', label: 'Berry Punch', colors: ['#FFF6F8', '#F6A6C1', '#E4509A', '#9C2E6B', '#5A2A56', '#2B1B3D'] },
  { id: 'midnight-botanical', label: 'Midnight Botanical', colors: ['#EDE9DD', '#8FA68E', '#4A6B57', '#2E4A3F', '#1C2E2A', '#101820'] },
  { id: 'citrus-pop', label: 'Citrus Pop', colors: ['#FFFDF5', '#FFD166', '#FF8C42', '#EF476F', '#06A77D', '#073B4C'] },
  { id: 'lavender-fields', label: 'Lavender Fields', colors: ['#FBF7FD', '#E4D4F4', '#C6A9E8', '#9B7EDE', '#6B5197', '#3F2E5C'] },
  // Build 006, Section 4 (Commercial Color Story Engine): the 8 named
  // professional color stories (see `commercialColorStories.ts`, which owns
  // their real contrast/temperature/accent/neutral-balance metadata)
  // registered here as plain `Palette`s too -- purely additive at the end
  // of the array, so every existing palette's id/index/order is untouched
  // and any `paletteIds` reference (Style DNA, custom styles, saved
  // patterns) can resolve one of these 8 ids exactly like any other
  // palette, with zero special-casing anywhere else in the app.
  ...COMMERCIAL_COLOR_STORIES.map((s) => ({ id: s.id, label: s.label, colors: s.colors })),
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function randomPalette(rng: Rng): Palette {
  return rngPick(rng, PALETTES);
}

/** Alpha-blend `fg` over `bg` at the given alpha, returning a solid hex.
 * Generators use this instead of SVG `opacity` so every shape in the tile
 * is a flat opaque color — required for EPS export (PostScript has no
 * transparency) and generally safer for stock-site vector review. */
export function blendHex(fg: string, alpha: number, bg: string): string {
  const p = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const [fr, fgc, fb] = p(fg);
  const [br, bgc, bb] = p(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(mix(fr, br))}${hx(mix(fgc, bgc))}${hx(mix(fb, bb))}`;
}

/** Colors motifs should fill with: everything except the background
 * (colors[0]). Prevents motifs from randomly picking the background color
 * and visually disappearing into the tile. Generators that deliberately
 * want the background (punch-through holes, moon cutouts) still read
 * colors[0] directly. */
export function accentColors(colors: string[]): string[] {
  return colors.length > 1 ? colors.slice(1) : colors;
}

/** Resolve a palette to exactly `count` colors, keeping the first entry as
 * background-friendly and evenly sampling the rest for good spread. */
export function resolveColors(palette: Palette, count: number): string[] {
  const n = Math.max(2, Math.min(count, palette.colors.length));
  if (n === palette.colors.length) return palette.colors.slice();
  // Build 002, Section 2: n===2 needs its own direct case. The general
  // interpolation loop below always degenerates to `[colors[0], colors[1]]`
  // for n===2 (its one iteration always computes idx = round(0 * step) = 0),
  // so every `monochromeAccent`-strategy Style DNA preset that resolves to
  // n=2 (e.g. scandinavianOrganic, minimalBotanical) was silently limited to
  // the two lightest, adjacent palette entries regardless of how wide the
  // palette's actual luminance range was. Using the true two extremes fixes
  // paletteContrast without touching any palette's declared colors or the
  // n>=3 path (which already reaches the far end correctly).
  if (n === 2) return [palette.colors[0], palette.colors[palette.colors.length - 1]];
  const result = [palette.colors[0]];
  const rest = palette.colors.slice(1);
  const step = (rest.length - 1) / Math.max(1, n - 2);
  for (let i = 0; i < n - 1; i++) {
    const idx = Math.round(i * step);
    result.push(rest[Math.min(idx, rest.length - 1)]);
  }
  return result;
}
