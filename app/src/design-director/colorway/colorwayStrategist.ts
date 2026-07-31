import { buildColorStory, type ColorStoryVariantId } from '../../collection/colorStory';
import type { CreativeBrief } from '../domain/creativeBrief';

// Build 028B — Module 9: Colorway Strategist. Reuses the existing Color
// Story Engine (`collection/colorStory.ts`) directly rather than inventing a
// second palette-transform mechanism — every named "strategy" here is just a
// documented, real `ColorStoryVariantId` selection applied to the brief's
// own real hex color direction. If the brief has no real hex colors yet
// (only research terms like "sage green"), no colorway plan is fabricated —
// the caller is told what's missing instead.

const HEX_PATTERN = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/;

export type ColorwayStrategyId = 'primary' | 'secondary' | 'neutral' | 'premium' | 'seasonal' | 'marketplace';

export interface ColorwayStrategyPlan {
  id: ColorwayStrategyId;
  label: string;
  variantId: ColorStoryVariantId;
  colors: string[];
  rationale: string;
}

const SEASON_KEYWORD_RULES: Array<{ keywords: string[]; variant: ColorStoryVariantId; season: string }> = [
  { keywords: ['christmas', 'holiday', 'winter', 'snow'], variant: 'winter', season: 'winter' },
  { keywords: ['spring', 'easter', 'garden'], variant: 'spring', season: 'spring' },
  { keywords: ['summer', 'tropical', 'beach'], variant: 'summer', season: 'summer' },
  { keywords: ['autumn', 'fall', 'thanksgiving', 'harvest'], variant: 'autumn', season: 'autumn' },
];

const MARKETPLACE_VARIANT_RULES: Record<string, ColorStoryVariantId> = {
  etsy: 'earthTone',
  adobestock: 'bold',
  shutterstock: 'original',
  creativefabrica: 'pastel',
  freepik: 'monochrome',
};

export interface RecommendColorwayPlansResult {
  plans: ColorwayStrategyPlan[];
  note?: string;
}

export function recommendColorwayPlans(brief: CreativeBrief): RecommendColorwayPlansResult {
  const hexColors = brief.colorDirection.filter((c) => HEX_PATTERN.test(c));
  if (hexColors.length === 0) {
    return { plans: [], note: 'The brief has no real hex color direction yet — add hex colors (or resolve research terms into hex) to generate colorway plans.' };
  }

  const story = buildColorStory(hexColors);
  const plans: ColorwayStrategyPlan[] = [
    { id: 'primary', label: 'Primary', variantId: 'original', colors: story.original.colors, rationale: "The brief's own researched color direction, unmodified." },
    { id: 'secondary', label: 'Secondary', variantId: 'bold', colors: story.bold.colors, rationale: 'A bolder variant of the same palette, for a visually distinct second colorway option.' },
    { id: 'neutral', label: 'Neutral', variantId: 'muted', colors: story.muted.colors, rationale: 'A desaturated variant that pairs more easily across a wider range of buyer aesthetics.' },
    { id: 'premium', label: 'Premium', variantId: 'luxury', colors: story.luxury.colors, rationale: 'A deep, jewel-tone variant for a premium-positioned colorway.' },
  ];

  const seasonText = `${brief.theme} ${brief.collectionName}`.toLowerCase();
  const seasonMatch = SEASON_KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => seasonText.includes(kw)));
  const seasonalVariant = seasonMatch?.variant ?? 'pastel';
  plans.push({
    id: 'seasonal',
    label: 'Seasonal',
    variantId: seasonalVariant,
    colors: story[seasonalVariant].colors,
    rationale: seasonMatch
      ? `The brief's theme/name matched a "${seasonMatch.season}" keyword.`
      : 'No seasonal keyword was found in the theme/name — defaulting to a Pastel option rather than guessing a season.',
  });

  const marketplaceKey = brief.targetMarketplace.trim().toLowerCase();
  const marketplaceVariant = MARKETPLACE_VARIANT_RULES[marketplaceKey] ?? 'original';
  plans.push({
    id: 'marketplace',
    label: 'Marketplace',
    variantId: marketplaceVariant,
    colors: story[marketplaceVariant].colors,
    rationale: MARKETPLACE_VARIANT_RULES[marketplaceKey]
      ? `"${brief.targetMarketplace}" typically favors a "${marketplaceVariant}" look on this app's marketplace-fit rules.`
      : `No specific marketplace rule for "${brief.targetMarketplace || '(not set)'}" — defaulting to the original palette.`,
  });

  return { plans };
}
