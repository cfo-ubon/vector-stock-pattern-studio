import { adjustLightness, adjustSaturation, rotateHue, setHue, hexToHsl } from '../palettes/colorTransform';

// Color Story Engine — Commercial Collection Engine Phase 4, Section 3.
// Takes one already-resolved set of hex colors (a real Palette's colors, or
// a Design Specification's resolved `palette.colors` / a tile's actual
// `TileData.colors` — this module doesn't care which, it only operates on
// plain hex strings) and derives named palette *variants* deterministically
// via `palettes/colorTransform.ts`'s HSL primitives. Every variant keeps
// the same color count and the same background/accent ordering as the
// input — only hue/saturation/lightness shift — which is what "preserves
// visual harmony across the collection" (Section 3's own requirement)
// concretely means here: a variant is never a randomly re-rolled palette,
// it's the same palette read through one consistent, named lens.
//
// The four seasonal variants follow the standard "4-season color analysis"
// convention real colorists and surface-pattern designers already use
// (Spring = warm + bright + light, Summer = cool + soft + light, Autumn =
// warm + deep + muted, Winter = cool + deep + high-contrast) rather than an
// invented scheme — each is a fixed hue-rotation + saturation/lightness
// adjustment, honestly documented as a deterministic rule, not claimed as
// anything smarter.

export type ColorStoryVariantId =
  | 'original'
  | 'light'
  | 'dark'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'monochrome'
  | 'muted'
  | 'bold'
  | 'earthTone'
  | 'luxury'
  | 'pastel';

export const COLOR_STORY_VARIANT_IDS: ColorStoryVariantId[] = [
  'original', 'light', 'dark', 'spring', 'summer', 'autumn', 'winter', 'monochrome', 'muted', 'bold',
  'earthTone', 'luxury', 'pastel',
];

const VARIANT_LABELS: Record<ColorStoryVariantId, string> = {
  original: 'Original',
  light: 'Light',
  dark: 'Dark',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  monochrome: 'Monochrome',
  muted: 'Muted',
  bold: 'Bold',
  earthTone: 'Earth Tone',
  luxury: 'Luxury',
  pastel: 'Pastel',
};

export interface ColorStoryVariant {
  id: ColorStoryVariantId;
  label: string;
  colors: string[];
}

export type ColorStorySet = Record<ColorStoryVariantId, ColorStoryVariant>;

type HexTransform = (hex: string) => string;

/** Every variant except `original` (identity) and `monochrome` (needs the
 * whole-palette hue, not a per-color rule) is one fixed per-color HSL
 * transform, applied independently to every color so relative
 * light/dark ordering within the palette is preserved. */
const VARIANT_TRANSFORMS: Partial<Record<ColorStoryVariantId, HexTransform>> = {
  light: (hex) => adjustSaturation(adjustLightness(hex, 18), -6),
  dark: (hex) => adjustSaturation(adjustLightness(hex, -20), 4),
  muted: (hex) => adjustSaturation(hex, -30),
  bold: (hex) => adjustLightness(adjustSaturation(hex, 25), -3),
  spring: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, 8), 10), 6),
  summer: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, -6), -12), 10),
  autumn: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, 20), 5), -8),
  winter: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, -15), 8), -12),
  // Earth Tone: warm hue rotation toward ochre/terracotta, desaturated and
  // deepened — the same "shift hue, then pull saturation/lightness" recipe
  // as the seasonal variants, tuned toward a real earth-tone palette
  // convention (clay/moss/sand) rather than an invented look.
  earthTone: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, 18), -28), -10),
  // Luxury: deep jewel-tone rotation (toward emerald/sapphire/aubergine),
  // high saturation, noticeably darker — distinct from "dark" (which keeps
  // the original hue and only drops lightness) and from "bold" (which
  // keeps the original hue and stays light enough to read as bright).
  luxury: (hex) => adjustLightness(adjustSaturation(rotateHue(hex, -12), 18), -18),
  // Pastel: very light and softly desaturated — distinct from "light"
  // (a smaller, more conservative lift) by pushing lightness further while
  // pulling saturation down more, the standard pastel-palette recipe.
  pastel: (hex) => adjustLightness(adjustSaturation(hex, -22), 30),
};

/** Derives the full 13-variant Color Story from one base color set.
 * Deterministic (no randomness) — the same input colors always produce the
 * same 10 variants. `baseColors[0]` is treated as the background color (the
 * same convention `palettes/palettes.ts`'s `Palette.colors` already uses)
 * and is transformed like every other color, not left untouched, so a
 * "Dark" variant's background genuinely reads as dark. */
export function buildColorStory(baseColors: string[]): ColorStorySet {
  const safeColors = baseColors.length > 0 ? baseColors : ['#FFFFFF'];
  // Monochrome collapses every color onto one shared hue (the second color
  // when available — index 0 is the background, which tends to be the
  // least saturated/representative color to anchor a hue family on) while
  // keeping each color's own lightness, so the palette still reads as a
  // real light-to-dark ramp, just entirely within one hue.
  const monoHue = hexToHsl(safeColors[Math.min(1, safeColors.length - 1)]).h;

  const result = {} as ColorStorySet;
  for (const id of COLOR_STORY_VARIANT_IDS) {
    const colors =
      id === 'original'
        ? safeColors.slice()
        : id === 'monochrome'
          ? safeColors.map((c) => setHue(c, monoHue))
          : safeColors.map(VARIANT_TRANSFORMS[id]!);
    result[id] = { id, label: VARIANT_LABELS[id], colors };
  }
  return result;
}
