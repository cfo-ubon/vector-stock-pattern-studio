import type { PortfolioAsset } from '../../catalog/domain/types';
import type { CollectionPlan } from '../domain/collectionPlan';
import type { CreativeBrief } from '../domain/creativeBrief';

// Build 028B — Module 10: Portfolio Impact. Qualitative-only statements
// (explicitly no revenue estimates, per the brief) derived from real counts
// against the already-stored Portfolio Manager catalog — never a fabricated
// business-impact claim.

interface CategoryRule {
  id: string;
  label: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { id: 'kids', label: 'Kids', keywords: ['kids', 'children', 'baby', 'nursery'] },
  { id: 'luxury', label: 'Luxury', keywords: ['luxury', 'premium', 'elegant'] },
  { id: 'floral', label: 'Floral', keywords: ['floral', 'botanical', 'flower', 'garden'] },
  { id: 'christmas', label: 'Christmas/Holiday', keywords: ['christmas', 'holiday', 'festive', 'winter'] },
  { id: 'geometric', label: 'Geometric', keywords: ['geometric', 'abstract'] },
];

function assetText(asset: PortfolioAsset): string {
  return `${asset.displayName} ${asset.patternType ?? ''} ${asset.tags.join(' ')}`.toLowerCase();
}

function categorizeAssets(assets: PortfolioAsset[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rule of CATEGORY_RULES) counts[rule.id] = 0;
  for (const asset of assets) {
    const text = assetText(asset);
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) counts[rule.id] += 1;
    }
  }
  return counts;
}

function matchedCategoryIds(text: string): string[] {
  return CATEGORY_RULES.filter((rule) => rule.keywords.some((kw) => text.includes(kw))).map((r) => r.id);
}

export interface PortfolioImpactStatement {
  statement: string;
  evidence: string;
}

const LOW_COVERAGE_THRESHOLD = 3;
const HIGH_SHARE_THRESHOLD = 0.4;

export function estimatePortfolioImpact(plan: CollectionPlan, brief: CreativeBrief, portfolioAssets: PortfolioAsset[]): PortfolioImpactStatement[] {
  const active = portfolioAssets.filter((a) => !a.isArchived);
  const totalActive = active.length;
  const counts = categorizeAssets(active);
  const briefText = `${plan.theme} ${brief.collectionName} ${brief.heroStyle}`.toLowerCase();
  const briefCategories = matchedCategoryIds(briefText);

  const statements: PortfolioImpactStatement[] = [];

  if (totalActive === 0) {
    statements.push({
      statement: 'Adds the first content to an otherwise empty portfolio.',
      evidence: 'No active portfolio assets currently exist to compare against.',
    });
    return statements;
  }

  for (const categoryId of briefCategories) {
    const rule = CATEGORY_RULES.find((r) => r.id === categoryId)!;
    const count = counts[categoryId];
    if (count <= LOW_COVERAGE_THRESHOLD) {
      statements.push({
        statement: `Improves ${rule.label} category coverage.`,
        evidence: `Only ${count} of ${totalActive} active portfolio assets currently match "${rule.label}".`,
      });
    }
  }

  // If this brief does NOT match a category that dominates the existing
  // portfolio, it genuinely reduces reliance on that category — a real,
  // checkable comparison, not a guess.
  for (const rule of CATEGORY_RULES) {
    if (briefCategories.includes(rule.id)) continue;
    const share = counts[rule.id] / totalActive;
    if (share >= HIGH_SHARE_THRESHOLD) {
      statements.push({
        statement: `Reduces reliance on ${rule.label} content.`,
        evidence: `${rule.label} currently makes up ${Math.round(share * 100)}% of active portfolio assets (${counts[rule.id]}/${totalActive}); this collection adds content outside that category.`,
      });
    }
  }

  if (briefCategories.length === 0) {
    statements.push({
      statement: 'Adds evergreen/new content not currently represented by any tracked portfolio category.',
      evidence: `This collection's theme ("${plan.theme}") did not match any of the ${CATEGORY_RULES.length} tracked portfolio categories.`,
    });
  }

  if (statements.length === 0) {
    statements.push({
      statement: 'This collection overlaps with existing, well-covered portfolio categories — limited net new expansion expected.',
      evidence: `Every matched category (${briefCategories.map((id) => CATEGORY_RULES.find((r) => r.id === id)!.label).join(', ')}) already has more than ${LOW_COVERAGE_THRESHOLD} active portfolio assets.`,
    });
  }

  return statements;
}
