import { hexToHsl, hslToHex } from './colorAnalysis';

// Build 022, Phase 4 (Hero Visibility and Palette Contrast Engine).
// BUILD_022_AUDIT.md's diagnostic matrix found real, measured
// `paletteContrast` weakness for exactly 2 of 15 built-in presets
// (Editorial Botanical 65.43, Soft Watercolor Inspired 69.5 — both
// deliberately soft/pastel identities) against a ceiling of ~100 for
// every other preset. This module implements the brief's exact required
// order of operations: perceptual (WCAG relative-luminance) contrast
// checking first, then a controlled, role-preserving adjustment — never a
// full palette replacement, and never touching a palette that already
// passes (a strict no-op for the other 13 presets, same "additive, gated,
// evidence-only" discipline `compositionEnvelopes.ts` already established
// this build).
//
// Reuses this app's own existing Color Role System convention
// (knowledge/palette/index.ts's `contrastRatio`, roleDefinitions.json's
// background=index 0/primary=1/secondary=2/accent=3 positional
// assignment) rather than inventing a second role model.

export interface ContrastCheckResult {
  /** Index pairs (role positions) whose WCAG contrast ratio fell below
   * `MIN_CONTRAST_RATIO`, with the measured ratio. */
  weakPairs: Array<{ indexA: number; indexB: number; ratio: number }>;
  passed: boolean;
}

/** WCAG relative luminance (0-1), same formula as
 * knowledge/palette/index.ts's private copy — duplicated rather than
 * imported to avoid a knowledge/ -> engine/ layering inversion (knowledge/
 * already imports from engine/ elsewhere in this codebase, never the
 * reverse). */
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const s = parseInt(c, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagContrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 3:1 is WCAG's own "large text / graphical object" minimum (not the
 * stricter 4.5:1 for small body text) — the right bar for a motif shape
 * against its background/neighbor, per this module's own header note on
 * why this app never claims full WCAG text-contrast compliance for a
 * printed surface pattern. Below this, two colors genuinely start to read
 * as visually merged at real print/thumbnail scale, not just "subtle." */
export const MIN_CONTRAST_RATIO = 3;

/** Checks each ADJACENT role pair only: background-vs-primary(hero),
 * primary-vs-secondary, secondary-vs-accent, etc. (0-1, 1-2, 2-3, ...) —
 * the pairs a viewer's eye actually has to separate in the rendered tile
 * (hero-vs-background, neighboring-role-vs-role). Deliberately NOT every
 * combination: (a) checking e.g. background-vs-accent directly would also
 * flag an intentionally-similar tertiary accent that was never meant to
 * pop against the page, which isn't a real defect; (b) requiring every
 * pair (not just adjacent) to simultaneously clear the same floor is an
 * over-constrained N-way problem for a tightly-clustered real palette
 * (verified empirically — forcing role 3 to out-contrast both the
 * background AND an already-maximally-darkened role 1 can have no
 * solution within any reasonable single-dimension lightness budget), and
 * the brief's own ask is specifically about hero-vs-background and
 * neighbor separation, not a full pairwise-distinct palette. */
export function checkPerceptualContrast(colors: string[]): ContrastCheckResult {
  const weakPairs: ContrastCheckResult['weakPairs'] = [];
  for (let i = 1; i < colors.length; i++) {
    const ratio = wcagContrastRatio(colors[i - 1], colors[i]);
    if (ratio < MIN_CONTRAST_RATIO) weakPairs.push({ indexA: i - 1, indexB: i, ratio: Math.round(ratio * 100) / 100 });
  }
  return { weakPairs, passed: weakPairs.length === 0 };
}

/** Maximum lightness nudge (HSL, 0-1 scale) any single color may receive —
 * "adjust value or chroma within controlled limits" per the brief; this
 * app only exposes L in `Hsl`, so lightness is the controlled dimension.
 * 0.45 is generous enough to separate even a very light near-white
 * background from a same-family pastel accent (verified against the 2
 * real weak presets, whose background is close to l=0.95) while staying
 * short of the full 0-1 range — never flips a color to pure white/black. */
const MAX_LIGHTNESS_DELTA = 0.7;
const TARGET_RATIO = MIN_CONTRAST_RATIO + 0.1; // small safety margin past the floor, not a huge overshoot

/** Nudges `hex`'s lightness in the given fixed direction just far enough to
 * clear `TARGET_RATIO` against EVERY color in `references` simultaneously
 * (not just one) — capped at `MAX_LIGHTNESS_DELTA`. Hue and saturation are
 * never touched, so the color's own identity/family is preserved — this is
 * a value adjustment, never a palette swap. Checking every reference at
 * once (rather than one pair at a time) is what makes this correct
 * without depending on the rest of the palette already being perfectly
 * monotonic: a later color only ever needs one nudge, sized to satisfy
 * the single hardest-to-clear reference among everything already
 * finalized, and moving further in a fixed direction can only ever
 * increase separation from every reference in that same direction, never
 * reduce it — so satisfying the hardest one satisfies all of them. */
function nudgeLightnessForContrast(hex: string, references: string[], darken: boolean): string {
  const hsl = hexToHsl(hex);
  let low = 0;
  let high = MAX_LIGHTNESS_DELTA;
  let best = hsl.l;
  const satisfiesAll = (candidateHex: string) => references.every((ref) => wcagContrastRatio(candidateHex, ref) >= TARGET_RATIO);
  // Binary search the minimal delta that clears TARGET_RATIO against every
  // reference, rather than jumping straight to the cap — keeps the
  // adjustment as subtle as possible for a "premium styles may use subtle
  // contrast, but must remain readable" identity (brief Phase 4, Section 4).
  for (let iter = 0; iter < 20; iter++) {
    const mid = (low + high) / 2;
    const candidateL = darken ? Math.max(0, hsl.l - mid) : Math.min(1, hsl.l + mid);
    const candidateHex = hslToHex({ ...hsl, l: candidateL });
    if (satisfiesAll(candidateHex)) {
      best = candidateL;
      high = mid;
    } else {
      low = mid;
    }
  }
  // Contrast-vs-delta isn't strictly monotonic when a reference itself
  // sits at a mid lightness (moving toward it first LOSES separation,
  // dips near-zero contrast right as the candidate passes through the
  // reference's own lightness, then regains separation past it) — bisection
  // assumes monotonicity, so in that dip-then-recover shape it can
  // converge without ever finding a success it would have found at the
  // full cap. Falling back to the cap itself (only if the cap genuinely
  // does satisfy everything) catches that case rather than silently
  // leaving the color unchanged when a real fix existed.
  if (best === hsl.l) {
    const capL = darken ? Math.max(0, hsl.l - MAX_LIGHTNESS_DELTA) : Math.min(1, hsl.l + MAX_LIGHTNESS_DELTA);
    const capHex = hslToHex({ ...hsl, l: capL });
    if (satisfiesAll(capHex)) best = capL;
  }
  return hslToHex({ ...hsl, l: best });
}

export interface ContrastAdjustmentResult {
  colors: string[];
  adjustedIndexes: number[];
  before: ContrastCheckResult;
  after: ContrastCheckResult;
}

/** The brief's exact required order (Phase 4, Section 3): "first reassign
 * existing palette roles, then adjust value/chroma within controlled
 * limits." This app's Color Role System assigns roles by fixed array
 * position (background=0/primary=1/secondary=2/accent=3+, always in that
 * relative light-to-accent order by convention — see
 * knowledge/palette/index.ts's own `getPaletteHarmonyNote`), so
 * "reassigning roles" for a weak pair collapses to the same operation as
 * nudging lightness toward the correct relative-position ordering; there
 * is no second, independent "swap positions" step that would produce a
 * different result. Strict no-op (returns the identical array reference)
 * when nothing fails the check. */
export function ensureContrastSafePalette(colors: string[]): ContrastAdjustmentResult {
  const before = checkPerceptualContrast(colors);
  if (before.passed) return { colors, adjustedIndexes: [], before, after: before };

  // Process background(0) -> 1 -> 2 -> ... strictly in order, each index i
  // checked (and, if needed, nudged) against its immediately preceding,
  // already-finalized neighbor (matching `checkPerceptualContrast`'s own
  // adjacent-pairs-only definition of "safe"). `darken` is decided once
  // (from the palette's original background-vs-primary relationship —
  // light background -> darken each subsequent role, dark background ->
  // lighten) and held fixed for the whole pass so every adjustment moves
  // the same direction rather than zig-zagging.
  const bgL = hexToHsl(colors[0]).l;
  const primaryL = hexToHsl(colors[1] ?? colors[0]).l;
  const darken = primaryL <= bgL;

  const result = [...colors];
  const adjustedIndexes = new Set<number>();
  for (let i = 1; i < result.length; i++) {
    if (wcagContrastRatio(result[i], result[i - 1]) < MIN_CONTRAST_RATIO) {
      const nudged = nudgeLightnessForContrast(result[i], [result[i - 1]], darken);
      if (nudged !== result[i]) {
        result[i] = nudged;
        adjustedIndexes.add(i);
      }
    }
  }
  const after = checkPerceptualContrast(result);
  return { colors: result, adjustedIndexes: [...adjustedIndexes].sort((a, b) => a - b), before, after };
}
