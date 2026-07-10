import type { GenerateParams, LayoutId, TileData } from './types';
import { HIERARCHY_PRESETS } from './hierarchy';
import { GENERATORS } from '../generators';
import { colorSetStats, circularHueDistance } from './colorAnalysis';

// Trend Intelligence Engine — a curated, rule-based set of named surface-
// design style profiles. This is explicitly NOT real-time trend scraping
// (the app is a static GitHub Pages site with no backend/API and no AI
// API calls) — every profile is a hand-authored bundle of REAL,
// already-implemented engine parameters (category, layout, palette,
// hierarchy preset, negative space, overlap, density, color story,
// filler), the same pattern engine/artDirection.ts already uses. What's
// new here is `computeTrendFit`: after a pattern is generated, it measures
// the *actual* hue/saturation/lightness of the colors used and the actual
// density/overlap settings against each trend's declared reference ranges
// — a real geometry/color-derived score, not a label with no computation
// behind it.

export interface TrendSignature {
  /** [lo, hi] in degrees; lo > hi means the band wraps through 0/360
   * (e.g. magenta-through-orange). null = this trend isn't defined by a
   * particular hue family (e.g. a monochrome or pastel-agnostic trend). */
  hueRange: [number, number] | null;
  saturationRange: [number, number];
  lightnessRange: [number, number];
  densityRange: [number, number];
  overlapRange: [number, number];
}

interface TrendPreset {
  label: string;
  description: string;
  categoryId?: string;
  layoutId?: LayoutId;
  paletteId?: string;
  hierarchy: keyof typeof HIERARCHY_PRESETS;
  negativeSpace: number;
  overlapAmount: number;
  density: number;
  colorStory: boolean;
  fillerStyle: 'none' | 'subtle' | 'rich';
  flatShadow?: boolean;
  flatHighlight?: boolean;
  signature: TrendSignature;
}

export const TREND_PRESETS: Record<string, TrendPreset> = {
  quietLuxury: {
    label: 'Quiet Luxury',
    description: 'สีนวลหรู ความอิ่มตัวต่ำ องค์ประกอบโปร่งมีระยะห่าง',
    categoryId: 'botanical', layoutId: 'airy', paletteId: 'coastal-neutral', hierarchy: 'airyPremium',
    negativeSpace: 0.45, overlapAmount: 0, density: 0.35, colorStory: true, fillerStyle: 'none',
    signature: { hueRange: null, saturationRange: [0, 0.35], lightnessRange: [0.55, 0.9], densityRange: [0.2, 0.45], overlapRange: [0, 0.15] },
  },
  y2kRevival: {
    label: 'Y2K Revival',
    description: 'สีสดจัดตัดกันแรง องค์ประกอบแน่นสนุกสนาน',
    categoryId: 'cute', layoutId: 'toss', paletteId: 'candy-shop', hierarchy: 'ditsyFloral',
    negativeSpace: 0.05, overlapAmount: 0.2, density: 0.65, colorStory: true, fillerStyle: 'rich', flatShadow: true, flatHighlight: true,
    signature: { hueRange: [280, 60], saturationRange: [0.55, 1], lightnessRange: [0.5, 0.85], densityRange: [0.5, 0.8], overlapRange: [0.1, 0.35] },
  },
  coastalCalm: {
    label: 'Coastal Calm',
    description: 'โทนฟ้า-เขียวอมเทา สบายตา องค์ประกอบโปร่งเป็นธรรมชาติ',
    categoryId: 'botanical', layoutId: 'scatter', paletteId: 'coastal-neutral', hierarchy: 'balancedEditorial',
    negativeSpace: 0.3, overlapAmount: 0.05, density: 0.45, colorStory: true, fillerStyle: 'subtle',
    signature: { hueRange: [150, 220], saturationRange: [0.1, 0.5], lightnessRange: [0.5, 0.85], densityRange: [0.3, 0.55], overlapRange: [0, 0.2] },
  },
  darkAcademiaBotanical: {
    label: 'Dark Academia Botanical',
    description: 'โทนเข้มลึกลับหรูแบบวินเทจ ใบไม้/ดอกไม้ทึบเงา',
    categoryId: 'botanical', layoutId: 'bouquet', paletteId: 'midnight-botanical', hierarchy: 'heroFocus',
    negativeSpace: 0.1, overlapAmount: 0.2, density: 0.55, colorStory: true, fillerStyle: 'subtle', flatShadow: true,
    signature: { hueRange: [20, 160], saturationRange: [0.2, 0.6], lightnessRange: [0.1, 0.45], densityRange: [0.4, 0.65], overlapRange: [0.1, 0.35] },
  },
  softMaximalism: {
    label: 'Soft Maximalism',
    description: 'ลายแน่นเต็มพื้นที่แต่สีพาสเทลนุ่มนวล ไม่แข็งกร้าว',
    categoryId: 'botanical', layoutId: 'densePremium', hierarchy: 'denseLayered',
    negativeSpace: 0, overlapAmount: 0.3, density: 0.75, colorStory: true, fillerStyle: 'rich', flatHighlight: true,
    signature: { hueRange: null, saturationRange: [0.25, 0.6], lightnessRange: [0.55, 0.85], densityRange: [0.6, 0.85], overlapRange: [0.2, 0.4] },
  },
  cleanScandiMinimal: {
    label: 'Clean Scandi Minimal',
    description: 'ขาวดำ/เทาเรียบ องค์ประกอบเรียบง่าย เว้นระยะชัดเจน',
    categoryId: 'geometric', layoutId: 'gridMinimal', paletteId: 'mono-charcoal', hierarchy: 'minimalRepeat',
    negativeSpace: 0.4, overlapAmount: 0, density: 0.4, colorStory: false, fillerStyle: 'none',
    signature: { hueRange: null, saturationRange: [0, 0.15], lightnessRange: [0.2, 0.95], densityRange: [0.25, 0.5], overlapRange: [0, 0.1] },
  },
};

/** Resolve a trend id into a GenerateParams patch, or null if unknown. The
 * returned `trend` id is written back into params so the choice round-trips
 * through save/export/JSON without re-deriving it — mirrors
 * engine/artDirection.ts's resolveArtDirection exactly. */
export function resolveTrend(id: string): Partial<GenerateParams> | null {
  const preset = TREND_PRESETS[id];
  if (!preset) return null;
  const patch: Partial<GenerateParams> = {
    trend: id,
    hierarchy: HIERARCHY_PRESETS[preset.hierarchy].value,
    negativeSpace: preset.negativeSpace,
    overlapAmount: preset.overlapAmount,
    density: preset.density,
    colorStory: preset.colorStory,
    fillerStyle: preset.fillerStyle,
  };
  if (preset.categoryId && GENERATORS[preset.categoryId]) {
    patch.categoryId = preset.categoryId;
    patch.motifSize = GENERATORS[preset.categoryId].defaultMotifSize;
  }
  if (preset.layoutId) patch.layoutId = preset.layoutId;
  if (preset.paletteId) patch.paletteId = preset.paletteId;
  if (preset.flatShadow !== undefined) patch.flatShadow = preset.flatShadow;
  if (preset.flatHighlight !== undefined) patch.flatHighlight = preset.flatHighlight;
  return patch;
}

function rangeFit(value: number, range: [number, number]): number {
  const [lo, hi] = range;
  if (value >= lo && value <= hi) return 100;
  const span = Math.max(hi - lo, 0.05);
  const dist = value < lo ? lo - value : value - hi;
  return Math.max(0, 100 - (dist / span) * 100);
}

function hueRangeFit(hue: number, range: [number, number] | null): number {
  if (range === null) return 100;
  const [lo, hi] = range;
  const wraps = lo > hi;
  const inRange = wraps ? hue >= lo || hue <= hi : hue >= lo && hue <= hi;
  if (inRange) return 100;
  const dist = Math.min(circularHueDistance(hue, lo), circularHueDistance(hue, hi));
  return Math.max(0, 100 - (dist / 60) * 100);
}

export interface TrendFitResult {
  hueFit: number;
  saturationFit: number;
  lightnessFit: number;
  densityFit: number;
  overlapFit: number;
  overall: number;
}

/** Score how closely a *generated* tile's actual colors and composition
 * settings match a trend's declared reference ranges. Real computation
 * from `tileData.colors` (via engine/colorAnalysis.ts) and
 * `tileData.params` — not the trend's own resolved defaults, which is why
 * this can meaningfully differ from 100 even right after applying the
 * trend preset (e.g. if the user then hand-edited the palette or density
 * afterward). */
export function computeTrendFit(tileData: TileData, trendId: string): TrendFitResult | null {
  const preset = TREND_PRESETS[trendId];
  if (!preset) return null;
  const stats = colorSetStats(tileData.colors);
  const hueFit = hueRangeFit(stats.meanHue, preset.signature.hueRange);
  const saturationFit = rangeFit(stats.meanSaturation, preset.signature.saturationRange);
  const lightnessFit = rangeFit(stats.meanLightness, preset.signature.lightnessRange);
  const densityFit = rangeFit(tileData.params.density, preset.signature.densityRange);
  const overlapFit = rangeFit(tileData.params.overlapAmount ?? 0, preset.signature.overlapRange);
  const overall = Math.round((hueFit + saturationFit + lightnessFit + densityFit + overlapFit) / 5);
  return {
    hueFit: Math.round(hueFit),
    saturationFit: Math.round(saturationFit),
    lightnessFit: Math.round(lightnessFit),
    densityFit: Math.round(densityFit),
    overlapFit: Math.round(overlapFit),
    overall,
  };
}
