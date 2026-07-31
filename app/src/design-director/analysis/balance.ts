import { COLLECTION_PATTERN_TYPE_VALUES, COLLECTION_PATTERN_TYPE_LABELS, type CollectionPlan, type CollectionPatternType } from '../domain/collectionPlan';
import { DEFAULT_PATTERN_TYPE_RATIO } from '../planner/collectionPlanner';

// Build 028B — Module 5: Collection Balance. Compares each pattern type's
// real share of the plan's `totalSize` against the same default ratio the
// Collection Planner itself uses to build a plan (`collectionPlanner.ts`'s
// `DEFAULT_PATTERN_TYPE_RATIO`) — the plan is only flagged "unbalanced"
// relative to its own documented target, not an arbitrary invented ideal.

const TOLERANCE_PERCENTAGE_POINTS = 10;

export interface BalanceEntry {
  patternType: CollectionPatternType;
  label: string;
  count: number;
  actualPercent: number;
  targetPercent: number;
  withinTolerance: boolean;
}

export interface CollectionBalance {
  entries: BalanceEntry[];
  warnings: string[];
}

export function computeCollectionBalance(plan: CollectionPlan): CollectionBalance {
  const total = plan.totalSize > 0 ? plan.totalSize : 1;
  const entries: BalanceEntry[] = COLLECTION_PATTERN_TYPE_VALUES.map((type) => {
    const count = plan.patternTypeCounts[type] ?? 0;
    const actualPercent = Math.round((count / total) * 100);
    const targetPercent = Math.round(DEFAULT_PATTERN_TYPE_RATIO[type] * 100);
    return {
      patternType: type,
      label: COLLECTION_PATTERN_TYPE_LABELS[type],
      count,
      actualPercent,
      targetPercent,
      withinTolerance: Math.abs(actualPercent - targetPercent) <= TOLERANCE_PERCENTAGE_POINTS,
    };
  });

  const warnings: string[] = [];
  for (const entry of entries) {
    if (!entry.withinTolerance) {
      const direction = entry.actualPercent > entry.targetPercent ? 'higher' : 'lower';
      warnings.push(
        `${entry.label} makes up ${entry.actualPercent}% of the collection, ${direction} than the typical ${entry.targetPercent}% for a balanced collection.`,
      );
    }
  }
  if (plan.patternTypeCounts.hero === 0) {
    warnings.push('No hero pattern at all — the collection has no clear focal point for buyers to anchor on.');
  } else if (entries.find((e) => e.patternType === 'hero')!.actualPercent > 25) {
    warnings.push('Hero patterns make up more than a quarter of the collection — this usually means not enough supporting/coordinating prints.');
  }

  return { entries, warnings };
}
