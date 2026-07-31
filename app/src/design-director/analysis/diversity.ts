import type { CollectionPlan } from '../domain/collectionPlan';
import type { CreativeBrief } from '../domain/creativeBrief';
import type { PortfolioAsset } from '../../catalog/domain/types';

// Build 028B — Module 6: Collection Diversity. Real repetition analysis
// against the actual stored Portfolio Manager catalog (`catalog/domain/types.ts`'s
// `PortfolioAsset[]`) — the only real, already-existing source of "what has
// this studio already made" at planning time. Three of the six signals the
// brief names (composition/pattern/collection-level repetition) cannot be
// computed honestly until real generated assets exist for *this* collection
// — rather than fabricating a number for them, they're returned with
// `available: false` and an explanation of what would make them computable.

export type DiversitySignalId = 'heroRepetition' | 'paletteRepetition' | 'compositionRepetition' | 'patternRepetition' | 'collectionRepetition' | 'portfolioRepetition';

export interface DiversitySignal {
  id: DiversitySignalId;
  label: string;
  available: boolean;
  value?: number;
  note: string;
}

export interface CollectionDiversity {
  signals: DiversitySignal[];
  warnings: string[];
}

const HIGH_THEME_REPETITION_THRESHOLD = 5;
const HIGH_PALETTE_OVERLAP_THRESHOLD = 0.7;

export function computeCollectionDiversity(plan: CollectionPlan, brief: CreativeBrief, portfolioAssets: PortfolioAsset[]): CollectionDiversity {
  const active = portfolioAssets.filter((a) => !a.isArchived);
  const themeText = plan.theme.toLowerCase();

  const themeMatches = active.filter((a) => a.displayName.toLowerCase().includes(themeText) || (a.patternType ?? '').toLowerCase().includes(themeText));

  const briefColors = new Set(brief.colorDirection.map((c) => c.toLowerCase()));
  let paletteOverlapAssetCount = 0;
  if (briefColors.size > 0) {
    for (const asset of active) {
      const overlap = asset.colorPalette.filter((c) => briefColors.has(c.toLowerCase())).length;
      if (overlap / briefColors.size >= HIGH_PALETTE_OVERLAP_THRESHOLD) paletteOverlapAssetCount += 1;
    }
  }

  const signals: DiversitySignal[] = [
    {
      id: 'heroRepetition',
      label: 'Hero repetition',
      available: true,
      value: themeMatches.length,
      note:
        themeMatches.length > 0
          ? `${themeMatches.length} existing portfolio asset(s) already share the theme "${plan.theme}".`
          : `No existing portfolio asset shares the theme "${plan.theme}" — this collection would be new territory.`,
    },
    {
      id: 'paletteRepetition',
      label: 'Palette repetition',
      available: briefColors.size > 0,
      value: briefColors.size > 0 ? paletteOverlapAssetCount : undefined,
      note:
        briefColors.size > 0
          ? `${paletteOverlapAssetCount} existing portfolio asset(s) already share ${Math.round(HIGH_PALETTE_OVERLAP_THRESHOLD * 100)}%+ of this brief's color direction.`
          : 'The Creative Brief has no color direction set yet — palette repetition cannot be checked.',
    },
    {
      id: 'compositionRepetition',
      label: 'Composition repetition',
      available: false,
      note: 'Not computable until this collection has a Generator Handoff composition assigned (Module 11) — a plan alone has no composition data.',
    },
    {
      id: 'patternRepetition',
      label: 'Pattern repetition',
      available: false,
      note: 'Not computable until real patterns are generated for this collection — there is nothing to compare yet.',
    },
    {
      id: 'collectionRepetition',
      label: 'Collection repetition',
      available: false,
      note: 'Not computable until this Collection Plan is linked to a real saved Collection (Portfolio Manager) with member assets.',
    },
    {
      id: 'portfolioRepetition',
      label: 'Portfolio repetition',
      available: true,
      value: active.length,
      note: `${active.length} active portfolio asset(s) exist to compare against as this collection is produced.`,
    },
  ];

  const warnings: string[] = [];
  if (themeMatches.length >= HIGH_THEME_REPETITION_THRESHOLD) {
    warnings.push(`${themeMatches.length} existing portfolio assets already cover "${plan.theme}" — consider a more differentiated theme or angle.`);
  }
  if (briefColors.size > 0 && paletteOverlapAssetCount >= HIGH_THEME_REPETITION_THRESHOLD) {
    warnings.push(`${paletteOverlapAssetCount} existing portfolio assets already use a very similar color direction — consider a more distinct palette.`);
  }

  return { signals, warnings };
}
