import type { GenerateParams, LayoutId } from './types';
import { HIERARCHY_PRESETS } from './hierarchy';
import { GENERATORS } from '../generators';

// Art Direction presets: named bundles of REAL, already-implemented engine
// parameters (category, layout, hierarchy preset, negative space, overlap,
// color story, filler, shadow/highlight, and sometimes a palette). No
// preset introduces a control that doesn't map to something the engine
// actually reads — "line detail", "cluster complexity" etc. from a naive
// reading of a design brief are deliberately not represented here since
// there's no corresponding generator/layout parameter for them yet.

interface ArtDirectionPreset {
  label: string;
  categoryId?: string;
  layoutId?: LayoutId;
  paletteId?: string;
  hierarchy: keyof typeof HIERARCHY_PRESETS;
  negativeSpace: number;
  overlapAmount: number;
  density?: number;
  colorStory: boolean;
  fillerStyle: 'none' | 'subtle' | 'rich';
  flatShadow?: boolean;
  flatHighlight?: boolean;
}

export const ART_DIRECTION_PRESETS: Record<string, ArtDirectionPreset> = {
  editorialBotanical: {
    label: 'Editorial Botanical',
    categoryId: 'botanical', layoutId: 'heroFlow', hierarchy: 'balancedEditorial',
    negativeSpace: 0.2, overlapAmount: 0.1, density: 0.5, colorStory: true, fillerStyle: 'subtle',
  },
  luxuryFloral: {
    label: 'Luxury Floral',
    categoryId: 'botanical', layoutId: 'bouquet', paletteId: 'jewel-tones', hierarchy: 'heroFocus',
    negativeSpace: 0.15, overlapAmount: 0.2, density: 0.55, colorStory: true, fillerStyle: 'subtle', flatHighlight: true,
  },
  airyScandinavian: {
    label: 'Airy Scandinavian',
    categoryId: 'botanical', layoutId: 'airy', paletteId: 'coastal-neutral', hierarchy: 'airyPremium',
    negativeSpace: 0.5, overlapAmount: 0, density: 0.35, colorStory: true, fillerStyle: 'none',
  },
  denseGarden: {
    label: 'Dense Garden',
    categoryId: 'botanical', layoutId: 'densePremium', hierarchy: 'denseLayered',
    negativeSpace: 0, overlapAmount: 0.3, density: 0.7, colorStory: true, fillerStyle: 'rich',
  },
  vintageHerbarium: {
    label: 'Vintage Herbarium',
    categoryId: 'botanical', layoutId: 'scatter', paletteId: 'earth-tone', hierarchy: 'allOverTextile',
    negativeSpace: 0.25, overlapAmount: 0, density: 0.45, colorStory: false, fillerStyle: 'subtle',
  },
  modernOrganic: {
    label: 'Modern Organic',
    categoryId: 'organic', layoutId: 'scatter', hierarchy: 'balancedEditorial',
    negativeSpace: 0.2, overlapAmount: 0.1, density: 0.5, colorStory: true, fillerStyle: 'subtle',
  },
  playfulKids: {
    label: 'Playful Kids',
    categoryId: 'cute', layoutId: 'toss', paletteId: 'candy-shop', hierarchy: 'ditsyFloral',
    negativeSpace: 0.1, overlapAmount: 0.1, density: 0.55, colorStory: true, fillerStyle: 'rich', flatShadow: true, flatHighlight: true,
  },
  resortTropical: {
    label: 'Resort Tropical',
    categoryId: 'tropical', layoutId: 'heroScatter', paletteId: 'citrus-pop', hierarchy: 'heroFocus',
    negativeSpace: 0.1, overlapAmount: 0.15, density: 0.55, colorStory: true, fillerStyle: 'subtle',
  },
  textileClassic: {
    label: 'Textile Classic',
    categoryId: 'damask', layoutId: 'halfDrop', hierarchy: 'allOverTextile',
    negativeSpace: 0, overlapAmount: 0, density: 0.55, colorStory: true, fillerStyle: 'none',
  },
  minimalGeometric: {
    label: 'Minimal Geometric',
    categoryId: 'geometric', layoutId: 'gridMinimal', paletteId: 'mono-charcoal', hierarchy: 'minimalRepeat',
    negativeSpace: 0.35, overlapAmount: 0, density: 0.4, colorStory: false, fillerStyle: 'none',
  },
  retroEditorial: {
    label: 'Retro Editorial',
    categoryId: 'retro', layoutId: 'heroFlow', hierarchy: 'balancedEditorial',
    negativeSpace: 0.15, overlapAmount: 0.1, density: 0.5, colorStory: true, fillerStyle: 'subtle',
  },
  premiumWallpaper: {
    label: 'Premium Wallpaper',
    categoryId: 'damask', layoutId: 'densePremium', hierarchy: 'denseLayered',
    negativeSpace: 0, overlapAmount: 0.25, density: 0.65, colorStory: true, fillerStyle: 'rich', flatHighlight: true,
  },
  boutiquePackaging: {
    label: 'Boutique Packaging',
    categoryId: 'geometric', layoutId: 'stripe', hierarchy: 'allOverTextile',
    negativeSpace: 0.1, overlapAmount: 0, density: 0.5, colorStory: true, fillerStyle: 'subtle',
  },
  cottageGarden: {
    label: 'Cottage Garden',
    categoryId: 'botanical', layoutId: 'sCurve', hierarchy: 'ditsyFloral',
    negativeSpace: 0.15, overlapAmount: 0.15, density: 0.55, colorStory: true, fillerStyle: 'subtle',
  },
  darkBotanical: {
    label: 'Dark Botanical',
    categoryId: 'botanical', layoutId: 'bouquet', paletteId: 'midnight-botanical', hierarchy: 'heroFocus',
    negativeSpace: 0.1, overlapAmount: 0.2, density: 0.55, colorStory: true, fillerStyle: 'subtle', flatShadow: true,
  },
};

/** Resolve a preset id into a GenerateParams patch, or null if unknown.
 * The returned artDirection id is written back into params so the choice
 * round-trips through save/export/JSON without re-deriving it. */
export function resolveArtDirection(id: string): Partial<GenerateParams> | null {
  const preset = ART_DIRECTION_PRESETS[id];
  if (!preset) return null;
  const patch: Partial<GenerateParams> = {
    artDirection: id,
    hierarchy: HIERARCHY_PRESETS[preset.hierarchy].value,
    negativeSpace: preset.negativeSpace,
    overlapAmount: preset.overlapAmount,
    colorStory: preset.colorStory,
    fillerStyle: preset.fillerStyle,
  };
  if (preset.categoryId && GENERATORS[preset.categoryId]) {
    patch.categoryId = preset.categoryId;
    patch.motifSize = GENERATORS[preset.categoryId].defaultMotifSize;
  }
  if (preset.layoutId) patch.layoutId = preset.layoutId;
  if (preset.paletteId) patch.paletteId = preset.paletteId;
  if (preset.density !== undefined) patch.density = preset.density;
  if (preset.flatShadow !== undefined) patch.flatShadow = preset.flatShadow;
  if (preset.flatHighlight !== undefined) patch.flatHighlight = preset.flatHighlight;
  return patch;
}
