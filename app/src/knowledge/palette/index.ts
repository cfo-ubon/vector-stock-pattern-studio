import { listPalettes, getPalette, getColorRoleSystem, resolveColorRolesForPalette, isPaletteCompatible } from '../../services/colorRoleService';
import { COLOR_STORY_VARIANT_IDS, buildColorStory, type ColorStoryVariantId, type ColorStorySet } from '../../collection/colorStory';
import type { PaletteData } from '../../color-roles';

// Design Knowledge Engine (Phase 6.5) — Section 6 "Palette Knowledge". A
// thin facade over `color-roles/*` + `services/colorRoleService.ts` +
// `collection/colorStory.ts` (the real "Color Stories"/"Seasonality"
// engine, built in Commercial Collection Engine Phase 4). "Harmony rules"
// = the Color Role System's fixed background/primary/secondary/accent
// role assignment (`assignColorRoles`) — that IS this app's real harmony
// convention, not a separate un-built concept.
//
// "Accessibility notes" is genuinely new: no prior module computed a
// contrast signal *per palette* (engine/scoring.ts's `paletteContrast` is
// a post-render metric on an already-generated tile's actual colors, not
// a static palette property). `getPaletteAccessibilityNote` below computes
// the real WCAG relative-luminance contrast ratio between every color pair
// in the palette — standard color-science math, not invented — and
// reports the weakest pair. Worded as an informational note, not a pass/
// fail badge: WCAG's text-contrast thresholds are defined for UI
// foreground-on-background text, not fills in a printed surface pattern,
// so this app doesn't claim AA/AAA compliance, only surfaces the real
// number for a designer to judge.

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x relative luminance (0-1). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1-21) between two hex colors. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface PaletteAccessibilityNote {
  weakestPairContrast: number;
  message: string;
}

const LOW_CONTRAST_THRESHOLD = 2;

/** The lowest pairwise contrast ratio in the palette, plus an honest
 * note — not a WCAG pass/fail claim (see module header). */
export function getPaletteAccessibilityNote(paletteId: string): PaletteAccessibilityNote | undefined {
  const palette = getPalette(paletteId);
  if (!palette || palette.colors.length < 2) return undefined;
  let weakest = Infinity;
  for (let i = 0; i < palette.colors.length; i++) {
    for (let j = i + 1; j < palette.colors.length; j++) {
      weakest = Math.min(weakest, contrastRatio(palette.colors[i], palette.colors[j]));
    }
  }
  const message =
    weakest < LOW_CONTRAST_THRESHOLD
      ? `Weakest color pair has a low contrast ratio (${weakest.toFixed(2)}:1) — two colors in this palette may read as nearly identical at small motif scale.`
      : `Weakest color pair has a contrast ratio of ${weakest.toFixed(2)}:1 — no near-duplicate colors detected.`;
  return { weakestPairContrast: Math.round(weakest * 100) / 100, message };
}

/** The Color Role System's fixed role assignment IS this app's harmony
 * rule — described here rather than re-derived. */
export function getPaletteHarmonyNote(): string {
  const system = getColorRoleSystem();
  const roleOrder = system.roles.map((r) => `${r.id} (index ${r.paletteIndex})`).join(', ');
  return `Fixed role assignment by palette-array position: ${roleOrder}. Every palette with at least ${system.minPaletteColors} colors follows this same convention, so role meaning never drifts between palettes.`;
}

export function listPaletteKnowledge(): PaletteData[] {
  return listPalettes();
}

export function getPaletteKnowledge(id: string): PaletteData | undefined {
  return getPalette(id);
}

export function getPaletteColorRoles(paletteId: string): Record<string, string> | undefined {
  return resolveColorRolesForPalette(paletteId);
}

export function isPaletteKnowledgeCompatible(paletteId: string): boolean {
  return isPaletteCompatible(paletteId);
}

export function listColorStoryVariantIds(): ColorStoryVariantId[] {
  return COLOR_STORY_VARIANT_IDS;
}

/** The real 13-variant Color Story (seasonality + light/dark/bold/etc.)
 * for a palette's own colors. */
export function getColorStoryForPalette(paletteId: string): ColorStorySet | undefined {
  const palette = getPalette(paletteId);
  if (!palette) return undefined;
  return buildColorStory(palette.colors);
}
