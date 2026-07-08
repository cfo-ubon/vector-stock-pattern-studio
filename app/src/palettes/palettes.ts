import type { Rng } from '../engine/types';
import { rngPick } from '../engine/rng';

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
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function randomPalette(rng: Rng): Palette {
  return rngPick(rng, PALETTES);
}

/** Resolve a palette to exactly `count` colors, keeping the first entry as
 * background-friendly and evenly sampling the rest for good spread. */
export function resolveColors(palette: Palette, count: number): string[] {
  const n = Math.max(2, Math.min(count, palette.colors.length));
  if (n === palette.colors.length) return palette.colors.slice();
  const result = [palette.colors[0]];
  const rest = palette.colors.slice(1);
  const step = (rest.length - 1) / Math.max(1, n - 2);
  for (let i = 0; i < n - 1; i++) {
    const idx = Math.round(i * step);
    result.push(rest[Math.min(idx, rest.length - 1)]);
  }
  return result;
}
