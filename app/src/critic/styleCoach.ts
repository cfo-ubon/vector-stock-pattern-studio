import { listStyleKnowledge, type StyleKnowledge } from '../knowledge/style';
import type { DesignSpecification } from '../trend/designSpecTypes';
import type { HierarchyParams } from '../engine/hierarchy';

// Design Critic & Art Direction Engine (Phase 7) — Section 5 "Style
// Coach". The brief names 7 style categories (Luxury, Minimal, Botanical,
// Kids, Scandinavian, Retro, Editorial). Rather than inventing a parallel
// taxonomy, every category here resolves to real `StyleKnowledge` records
// (`knowledge/style`, Design Knowledge Engine Phase 6.5's facade over the
// real 15 Style DNA presets) via a real-field match (id/label keyword, or
// — for Botanical/Kids — the style's own `preferredMotifFamilies`), so a
// "Luxury" coaching note is always grounded in an actual preset
// (`luxuryFloral`/`luxuryWallpaper`), never a fabricated ideal. This
// module's own new logic is only the comparison: how far the *current*
// Design Specification's real fields (density/hierarchy/palette) sit from
// the matched style's real preferred fields — extending
// `engine/styleDna.ts`'s existing `computeStyleDnaConsistency` (a narrow
// 2-signal check) with more field-by-field comparisons, without modifying
// that function.

export type StyleCoachCategory = 'luxury' | 'minimal' | 'botanical' | 'kids' | 'scandinavian' | 'retro' | 'editorial';

export const STYLE_COACH_CATEGORIES: StyleCoachCategory[] = ['luxury', 'minimal', 'botanical', 'kids', 'scandinavian', 'retro', 'editorial'];

const CATEGORY_MATCHERS: Record<StyleCoachCategory, (s: StyleKnowledge) => boolean> = {
  luxury: (s) => /luxury/i.test(s.id) || /luxury/i.test(s.label),
  minimal: (s) => /minimal/i.test(s.id) || /minimal/i.test(s.label),
  botanical: (s) => s.preferredMotifFamilies.includes('botanical'),
  kids: (s) => /kids/i.test(s.id) || s.preferredMotifFamilies.includes('cute'),
  scandinavian: (s) => /scandinavian/i.test(s.id) || /scandinavian/i.test(s.label),
  retro: (s) => /retro/i.test(s.id) || /retro/i.test(s.label),
  editorial: (s) => /editorial/i.test(s.id) || /editorial/i.test(s.label),
};

/** Every real Style DNA preset matching a named style-coach category —
 * empty only if a future edit to the Style DNA library removes every
 * matching preset (never empty today, all 7 categories have a real match
 * per the Phase 7 scoping audit). */
export function findStylesForCategory(category: StyleCoachCategory): StyleKnowledge[] {
  return listStyleKnowledge().filter(CATEGORY_MATCHERS[category]);
}

/** The real style-coach category the spec's own `styleDnaId` belongs to,
 * or null if it matches none of the 7 named categories (e.g. a Style DNA
 * preset outside all 7 groupings, or a custom user-defined style). */
export function detectStyleCoachCategory(spec: DesignSpecification): StyleCoachCategory | null {
  for (const category of STYLE_COACH_CATEGORIES) {
    if (findStylesForCategory(category).some((s) => s.id === spec.styleDnaId)) return category;
  }
  return null;
}

export interface StyleCoachNote {
  category: StyleCoachCategory;
  matchedStyleId: string;
  message: string;
}

function densityNote(current: number, preferred: number, styleLabel: string): string | null {
  const delta = current - preferred;
  if (Math.abs(delta) < 0.1) return null;
  return delta > 0
    ? `${styleLabel} typically favors calmer density (~${Math.round(preferred * 100)}%); yours is ${Math.round(current * 100)}% — consider lowering it.`
    : `${styleLabel} typically favors denser coverage (~${Math.round(preferred * 100)}%); yours is ${Math.round(current * 100)}% — consider raising it.`;
}

function hierarchyNote(current: HierarchyParams, preferred: HierarchyParams, styleLabel: string): string | null {
  if (JSON.stringify(current) === JSON.stringify(preferred)) return null;
  return `${styleLabel} typically leans on a hierarchy with heroScale ~${preferred.heroScale}× (yours differs) — matching its Hierarchy preset would read more on-brand.`;
}

function paletteNote(current: string, preferred: string[], styleLabel: string): string | null {
  if (preferred.length === 0 || preferred.includes(current)) return null;
  return `${styleLabel} typically pairs with the ${preferred.join('/')} palette${preferred.length > 1 ? 's' : ''}; "${current}" is a departure from that — intentional, or worth reconsidering?`;
}

/** Real, field-by-field coaching notes comparing the current spec against
 * the best-matching real Style DNA preset for `category` (or the spec's
 * own detected category when `category` is omitted). Returns `[]` when
 * no category matches, or when the spec already sits close to the
 * matched style's real preferred fields (never a fabricated "looks
 * great!" filler note). */
export function buildStyleCoachNotes(spec: DesignSpecification, category?: StyleCoachCategory): StyleCoachNote[] {
  const resolvedCategory = category ?? detectStyleCoachCategory(spec);
  if (!resolvedCategory) return [];
  const matches = findStylesForCategory(resolvedCategory);
  if (matches.length === 0) return [];
  const style = matches.find((s) => s.id === spec.styleDnaId) ?? matches[0];

  const notes: StyleCoachNote[] = [];
  const density = densityNote(spec.density, style.preferredDensity, style.label);
  if (density) notes.push({ category: resolvedCategory, matchedStyleId: style.id, message: density });
  const hierarchy = hierarchyNote(spec.hierarchy, style.preferredHierarchy, style.label);
  if (hierarchy) notes.push({ category: resolvedCategory, matchedStyleId: style.id, message: hierarchy });
  const palette = paletteNote(spec.palette.id, style.preferredPalettes, style.label);
  if (palette) notes.push({ category: resolvedCategory, matchedStyleId: style.id, message: palette });
  return notes;
}
