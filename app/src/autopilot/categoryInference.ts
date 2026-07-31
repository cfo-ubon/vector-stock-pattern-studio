import { GENERATORS } from '../generators';

// Build 029 — the one place Autopilot maps a free-text theme onto a real,
// generator-supported `categoryId`. `GENERATORS` (generators/index.ts) is
// the actual capability registry — every id returned here is guaranteed to
// exist in it, so nothing downstream can ever hand the generator an
// unsupported category (spec's own explicit rule). Mirrors the keyword
// table `design-director/handoff/generatorHandoffBuilder.ts` already uses
// for the same purpose, kept as a separate table here since that module's
// is private or module-scoped, not exported for reuse.

const CATEGORY_KEYWORD_RULES: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['botanical', 'floral', 'flower', 'garden', 'bouquet'], categoryId: 'botanical' },
  { keywords: ['tropical', 'palm', 'jungle'], categoryId: 'tropical' },
  { keywords: ['geometric', 'abstract'], categoryId: 'geometric' },
  { keywords: ['mandala'], categoryId: 'mandala' },
  { keywords: ['damask'], categoryId: 'damask' },
  { keywords: ['paisley', 'ikat'], categoryId: 'paisley' },
  { keywords: ['plaid', 'check', 'tartan'], categoryId: 'plaid' },
  { keywords: ['animal print', 'leopard', 'zebra', 'tiger'], categoryId: 'animalprint' },
  { keywords: ['boho', 'tribal'], categoryId: 'boho' },
  { keywords: ['line art', 'lineart', 'minimal'], categoryId: 'lineart' },
  { keywords: ['cute', 'kids', 'children'], categoryId: 'cute' },
  { keywords: ['christmas', 'holiday', 'seasonal', 'festive'], categoryId: 'seasonal' },
  { keywords: ['retro', 'vintage'], categoryId: 'retro' },
  { keywords: ['terrazzo'], categoryId: 'terrazzo' },
  { keywords: ['organic'], categoryId: 'organic' },
];

/** The full, real list of generator-supported categories — every value
 * Autopilot may ever choose is drawn from here, never invented. */
export function supportedCategoryIds(): string[] {
  return Object.keys(GENERATORS);
}

export function isSupportedCategoryId(categoryId: string): boolean {
  return categoryId in GENERATORS;
}

export interface CategoryInferenceResult {
  categoryId: string;
  matched: boolean;
}

/** Infers a real, generator-supported category from free text — falls back
 * to "botanical" (this app's broadest, most commercially proven category,
 * same default `generatorHandoffBuilder.ts` uses) only when nothing
 * matches, and reports `matched: false` so the caller can show an honest
 * "generator default" rationale rather than presenting a guess as
 * evidence-backed. */
export function inferCategoryId(text: string): CategoryInferenceResult {
  const lower = text.toLowerCase();
  const match = CATEGORY_KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => lower.includes(kw)));
  return { categoryId: match?.categoryId ?? 'botanical', matched: !!match };
}
