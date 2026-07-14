import type { GenerateParams, LayoutId } from './types';
import { HIERARCHY_PRESETS } from './hierarchy';
import { GENERATORS } from '../generators';
import { GROWTH_PRESETS } from '../generators/growth';
import { createRng, rngPick, randomSeed } from './rng';
import type { StockSiteId } from '../metadata/shutterstock';

// Style DNA Engine — turns "category + layout + palette + density + hierarchy
// + flow + overlap + cluster" (a dozen separate manual choices) into ONE
// choice: a named design identity. Every Style DNA is plain structured data
// (no if-else branching over style names anywhere in this file) resolved by
// one generic function, `resolveStyleDna`, the same architectural pattern
// engine/artDirection.ts and engine/trendEngine.ts already established —
// this just carries a much richer field set and adds a first-class Manager
// (create/duplicate/rename/delete/export/import/favorite, see
// storage/styleDnaStore.ts).
//
// Scope note: `botanicalGrowthPreset` is stored/round-tripped as a reserved,
// informational field — it does not yet steer which botanical shape variant
// is drawn (that requires a hook into generators/botanical.ts no phase has
// built yet). `clusterStyle`/`clusterDensity` previously had the same
// reserved status (this comment used to say the Cluster Engine "doesn't
// exist yet"), but Project Phoenix V2 shipped a real one
// (`engine/clusterEngine.ts`) and Composition Intelligence Foundation V2
// (Build 001) connected it here: `clusterStyle`/`clusterDensity` now also
// drive real Pattern Physics attraction strength (Section 8,
// `engine/patternPhysics.ts`) on top of the balance-correction proxy they
// already fed — see `CLUSTER_ATTRACTION_STRENGTH` below. `flowProfile` used
// to only resolve to `rotationJitter` (spin, not placement); it now also
// drives `compositionIntelligence.flowBiasStrength` (Section 5, a real
// placement bias — see `FLOW_BIAS_STRENGTH` below). Every other field maps
// to a real, already-implemented engine parameter and visibly changes the
// generated SVG.

export const STYLE_DNA_SCHEMA_VERSION = 1;

export type OverlapMode = 'none' | 'subtle' | 'natural' | 'dense';
export type FlowProfile = 'calm' | 'directional' | 'dynamic';
export type RhythmProfile = 'regular' | 'organic' | 'syncopated';
export type ClusterStyle = 'none' | 'loose' | 'tight' | 'bouquet';
export type MotifComplexity = 'simple' | 'moderate' | 'intricate';
export type ColorStrategy = 'dominantDuo' | 'fullPalette' | 'monochromeAccent' | 'highContrast';
export type BackgroundStrategy = 'minimalLight' | 'richContrast' | 'darkMoody' | 'neutralPaper';
export type SvgDepthMode = 'flat' | 'soft' | 'dimensional';

export interface StyleDnaExportRecommendation {
  tileSize: number;
  patternScale: number;
  /** Site ids matching the app's own per-site SEO panel (metadata/*.ts) —
   * never invented names outside what the app actually supports. */
  recommendedSites: StockSiteId[];
}

export interface StyleDna {
  id: string;
  label: string;
  description: string;
  /** True for user-created/duplicated styles; absent (not false) on every
   * built-in preset so `Object.keys` / JSON diffing treats them the same way
   * `cloneParams`'s other optional fields do. */
  custom?: true;
  /** Preferred categories, first = primary/default. */
  categories: string[];
  /** Preferred layouts, first = primary/default. */
  layouts: LayoutId[];
  /** Named hierarchy profile — references the existing HIERARCHY_PRESETS
   * table (hero/secondary/filler/accent ratios + scales) instead of
   * duplicating those 8 numbers per style. */
  hierarchyPreset: keyof typeof HIERARCHY_PRESETS;
  density: number;
  negativeSpace: number;
  overlapMode: OverlapMode;
  overlapAmount: number;
  flowProfile: FlowProfile;
  rhythmProfile: RhythmProfile;
  clusterStyle: ClusterStyle;
  clusterDensity: number;
  motifComplexity: MotifComplexity;
  /** Reserved for Phase 4 Botanical Geometry — see module note above. */
  botanicalGrowthPreset?: keyof typeof GROWTH_PRESETS;
  colorStrategy: ColorStrategy;
  /** Preferred palettes, first = primary/default. */
  paletteIds: string[];
  backgroundStrategy: BackgroundStrategy;
  svgDepthMode: SvgDepthMode;
  exportRecommendation: StyleDnaExportRecommendation;
}

// Exported (not just module-private) so other modules that resolve a
// FlowProfile/RhythmProfile into a concrete number — e.g. trend/
// designIntelligence.ts's Design Specification builder — reuse these same
// values instead of maintaining a second copy that could drift.
export const FLOW_ROTATION_JITTER: Record<FlowProfile, number> = { calm: 8, directional: 15, dynamic: 30 };
const COMPLEXITY_SCALE_JITTER: Record<MotifComplexity, number> = { simple: 0.08, moderate: 0.15, intricate: 0.25 };
const COMPLEXITY_ROTATION_BUMP: Record<MotifComplexity, number> = { simple: 0, moderate: 4, intricate: 10 };
const COMPLEXITY_COLOR_COUNT: Record<MotifComplexity, number> = { simple: 3, moderate: 4, intricate: 5 };
export const RHYTHM_STRENGTH: Record<RhythmProfile, number> = { regular: 0.15, organic: 0.4, syncopated: 0.6 };
const CLUSTER_BALANCE_STRENGTH: Record<ClusterStyle, number> = { none: 0.6, loose: 0.5, tight: 0.25, bouquet: 0.2 };
// Composition Intelligence Foundation V2 (Build 001) — real Pattern
// Physics (Section 8) strength per cluster style: a "bouquet"/"tight"
// identity means members should read as pulled toward their hero, so
// attraction is strongest there; "none" still gets a small baseline pull
// (isolated decorative objects are never the goal) rather than 0.
const CLUSTER_ATTRACTION_STRENGTH: Record<ClusterStyle, number> = { none: 0.2, loose: 0.35, tight: 0.55, bouquet: 0.6 };
// Real Flow Engine (Section 5) placement-bias strength per flow profile —
// "calm" resolves to 0 regardless (applyFlowBias treats profile 'calm' as
// a no-op anyway; the 0 here just keeps this table self-documenting).
const FLOW_BIAS_STRENGTH: Record<FlowProfile, number> = { calm: 0, directional: 0.3, dynamic: 0.4 };
const COLOR_STRATEGY_STORY: Record<ColorStrategy, boolean> = {
  dominantDuo: true,
  fullPalette: false,
  monochromeAccent: true,
  highContrast: true,
};
const COLOR_STRATEGY_COUNT: Record<ColorStrategy, number> = {
  dominantDuo: 4,
  fullPalette: 6,
  monochromeAccent: 2,
  highContrast: 5,
};
const BACKGROUND_FILLER: Record<BackgroundStrategy, 'none' | 'subtle' | 'rich'> = {
  minimalLight: 'none',
  richContrast: 'rich',
  darkMoody: 'subtle',
  neutralPaper: 'subtle',
};
const DEPTH_SHADOW: Record<SvgDepthMode, { flatShadow: boolean; flatHighlight: boolean }> = {
  flat: { flatShadow: false, flatHighlight: false },
  soft: { flatShadow: false, flatHighlight: true },
  dimensional: { flatShadow: true, flatHighlight: true },
};

export const STYLE_DNA_PRESETS: Record<string, StyleDna> = {
  editorialBotanical: {
    id: 'editorialBotanical', label: 'Editorial Botanical',
    description: 'Clean, directional botanical layout with generous quiet space for editorial/print use.',
    categories: ['botanical'], layouts: ['heroFlow', 'sCurve'], hierarchyPreset: 'balancedEditorial',
    density: 0.5, negativeSpace: 0.2, overlapMode: 'subtle', overlapAmount: 0.1,
    flowProfile: 'directional', rhythmProfile: 'regular', clusterStyle: 'loose', clusterDensity: 0.3,
    motifComplexity: 'moderate', botanicalGrowthPreset: 'laurel', colorStrategy: 'dominantDuo',
    paletteIds: ['pastel-dream', 'sage-terracotta'], backgroundStrategy: 'minimalLight', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['adobestock', 'shutterstock'] },
  },
  luxuryFloral: {
    id: 'luxuryFloral', label: 'Luxury Floral',
    description: 'Large hero blooms in a hand-tied bouquet arrangement with jewel-tone richness.',
    categories: ['botanical'], layouts: ['bouquet', 'heroScatter'], hierarchyPreset: 'heroFocus',
    density: 0.55, negativeSpace: 0.15, overlapMode: 'natural', overlapAmount: 0.2,
    flowProfile: 'directional', rhythmProfile: 'organic', clusterStyle: 'bouquet', clusterDensity: 0.6,
    motifComplexity: 'intricate', botanicalGrowthPreset: 'eucalyptus', colorStrategy: 'highContrast',
    paletteIds: ['jewel-tones', 'blush-gold'], backgroundStrategy: 'richContrast', svgDepthMode: 'dimensional',
    exportRecommendation: { tileSize: 1600, patternScale: 1, recommendedSites: ['adobestock', 'creativemarket'] },
  },
  scandinavianOrganic: {
    id: 'scandinavianOrganic', label: 'Scandinavian Organic',
    description: 'Airy, restrained organic shapes with a muted coastal-neutral palette.',
    categories: ['organic', 'botanical'], layouts: ['airy', 'scatter'], hierarchyPreset: 'airyPremium',
    density: 0.32, negativeSpace: 0.5, overlapMode: 'none', overlapAmount: 0,
    flowProfile: 'calm', rhythmProfile: 'regular', clusterStyle: 'none', clusterDensity: 0.1,
    motifComplexity: 'simple', colorStrategy: 'monochromeAccent',
    paletteIds: ['coastal-neutral', 'monochrome-blue'], backgroundStrategy: 'minimalLight', svgDepthMode: 'flat',
    exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['adobestock', 'freepik'] },
  },
  minimalBotanical: {
    id: 'minimalBotanical', label: 'Minimal Botanical',
    description: 'A single restrained botanical silhouette repeated on a strict minimal grid.',
    categories: ['botanical'], layouts: ['gridMinimal', 'grid'], hierarchyPreset: 'minimalRepeat',
    density: 0.3, negativeSpace: 0.45, overlapMode: 'none', overlapAmount: 0,
    flowProfile: 'calm', rhythmProfile: 'regular', clusterStyle: 'none', clusterDensity: 0.1,
    motifComplexity: 'simple', botanicalGrowthPreset: 'laurel', colorStrategy: 'monochromeAccent',
    paletteIds: ['mono-charcoal', 'coastal-neutral'], backgroundStrategy: 'minimalLight', svgDepthMode: 'flat',
    exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['adobestock', 'shutterstock'] },
  },
  vintageHerbarium: {
    id: 'vintageHerbarium', label: 'Vintage Herbarium',
    description: 'Pressed-specimen scatter in muted earth tones, full-palette botanical variety.',
    categories: ['botanical'], layouts: ['scatter', 'halfDrop'], hierarchyPreset: 'allOverTextile',
    density: 0.45, negativeSpace: 0.25, overlapMode: 'none', overlapAmount: 0,
    flowProfile: 'calm', rhythmProfile: 'organic', clusterStyle: 'loose', clusterDensity: 0.35,
    motifComplexity: 'moderate', botanicalGrowthPreset: 'sage', colorStrategy: 'fullPalette',
    paletteIds: ['earth-tone', 'terracotta'], backgroundStrategy: 'neutralPaper', svgDepthMode: 'flat',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['creativemarket', 'creativefabrica'] },
  },
  darkBotanical: {
    id: 'darkBotanical', label: 'Dark Botanical',
    description: 'Moody midnight palette, tightly clustered hero foliage, dimensional depth.',
    categories: ['botanical'], layouts: ['bouquet', 'sCurve'], hierarchyPreset: 'heroFocus',
    density: 0.55, negativeSpace: 0.1, overlapMode: 'natural', overlapAmount: 0.2,
    flowProfile: 'directional', rhythmProfile: 'organic', clusterStyle: 'tight', clusterDensity: 0.55,
    motifComplexity: 'intricate', botanicalGrowthPreset: 'fern', colorStrategy: 'highContrast',
    paletteIds: ['midnight-botanical'], backgroundStrategy: 'darkMoody', svgDepthMode: 'dimensional',
    exportRecommendation: { tileSize: 1600, patternScale: 1, recommendedSites: ['adobestock', 'creativemarket'] },
  },
  modernTropical: {
    id: 'modernTropical', label: 'Modern Tropical',
    description: 'Bold, dynamic tropical foliage with citrus/ocean contrast and syncopated rhythm.',
    categories: ['tropical'], layouts: ['heroScatter', 'toss'], hierarchyPreset: 'heroFocus',
    density: 0.55, negativeSpace: 0.1, overlapMode: 'natural', overlapAmount: 0.15,
    flowProfile: 'dynamic', rhythmProfile: 'syncopated', clusterStyle: 'loose', clusterDensity: 0.4,
    motifComplexity: 'intricate', colorStrategy: 'highContrast',
    paletteIds: ['citrus-pop', 'ocean-breeze'], backgroundStrategy: 'richContrast', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['adobestock', 'shutterstock'] },
  },
  boutiquePackaging: {
    id: 'boutiquePackaging', label: 'Boutique Packaging',
    description: 'Clean stripe/grid geometry sized for small-scale packaging and labels.',
    categories: ['geometric', 'damask'], layouts: ['stripe', 'gridMinimal'], hierarchyPreset: 'allOverTextile',
    density: 0.5, negativeSpace: 0.1, overlapMode: 'none', overlapAmount: 0,
    flowProfile: 'calm', rhythmProfile: 'regular', clusterStyle: 'none', clusterDensity: 0.15,
    motifComplexity: 'moderate', colorStrategy: 'dominantDuo',
    paletteIds: ['blush-gold', 'mono-charcoal'], backgroundStrategy: 'neutralPaper', svgDepthMode: 'flat',
    exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['creativemarket', 'creativefabrica'] },
  },
  luxuryWallpaper: {
    id: 'luxuryWallpaper', label: 'Luxury Wallpaper',
    description: 'Dense, richly layered damask at wallpaper scale with jewel-tone depth.',
    categories: ['damask'], layouts: ['densePremium', 'halfDrop'], hierarchyPreset: 'denseLayered',
    density: 0.65, negativeSpace: 0, overlapMode: 'dense', overlapAmount: 0.3,
    flowProfile: 'directional', rhythmProfile: 'organic', clusterStyle: 'tight', clusterDensity: 0.6,
    motifComplexity: 'intricate', colorStrategy: 'highContrast',
    paletteIds: ['jewel-tones', 'midnight-botanical'], backgroundStrategy: 'richContrast', svgDepthMode: 'dimensional',
    exportRecommendation: { tileSize: 1800, patternScale: 1, recommendedSites: ['adobestock', 'creativemarket'] },
  },
  premiumTextile: {
    id: 'premiumTextile', label: 'Premium Textile',
    description: 'Half-drop damask/paisley weave, full palette, sized for yardage/upholstery.',
    categories: ['damask', 'paisley'], layouts: ['halfDrop', 'brick'], hierarchyPreset: 'allOverTextile',
    density: 0.55, negativeSpace: 0.05, overlapMode: 'subtle', overlapAmount: 0.1,
    flowProfile: 'directional', rhythmProfile: 'regular', clusterStyle: 'loose', clusterDensity: 0.3,
    motifComplexity: 'moderate', colorStrategy: 'fullPalette',
    paletteIds: ['sage-terracotta', 'autumn-harvest'], backgroundStrategy: 'neutralPaper', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['creativefabrica', 'adobestock'] },
  },
  kidsPlayful: {
    id: 'kidsPlayful', label: 'Kids Playful',
    description: 'Bright, bouncy toss/scatter of simple friendly shapes with candy-shop color.',
    categories: ['cute'], layouts: ['toss', 'scatter'], hierarchyPreset: 'ditsyFloral',
    density: 0.55, negativeSpace: 0.1, overlapMode: 'subtle', overlapAmount: 0.1,
    flowProfile: 'dynamic', rhythmProfile: 'syncopated', clusterStyle: 'loose', clusterDensity: 0.4,
    motifComplexity: 'simple', colorStrategy: 'fullPalette',
    paletteIds: ['candy-shop', 'vibrant-pop'], backgroundStrategy: 'minimalLight', svgDepthMode: 'dimensional',
    exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['shutterstock', 'freepik'] },
  },
  retroOrganic: {
    id: 'retroOrganic', label: 'Retro Organic',
    description: 'Sun-bleached retro palette flowing through soft organic silhouettes.',
    categories: ['retro', 'organic'], layouts: ['heroFlow', 'scatter'], hierarchyPreset: 'balancedEditorial',
    density: 0.5, negativeSpace: 0.15, overlapMode: 'subtle', overlapAmount: 0.1,
    flowProfile: 'dynamic', rhythmProfile: 'organic', clusterStyle: 'loose', clusterDensity: 0.35,
    motifComplexity: 'moderate', colorStrategy: 'highContrast',
    paletteIds: ['retro-sunset', 'autumn-harvest'], backgroundStrategy: 'neutralPaper', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['shutterstock', 'adobestock'] },
  },
  organicAbstract: {
    id: 'organicAbstract', label: 'Organic Abstract',
    description: 'Loose abstract organic scatter with syncopated rhythm and full palette range.',
    categories: ['organic'], layouts: ['scatter', 'airy'], hierarchyPreset: 'minimalRepeat',
    density: 0.4, negativeSpace: 0.35, overlapMode: 'subtle', overlapAmount: 0.1,
    flowProfile: 'dynamic', rhythmProfile: 'syncopated', clusterStyle: 'loose', clusterDensity: 0.3,
    motifComplexity: 'intricate', colorStrategy: 'fullPalette',
    paletteIds: ['ocean-breeze', 'lavender-fields'], backgroundStrategy: 'minimalLight', svgDepthMode: 'flat',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['adobestock', 'freepik'] },
  },
  bohoFloral: {
    id: 'bohoFloral', label: 'Boho Floral',
    description: 'Warm terracotta boho motifs tossed with botanical accents, dense and layered.',
    categories: ['boho', 'botanical'], layouts: ['toss', 'scatter'], hierarchyPreset: 'denseLayered',
    density: 0.55, negativeSpace: 0.1, overlapMode: 'natural', overlapAmount: 0.2,
    flowProfile: 'dynamic', rhythmProfile: 'organic', clusterStyle: 'loose', clusterDensity: 0.45,
    motifComplexity: 'intricate', botanicalGrowthPreset: 'leafyBranch', colorStrategy: 'fullPalette',
    paletteIds: ['terracotta', 'autumn-harvest'], backgroundStrategy: 'neutralPaper', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['creativemarket', 'creativefabrica'] },
  },
  softWatercolorInspired: {
    id: 'softWatercolorInspired', label: 'Soft Watercolor Inspired (Vector only)',
    description: 'A watercolor *feel* built entirely from flat vector fills and soft color blending — no raster texture, no bitmap brush strokes; airy negative space and a soft two-tone palette do the work.',
    categories: ['organic', 'botanical'], layouts: ['airy', 'scatter'], hierarchyPreset: 'airyPremium',
    density: 0.35, negativeSpace: 0.4, overlapMode: 'subtle', overlapAmount: 0.15,
    flowProfile: 'calm', rhythmProfile: 'organic', clusterStyle: 'loose', clusterDensity: 0.25,
    motifComplexity: 'moderate', colorStrategy: 'dominantDuo',
    paletteIds: ['pastel-dream', 'lavender-fields'], backgroundStrategy: 'minimalLight', svgDepthMode: 'soft',
    exportRecommendation: { tileSize: 1400, patternScale: 1, recommendedSites: ['adobestock', 'freepik'] },
  },
};

export const STYLE_DNA_LIST: StyleDna[] = Object.values(STYLE_DNA_PRESETS);

/** The subset of GenerateParams a Style DNA resolves — used both to build
 * the actual patch applied to the app's params and to compute drift (which
 * fields the user has since hand-edited away from the style's own values). */
export type StyleDnaResolvedFields = Pick<
  GenerateParams,
  | 'categoryId'
  | 'motifSize'
  | 'layoutId'
  | 'paletteId'
  | 'colorCount'
  | 'colorStory'
  | 'density'
  | 'negativeSpace'
  | 'overlapAmount'
  | 'rotationJitter'
  | 'scaleJitter'
  | 'fillerStyle'
  | 'flatShadow'
  | 'flatHighlight'
  | 'hierarchy'
  | 'compositionIntelligence'
  | 'tileSize'
  | 'patternScale'
  | 'styleDnaId'
>;

/** Deterministically picks one entry from a Style DNA's preferred list using
 * a seed derived from the style id + the app's own seed (same cyrb53-based
 * hash family every other seed in this engine uses — never `Math.random`),
 * so regenerating with a new seed can explore other family members while
 * the same seed + style always resolves identically. */
function pickPreferred<T>(list: T[], dnaId: string, seed: string, salt: string): T {
  if (list.length === 1) return list[0];
  const rng = createRng(`styledna::${dnaId}::${salt}::${seed}`);
  return rngPick(rng, list);
}

/** Resolves a Style DNA into the concrete GenerateParams patch. Every field
 * maps to a real, already-implemented engine parameter (see module note for
 * the two intentionally-reserved exceptions). */
export function resolveStyleDna(dna: StyleDna, seed: string): StyleDnaResolvedFields {
  const categoryId = pickPreferred(dna.categories, dna.id, seed, 'category');
  const layoutId = pickPreferred(dna.layouts, dna.id, seed, 'layout');
  const paletteId = pickPreferred(dna.paletteIds, dna.id, seed, 'palette');
  const generator = GENERATORS[categoryId];
  const depth = DEPTH_SHADOW[dna.svgDepthMode];

  return {
    categoryId,
    motifSize: generator ? generator.defaultMotifSize : 70,
    layoutId,
    paletteId,
    colorCount: COMPLEXITY_COLOR_COUNT[dna.motifComplexity] + (COLOR_STRATEGY_COUNT[dna.colorStrategy] - 4),
    colorStory: COLOR_STRATEGY_STORY[dna.colorStrategy],
    density: dna.density,
    negativeSpace: dna.negativeSpace,
    overlapAmount: dna.overlapAmount,
    rotationJitter: FLOW_ROTATION_JITTER[dna.flowProfile] + COMPLEXITY_ROTATION_BUMP[dna.motifComplexity],
    scaleJitter: COMPLEXITY_SCALE_JITTER[dna.motifComplexity],
    fillerStyle: BACKGROUND_FILLER[dna.backgroundStrategy],
    flatShadow: depth.flatShadow,
    flatHighlight: depth.flatHighlight,
    hierarchy: HIERARCHY_PRESETS[dna.hierarchyPreset].value,
    compositionIntelligence: {
      balanceStrength: CLUSTER_BALANCE_STRENGTH[dna.clusterStyle] * (1 - dna.clusterDensity * 0.4),
      rhythmStrength: RHYTHM_STRENGTH[dna.rhythmProfile],
      attractionStrength: CLUSTER_ATTRACTION_STRENGTH[dna.clusterStyle] * (0.6 + dna.clusterDensity * 0.4),
      negativeSpaceStrength: 0.2 + dna.negativeSpace * 0.5,
      flowProfile: dna.flowProfile,
      flowBiasStrength: FLOW_BIAS_STRENGTH[dna.flowProfile],
    },
    tileSize: dna.exportRecommendation.tileSize,
    patternScale: dna.exportRecommendation.patternScale,
    styleDnaId: dna.id,
  };
}

/** One field of drift between the currently-applied params and what the
 * style itself would resolve to for the same seed — powers "display
 * differences from style defaults" and "Reset to Style". */
export interface StyleDriftEntry {
  field: keyof StyleDnaResolvedFields;
  styleValue: unknown;
  currentValue: unknown;
}

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function computeStyleDrift(params: GenerateParams, dna: StyleDna): StyleDriftEntry[] {
  const resolved = resolveStyleDna(dna, params.seed);
  const drift: StyleDriftEntry[] = [];
  for (const field of Object.keys(resolved) as Array<keyof StyleDnaResolvedFields>) {
    const styleValue = resolved[field];
    const currentValue = params[field];
    if (stableStringify(styleValue) !== stableStringify(currentValue)) {
      drift.push({ field, styleValue, currentValue });
    }
  }
  return drift;
}

/** "Reset to Style": discards any hand-edits and re-resolves the style fresh
 * for the current seed. */
export function resetToStyleDna(dna: StyleDna, seed: string): StyleDnaResolvedFields {
  return resolveStyleDna(dna, seed);
}

/** Style DNA Enforcement (SVG Intelligence Engine Phase 3, Section 12) —
 * `computeStyleDrift` above already checks whether the *input params*
 * (category/layout/palette/...) still match what the style would resolve
 * to; this checks something `computeStyleDrift` can't: whether the
 * *rendered geometry* actually reads as consistent with the style's own
 * declared intent, using metrics `engine/scoring.ts`'s `computeMetrics`
 * already measured from the real tile (no second scoring pass here).
 * Two real signals, averaged:
 *  - density match: measured `occupancyRatio` (0-100, real grid-coverage
 *    fraction) vs. the style's declared `density` (0-1) — a "minimal"
 *    style whose actual output reads as densely packed has drifted from
 *    its own identity regardless of which category/layout produced it.
 *  - complexity match: measured `rotationDiversity` (0-100) vs. what the
 *    style's declared `motifComplexity` predicts (`intricate` styles are
 *    expected to show more placement variation than `simple` ones, per
 *    this same file's own `COMPLEXITY_ROTATION_BUMP` table).
 * Deliberately two signals, not an invented ten — an honest, narrower
 * real measurement beats a wider fabricated one (see this milestone's
 * "never generate fake scores" requirement). */
export function computeStyleDnaConsistency(metrics: { occupancyRatio: number; rotationDiversity: number }, dna: StyleDna): number {
  const densityMatch = 100 - Math.abs(metrics.occupancyRatio - dna.density * 100);
  const expectedRotationDiversity = { simple: 30, moderate: 55, intricate: 80 }[dna.motifComplexity];
  const complexityMatch = 100 - Math.abs(metrics.rotationDiversity - expectedRotationDiversity);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return Math.round((clamp(densityMatch) + clamp(complexityMatch)) / 2);
}

/** True when every category/layout/palette a Style DNA references actually
 * exists in the currently-registered engine tables — guards against a
 * hand-edited or imported Style DNA JSON pointing at an id that doesn't
 * exist (e.g. an older export referencing a category that was since
 * renamed/removed). */
export function isStyleDnaCompatible(dna: StyleDna, opts: { paletteIds: Set<string> }): boolean {
  if (dna.categories.length === 0 || dna.layouts.length === 0 || dna.paletteIds.length === 0) return false;
  if (!dna.categories.every((id) => GENERATORS[id])) return false;
  if (!dna.paletteIds.every((id) => opts.paletteIds.has(id))) return false;
  if (!(dna.hierarchyPreset in HIERARCHY_PRESETS)) return false;
  return true;
}

/** Picks whichever key of a small lookup table has the value closest to
 * `value` — the generic, data-driven building block `deriveStyleDnaFromParams`
 * uses to reverse-map a numeric param back onto an enum profile, instead of
 * a chain of hardcoded if/else numeric-range checks per field. */
function nearestKeyByValue<K extends string>(table: Record<K, number>, value: number): K {
  let best = Object.keys(table)[0] as K;
  let bestDist = Infinity;
  for (const k of Object.keys(table) as K[]) {
    const dist = Math.abs(table[k] - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

function nearestHierarchyPreset(hierarchy: GenerateParams['hierarchy']): keyof typeof HIERARCHY_PRESETS {
  const keys = Object.keys(HIERARCHY_PRESETS) as Array<keyof typeof HIERARCHY_PRESETS>;
  if (!hierarchy) return 'balancedEditorial';
  let best = keys[0];
  let bestDist = Infinity;
  for (const k of keys) {
    const v = HIERARCHY_PRESETS[k].value;
    const dist =
      (v.heroRatio - hierarchy.heroRatio) ** 2 +
      (v.secondaryRatio - hierarchy.secondaryRatio) ** 2 +
      (v.fillerRatio - hierarchy.fillerRatio) ** 2 +
      (v.accentRatio - hierarchy.accentRatio) ** 2 +
      (v.heroScale - hierarchy.heroScale) ** 2 * 0.1;
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

function overlapAmountToMode(amount: number): OverlapMode {
  if (amount <= 0) return 'none';
  if (amount <= 0.15) return 'subtle';
  if (amount <= 0.25) return 'natural';
  return 'dense';
}

/** Best-effort reverse mapping: turns the *current* GenerateParams (whatever
 * the user has hand-tuned it to) into a new named Style DNA capturing that
 * configuration as a reusable profile. Style DNA is a higher-level
 * abstraction over the raw params by design, so this is intentionally
 * lossy (e.g. many exact rotationJitter values all map to the nearest
 * flowProfile) rather than a lossless snapshot — "Create Style" is meant to
 * produce a reusable *identity*, not a pixel-exact clone. */
export function deriveStyleDnaFromParams(params: GenerateParams, label: string): StyleDna {
  const flowProfile = nearestKeyByValue(FLOW_ROTATION_JITTER, params.rotationJitter);
  const motifComplexity = nearestKeyByValue(COMPLEXITY_SCALE_JITTER, params.scaleJitter);
  const rhythmProfile = nearestKeyByValue(
    RHYTHM_STRENGTH,
    params.compositionIntelligence?.rhythmStrength ?? RHYTHM_STRENGTH.regular,
  );
  const balanceStrength = params.compositionIntelligence?.balanceStrength ?? CLUSTER_BALANCE_STRENGTH.none;
  const clusterStyle = nearestKeyByValue(CLUSTER_BALANCE_STRENGTH, balanceStrength);
  const colorStrategy: ColorStrategy = !params.colorStory
    ? 'fullPalette'
    : params.colorCount <= 2
      ? 'monochromeAccent'
      : params.colorCount >= 5
        ? 'highContrast'
        : 'dominantDuo';
  const backgroundStrategy: BackgroundStrategy =
    params.fillerStyle === 'rich' ? 'richContrast' : params.fillerStyle === 'none' ? 'minimalLight' : 'neutralPaper';
  const svgDepthMode: SvgDepthMode = params.flatShadow ? 'dimensional' : params.flatHighlight ? 'soft' : 'flat';

  return {
    id: `custom-${randomSeed()}`,
    label,
    description: `สไตล์ที่บันทึกจากการตั้งค่าปัจจุบัน (${label})`,
    custom: true,
    categories: params.mixCategoryIds && params.mixCategoryIds.length >= 2 ? params.mixCategoryIds : [params.categoryId],
    layouts: [params.layoutId],
    hierarchyPreset: nearestHierarchyPreset(params.hierarchy),
    density: params.density,
    negativeSpace: params.negativeSpace ?? 0,
    overlapMode: overlapAmountToMode(params.overlapAmount ?? 0),
    overlapAmount: params.overlapAmount ?? 0,
    flowProfile,
    rhythmProfile,
    clusterStyle,
    clusterDensity: 0.3,
    motifComplexity,
    colorStrategy,
    paletteIds: [params.paletteId],
    backgroundStrategy,
    svgDepthMode,
    exportRecommendation: { tileSize: params.tileSize, patternScale: params.patternScale ?? 1, recommendedSites: ['adobestock', 'shutterstock'] },
  };
}

/** Duplicates any style (built-in or custom) as a new custom style with a
 * fresh id, ready for independent editing. */
export function duplicateStyleDna(dna: StyleDna, newLabel: string): StyleDna {
  return { ...dna, id: `custom-${randomSeed()}`, label: newLabel, custom: true };
}

export interface StyleDnaExport {
  schemaVersion: number;
  style: StyleDna;
}

export function exportStyleDnaJson(dna: StyleDna): string {
  return JSON.stringify({ schemaVersion: STYLE_DNA_SCHEMA_VERSION, style: dna } satisfies StyleDnaExport, null, 2);
}

/** Parses a Style DNA JSON export. Returns null (rather than throwing) for
 * malformed JSON or a style missing required fields — callers show a Thai
 * error message rather than crashing, matching ai/aiAssist.ts's convention
 * for user-provided JSON. */
export function importStyleDnaJson(json: string, opts: { paletteIds: Set<string> }): StyleDna | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const style = (parsed as Partial<StyleDnaExport>)?.style ?? (parsed as StyleDna);
  if (!style || typeof style !== 'object') return null;
  const dna = style as StyleDna;
  if (!dna.id || !dna.label || !Array.isArray(dna.categories) || !Array.isArray(dna.layouts) || !Array.isArray(dna.paletteIds)) {
    return null;
  }
  if (!isStyleDnaCompatible(dna, opts)) return null;
  return { ...dna, custom: true };
}
