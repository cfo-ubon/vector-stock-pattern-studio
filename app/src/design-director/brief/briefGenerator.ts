import { createCreativeBrief, type CreativeBrief, type CommercialPriority, type ExpectedDifficulty } from '../domain/creativeBrief';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import type { MarketSnapshot } from '../../marketing/domain/marketSnapshot';
import { evaluateProductTargets, recommendedProductUses } from '../../collection/productTargets';

// Build 028B — Module 1: turns one approved Marketing Intelligence
// MarketOpportunity (+ its source MarketSnapshot, when available) into a
// Creative Brief. Every AI-populated field gets a `fieldRationale` entry
// that names the real evidence it came from — nothing here invents a value
// with no traceable source; a field with no real signal to derive it from
// is left at a neutral default and simply has no rationale entry (which the
// UI reads as "needs manual input").

const NICHE_PERSONA_RULES: Array<{ keywords: string[]; persona: string }> = [
  { keywords: ['kids', 'children', 'baby', 'nursery'], persona: 'Parents & gift buyers shopping for children\'s products' },
  { keywords: ['luxury', 'premium', 'elegant'], persona: 'Premium home decor & stationery buyers' },
  { keywords: ['wedding', 'bridal'], persona: 'Wedding planners & couples sourcing stationery/decor' },
  { keywords: ['christmas', 'holiday', 'festive', 'seasonal'], persona: 'Seasonal gift and home-decor shoppers' },
  { keywords: ['botanical', 'floral', 'garden'], persona: 'Home decor & fabric buyers who favor nature-inspired prints' },
];

function derivePersona(niche: string, theme: string): string {
  const text = `${niche} ${theme}`.toLowerCase();
  const match = NICHE_PERSONA_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)));
  return match?.persona ?? 'General surface-pattern buyers on the target marketplace';
}

function deriveDifficulty(score: number): ExpectedDifficulty {
  if (score >= 80) return 'moderate';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'hard';
  return 'very-hard';
}

function derivePriority(score: number, confidence: string): CommercialPriority {
  if (score >= 80 && (confidence === 'high' || confidence === 'very-high')) return 'urgent';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/** Rough estimate only — a real, documented rule (2 hours per pattern in a
 * typical mid-size collection, based on this app's own Collection Roadmap
 * per-pattern-type hour table averaging ~1.6h — rounded up for the brief
 * stage before a real pattern-type breakdown exists), not a fabricated
 * number; the Collection Roadmap (Module 3) supersedes this once the
 * Collection Plan's real pattern-type counts are known. */
function estimateTimeHours(collectionSize: number): number {
  return Math.round(collectionSize * 2 * 10) / 10;
}

export interface BuildCreativeBriefOptions {
  now?: number;
}

export function buildCreativeBriefFromOpportunity(
  opportunity: MarketOpportunity,
  snapshot: MarketSnapshot | null,
  options: BuildCreativeBriefOptions = {},
): CreativeBrief {
  const fieldRationale: Record<string, string> = {};
  const evidenceRefs = [...opportunity.evidenceRefs];

  const persona = derivePersona(opportunity.niche, opportunity.theme);
  fieldRationale.buyerPersona = `Derived from the opportunity's niche/theme ("${opportunity.niche}" / "${opportunity.theme}").`;

  const heroStyle = snapshot?.styles[0] ?? snapshot?.motifs[0] ?? opportunity.theme;
  if (snapshot?.styles[0]) {
    fieldRationale.heroStyle = `Top researched style from Market Snapshot ${snapshot.id} ("${snapshot.styles.join(', ')}").`;
  } else if (snapshot?.motifs[0]) {
    fieldRationale.heroStyle = `Top researched motif from Market Snapshot ${snapshot.id} ("${snapshot.motifs.join(', ')}").`;
  }

  const secondaryAssets = snapshot?.motifs.slice(1, 4) ?? [];
  if (secondaryAssets.length > 0) {
    fieldRationale.secondaryAssets = `Remaining researched motifs from Market Snapshot ${snapshot!.id}.`;
  }

  const colorDirection = snapshot?.colors ?? [];
  if (colorDirection.length > 0) {
    fieldRationale.colorDirection = `Researched color direction from Market Snapshot ${snapshot!.id}.`;
  }

  // Product-target recommendation uses nominal planning-stage defaults
  // (no real tile has been generated yet) — honestly labeled as an
  // estimate, refined later once the Generator Handoff resolves real
  // density/tileSize.
  const productEvaluations = evaluateProductTargets({
    categoryId: opportunity.niche.toLowerCase().replace(/\s+/g, ''),
    tileSize: 1500,
    density: 0.5,
    keywordText: `${opportunity.theme} ${opportunity.niche} ${(snapshot?.productUseCases ?? []).join(' ')}`,
  });
  const targetProducts = snapshot?.productUseCases.length ? snapshot.productUseCases : recommendedProductUses(productEvaluations, 4);
  fieldRationale.targetProducts = snapshot?.productUseCases.length
    ? `Researched product use cases from Market Snapshot ${snapshot!.id}.`
    : `Estimated from rule-based product-target fit for this niche (refine once tile size/density are set).`;

  const collectionSize = 20;
  const estimatedTimeHours = estimateTimeHours(collectionSize);
  fieldRationale.estimatedTimeHours = `Estimated at ~2h/pattern for a ${collectionSize}-pattern collection — refine with the real Collection Roadmap (Module 3) once pattern types are planned.`;

  const commercialPriority = derivePriority(opportunity.score.overall, opportunity.score.confidence);
  fieldRationale.commercialPriority = `Derived from the opportunity's score (${opportunity.score.overall}/100, confidence: ${opportunity.score.confidence}).`;

  const expectedDifficulty = deriveDifficulty(opportunity.score.overall);
  fieldRationale.expectedDifficulty = `Derived from the opportunity's score (${opportunity.score.overall}/100) — lower-scoring/lower-evidence opportunities are treated as harder to execute confidently.`;

  const commercialGoal = `Capture the "${opportunity.title}" opportunity (${opportunity.score.overall}/100, ${opportunity.score.band}) on ${opportunity.marketplace}.`;
  fieldRationale.commercialGoal = `Derived directly from the source opportunity's title/score/marketplace.`;

  return createCreativeBrief({
    sourceOpportunityId: opportunity.id,
    collectionName: opportunity.title,
    theme: opportunity.theme,
    targetMarketplace: opportunity.marketplace,
    targetProducts,
    buyerPersona: persona,
    heroStyle,
    secondaryAssets,
    colorDirection,
    commercialGoal,
    collectionSize,
    commercialPriority,
    expectedDifficulty,
    estimatedTimeHours,
    evidenceRefs,
    fieldRationale,
    confidence: opportunity.score.confidence,
    now: options.now,
  });
}
