import { COLLECTION_PATTERN_TYPE_LABELS, type CollectionPlan, type CollectionPatternType, type RoadmapStep } from '../domain/collectionPlan';

// Build 028B — Module 3: Collection Roadmap. A real, documented per-pattern-
// type hour estimate (hero patterns take longest — a fully custom focal
// motif; blender/texture/mini patterns are the fastest since they're
// deliberately simple filler prints) multiplied by the Collection Plan's
// real pattern-type counts — never a fabricated total. Colorway Expansion is
// estimated separately and lightly, since this app's own Color Story Engine
// (`collection/colorStory.ts`) automates recoloring an already-designed
// palette rather than redesigning from scratch.

const HOURS_PER_PATTERN: Record<CollectionPatternType, number> = {
  hero: 3,
  secondary: 2,
  blender: 1.5,
  coordinate: 1.5,
  stripe: 1,
  border: 1.5,
  miniPattern: 1,
  texture: 0.75,
};

/** Production order a real studio would follow: design the hero first (it
 * anchors the whole collection's style), then the prints that must
 * coordinate visually with it, then the simpler filler/format prints, and
 * finally expand everything into additional colorways once the core
 * collection is locked. */
const PRODUCTION_ORDER: CollectionPatternType[] = ['hero', 'secondary', 'blender', 'coordinate', 'stripe', 'border', 'miniPattern', 'texture'];

const HOURS_PER_PATTERN_PER_EXTRA_COLORWAY = 0.1;

export function buildCollectionRoadmap(plan: CollectionPlan): RoadmapStep[] {
  const steps: RoadmapStep[] = [];
  let order = 1;
  for (const type of PRODUCTION_ORDER) {
    const count = plan.patternTypeCounts[type] ?? 0;
    if (count <= 0) continue;
    steps.push({
      order: order++,
      patternType: type,
      label: `${COLLECTION_PATTERN_TYPE_LABELS[type]} (${count} pattern${count === 1 ? '' : 's'})`,
      count,
      estimatedHours: Math.round(count * HOURS_PER_PATTERN[type] * 10) / 10,
    });
  }

  const extraColorways = Math.max(0, plan.colorwayCount - 1);
  if (extraColorways > 0) {
    steps.push({
      order: order++,
      patternType: 'colorwayExpansion',
      label: `Colorway Expansion (${extraColorways} additional colorway${extraColorways === 1 ? '' : 's'} × ${plan.totalSize} patterns)`,
      count: extraColorways,
      estimatedHours: Math.round(extraColorways * plan.totalSize * HOURS_PER_PATTERN_PER_EXTRA_COLORWAY * 10) / 10,
    });
  }

  return steps;
}

export function totalRoadmapHours(steps: RoadmapStep[]): number {
  return Math.round(steps.reduce((sum, s) => sum + s.estimatedHours, 0) * 10) / 10;
}
