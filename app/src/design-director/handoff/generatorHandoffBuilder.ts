import { createGeneratorHandoff, type GeneratorHandoff, type HandoffScale, type HandoffSpacing, type HandoffComplexity } from '../domain/generatorHandoff';
import type { CreativeBrief, ExpectedDifficulty } from '../domain/creativeBrief';
import type { CollectionPlan } from '../domain/collectionPlan';
import type { ColorwayStrategyPlan } from '../colorway/colorwayStrategist';

// Build 028B — Module 11: Generator Handoff. The one place that bridges the
// Creative Brief + Collection Plan's business-facing fields into a real,
// generator-ready configuration for the collection's Hero pattern — every
// derived field is a documented rule against a real brief/plan field, with
// a matching `mappingRationale` entry, per the module's "audited mapping"
// requirement. (Non-hero pattern types in the plan would each get their own
// handoff in a full implementation; this module covers the hero — the
// pattern every other type coordinates against — since that is the one the
// Creative Brief's own fields most directly determine.)

const CATEGORY_KEYWORD_RULES: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['botanical', 'floral', 'flower', 'garden'], categoryId: 'botanical' },
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

function deriveCategoryId(theme: string): { categoryId: string; matched: boolean } {
  const text = theme.toLowerCase();
  const match = CATEGORY_KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)));
  return { categoryId: match?.categoryId ?? 'botanical', matched: !!match };
}

const COMPOSITION_BY_DIFFICULTY: Record<ExpectedDifficulty, string> = {
  easy: 'grid',
  moderate: 'balanced-toss',
  hard: 'layered-cluster',
  'very-hard': 'layered-cluster',
};

const DENSITY_BY_DIFFICULTY: Record<ExpectedDifficulty, number> = {
  easy: 0.35,
  moderate: 0.5,
  hard: 0.65,
  'very-hard': 0.75,
};

const COMPLEXITY_BY_DIFFICULTY: Record<ExpectedDifficulty, HandoffComplexity> = {
  easy: 'simple',
  moderate: 'moderate',
  hard: 'intricate',
  'very-hard': 'intricate',
};

const LARGE_SCALE_PRODUCTS = ['wallpaper', 'fabric', 'homeDecor', 'textile'];
const SMALL_SCALE_PRODUCTS = ['stationery', 'giftWrap', 'wrappingPaper', 'notebookCovers'];

function deriveScale(targetProducts: string[]): { scale: HandoffScale; matched: string | null } {
  const large = targetProducts.find((p) => LARGE_SCALE_PRODUCTS.includes(p));
  if (large) return { scale: 'large', matched: large };
  const small = targetProducts.find((p) => SMALL_SCALE_PRODUCTS.includes(p));
  if (small) return { scale: 'small', matched: small };
  return { scale: 'medium', matched: null };
}

function deriveSpacing(density: number): HandoffSpacing {
  if (density >= 0.6) return 'tight';
  if (density <= 0.4) return 'airy';
  return 'balanced';
}

export function buildGeneratorHandoff(brief: CreativeBrief, plan: CollectionPlan, colorwayPlans: ColorwayStrategyPlan[]): GeneratorHandoff {
  const mappingRationale: Record<string, string> = {};

  const { categoryId, matched } = deriveCategoryId(brief.theme || plan.theme);
  mappingRationale.categoryId = matched
    ? `Matched a real generator category keyword in the theme "${brief.theme || plan.theme}".`
    : `No category keyword matched "${brief.theme || plan.theme}" — defaulted to "botanical" (this app's most broadly applicable category).`;

  const composition = COMPOSITION_BY_DIFFICULTY[brief.expectedDifficulty];
  mappingRationale.composition = `Derived from the brief's expected difficulty ("${brief.expectedDifficulty}").`;

  const density = DENSITY_BY_DIFFICULTY[brief.expectedDifficulty];
  mappingRationale.density = `Derived from the brief's expected difficulty ("${brief.expectedDifficulty}") — harder briefs use a denser, more detailed composition.`;

  const complexity = COMPLEXITY_BY_DIFFICULTY[brief.expectedDifficulty];
  mappingRationale.complexity = `Directly mapped from the brief's expected difficulty.`;

  const { scale, matched: matchedProduct } = deriveScale(plan.targetProducts);
  mappingRationale.scale = matchedProduct
    ? `Target product "${matchedProduct}" typically uses a ${scale} repeat scale (collection/productTargets.ts's own tile-size conventions).`
    : 'No target product strongly implies a repeat scale — defaulted to medium.';

  const spacing = deriveSpacing(density);
  mappingRationale.spacing = `Derived from the resolved density (${density}).`;

  const primaryColorway = colorwayPlans.find((p) => p.id === 'primary');
  const palette = primaryColorway?.colors ?? [];
  mappingRationale.palette = primaryColorway
    ? `Primary colorway plan from the Colorway Strategist (Module 9).`
    : 'No colorway plan available yet — add real hex colors to the brief to populate this.';

  const colorwayPlan = colorwayPlans.map((p) => p.variantId);
  mappingRationale.colorwayPlan = `${colorwayPlans.length} colorway(s) recommended by the Colorway Strategist.`;

  mappingRationale.heroMotif = brief.heroStyle ? "Taken directly from the brief's hero style field." : 'Brief has no hero style set — using the theme as a placeholder.';

  return createGeneratorHandoff({
    briefId: brief.id,
    collectionPlanId: plan.id,
    heroMotif: brief.heroStyle || brief.theme,
    secondaryMotifs: brief.secondaryAssets,
    patternType: 'hero',
    categoryId,
    composition,
    density,
    scale,
    palette,
    colorwayPlan,
    spacing,
    complexity,
    commercialNotes: brief.commercialNotes || brief.commercialGoal,
    generatorVersion: 'v1',
    seedStrategy: `collection-${plan.id}`,
    mappingRationale,
  });
}
