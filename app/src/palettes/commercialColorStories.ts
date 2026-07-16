import { hexToHsl } from './colorTransform';

// Build 006, Section 4 (Commercial Color Story Engine): the brief asks for
// "professional color stories" (French Vintage, Luxury Wedding,
// Scandinavian Calm, Muted Autumn, Desert Botanical, English Garden, Soft
// Cottage, Dark Floral), each owning contrast/temperature/accent/neutral
// balance -- a genuinely different concept from `collection/colorStory.ts`'s
// existing "Color Story Engine" (Collection Engine Phase 4, Section 3),
// which only *transforms* whatever palette a user already picked (light/
// dark/spring/muted/...). These are real, curated NAMED base palettes in
// their own right, each grounded in an actual commercial surface-pattern
// convention (the labels above are real, well-known stock-art/wedding-
// stationery/fabric color-story names, not invented ones).
//
// `contrast`/`temperature`/`neutralBalance` are never hand-typed guesses --
// each is computed from the story's own real hex colors via
// `palettes/colorTransform.ts`'s HSL primitives, so a story's metadata can
// never silently drift out of sync with its actual colors. Only `label`,
// `colors`, and `accentColors` (a real, curated subset of `colors`) are
// hand-authored design decisions.

export type ColorTemperature = 'warm' | 'cool' | 'neutral';
export type ColorContrast = 'low' | 'medium' | 'high';

export interface CommercialColorStory {
  id: string;
  label: string;
  /** Same "lightest/background-friendly first" convention as `Palette`. */
  colors: string[];
  /** Real subset of `colors` -- the standout hues this story leans on for
   * a hero motif or focal accent. */
  accentColors: string[];
  /** Computed from the real spread between the lightest and darkest color
   * (see `computeContrast`) -- never hand-set. */
  contrast: ColorContrast;
  /** Computed from a saturation-weighted warm/cool hue balance across the
   * real colors (see `computeTemperature`) -- never hand-set. */
  temperature: ColorTemperature;
  /** Real fraction (0-1) of colors that are low-saturation neutrals (see
   * `computeNeutralBalance`) -- never hand-set. */
  neutralBalance: number;
}

const NEUTRAL_SATURATION_THRESHOLD = 25;
const CONTRAST_LOW_MAX = 35;
const CONTRAST_MEDIUM_MAX = 60;
/** Below this weighted warm/cool imbalance, a story reads as genuinely
 * balanced rather than leaning either way. */
const TEMPERATURE_NEUTRAL_MARGIN = 0.3;

/** Real lightness-range measurement (not a proxy) -- how far apart the
 * darkest and lightest color in the story actually are. */
function computeContrast(colors: string[]): ColorContrast {
  const lightnesses = colors.map((c) => hexToHsl(c).l);
  const range = Math.max(...lightnesses) - Math.min(...lightnesses);
  if (range < CONTRAST_LOW_MAX) return 'low';
  if (range < CONTRAST_MEDIUM_MAX) return 'medium';
  return 'high';
}

/** Weights each color's warm (red/orange/yellow, hue < 90 or >= 330) vs.
 * cool hue lean by its own saturation, so a near-grey neutral (low
 * saturation) can't tip the story warm/cool just because its raw hue
 * happens to fall on one side -- a real, if simple, colorist convention
 * (saturated colors carry the temperature; neutrals don't). */
function computeTemperature(colors: string[]): ColorTemperature {
  let warmWeight = 0;
  let coolWeight = 0;
  for (const c of colors) {
    const { h, s } = hexToHsl(c);
    const weight = s / 100;
    const isWarm = h < 90 || h >= 330;
    if (isWarm) warmWeight += weight;
    else coolWeight += weight;
  }
  if (Math.abs(warmWeight - coolWeight) < TEMPERATURE_NEUTRAL_MARGIN) return 'neutral';
  return warmWeight > coolWeight ? 'warm' : 'cool';
}

/** Real fraction of colors under the neutral-saturation threshold. */
function computeNeutralBalance(colors: string[]): number {
  const neutralCount = colors.filter((c) => hexToHsl(c).s < NEUTRAL_SATURATION_THRESHOLD).length;
  return Math.round((neutralCount / colors.length) * 100) / 100;
}

function story(id: string, label: string, colors: string[], accentColors: string[]): CommercialColorStory {
  return {
    id,
    label,
    colors,
    accentColors,
    contrast: computeContrast(colors),
    temperature: computeTemperature(colors),
    neutralBalance: computeNeutralBalance(colors),
  };
}

export const COMMERCIAL_COLOR_STORIES: CommercialColorStory[] = [
  story(
    'french-vintage',
    'French Vintage',
    ['#F5EFE6', '#D9B8A3', '#C9A05C', '#A9B89C', '#8B98A5', '#6B5A4E'],
    ['#D9B8A3', '#C9A05C'],
  ),
  story(
    'luxury-wedding',
    'Luxury Wedding',
    ['#FBF6EF', '#E8C7C7', '#C9A15A', '#A9B08E', '#7A2E3A', '#3D2B2E'],
    ['#C9A15A', '#7A2E3A'],
  ),
  story(
    'scandinavian-calm',
    'Scandinavian Calm',
    ['#F7F6F3', '#DCD9D3', '#C9D2D6', '#C7CFC0', '#A8B6B8', '#5B6360'],
    ['#A8B6B8'],
  ),
  story(
    'muted-autumn',
    'Muted Autumn',
    ['#F2E8D8', '#D1A238', '#C77B4F', '#7A7F4A', '#5C4630', '#3A2E23'],
    ['#D1A238', '#C77B4F'],
  ),
  story(
    'desert-botanical',
    'Desert Botanical',
    ['#EFE1CE', '#D8A78E', '#C0693F', '#8FA07C', '#A65D3F', '#4A3B2E'],
    ['#C0693F', '#8FA07C'],
  ),
  story(
    'english-garden',
    'English Garden',
    ['#FAF3EA', '#E3A9B4', '#B79FCB', '#7C9473', '#8C3B4A', '#3E4B32'],
    ['#E3A9B4', '#8C3B4A'],
  ),
  story(
    'soft-cottage',
    'Soft Cottage',
    ['#FBF8F2', '#F0D3D0', '#EAD9A0', '#B7C2A3', '#9FB4C2', '#6B6255'],
    ['#F0D3D0', '#EAD9A0'],
  ),
  story(
    'dark-floral',
    'Dark Floral',
    ['#EDE7E2', '#B8862B', '#7A2048', '#5B2A4D', '#2E4A3A', '#1B1A1E'],
    ['#B8862B', '#7A2048'],
  ),
];

export const COMMERCIAL_COLOR_STORY_IDS: string[] = COMMERCIAL_COLOR_STORIES.map((s) => s.id);

export function getCommercialColorStory(id: string): CommercialColorStory | undefined {
  return COMMERCIAL_COLOR_STORIES.find((s) => s.id === id);
}
