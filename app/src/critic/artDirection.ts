import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import type { DesignSpecification } from '../trend/designSpecTypes';
import type { VisualIssue, VisualIssueId } from './visualAnalysis';

// Design Critic & Art Direction Engine (Phase 7) — Section 4 "Art
// Direction Engine". Unlike Section 7's plain-text recommendations
// (`trend/designSpecQuality.ts`'s `buildQualityRecommendations`, already
// real and unmodified), every recommendation here that has a genuine
// Design Specification-level lever also carries a concrete `specPatch` —
// the actual `Partial<DesignSpecification>` Section 8's Improvement Loop
// applies. This is intentionally honest about which of the brief's named
// examples ARE real spec-level levers and which are NOT:
//
//   density, negativeSpace, hierarchy, flow, rhythm — real
//   `DesignSpecification` fields, so "Reduce Density"/"Increase Negative
//   Space"/"Increase Hero Detail" (-> a Hierarchy preset with a higher
//   heroScale)/"Rotate Leaves" (-> Flow, which controls rotation-jitter
//   range via `engine/styleDna.ts`'s `FLOW_ROTATION_JITTER`)/"Improve
//   Rhythm" all resolve to a real patch.
//
//   Cluster size/position, per-motif detail, and per-motif scale jitter
//   have NO corresponding `DesignSpecification` field today (confirmed
//   during Design Workbench Phase 6 — `PropertyInspector.tsx`'s own
//   honest note that no spec field controls Cluster Composition Engine
//   archetype selection). "Increase Cluster Size"/"Move Cluster"/general
//   detail or scale advice are therefore genuinely advisory-only here —
//   `specPatch` is left `undefined`, not filled with a fabricated field.

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface ArtDirectionRecommendation {
  id: string;
  label: string;
  priority: RecommendationPriority;
  rationale: string;
  /** Present only when a real Design Specification field can express this
   * recommendation — see module header. */
  specPatch?: Partial<DesignSpecification>;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

const HIGHEST_HERO_SCALE_PRESET = 'heroFocus'; // HIERARCHY_PRESETS.heroFocus.value.heroScale = 2.4, the real ceiling

/** Grid and Grid Minimal place every instance on a strict axis-aligned
 * lattice by construction — confirmed empirically during Phase 7 scoping
 * that a Rhythm change alone cannot move `gridAppearanceScore` off the
 * floor while one of these two layouts is active, because the layout
 * itself (not the rhythm jitter) is what produces axis-aligned neighbor
 * directions. Rhythm is still the right lever for every other layout. */
function isStrictGridLayout(repeatType: DesignSpecification['repeatType']): boolean {
  return repeatType === 'grid' || repeatType === 'gridMinimal';
}

/** The real fix for grid/mechanical-spacing issues: switch off a strict
 * grid layout (to Scatter, a genuinely different, already-supported real
 * `LayoutId`) when that's the actual structural cause; otherwise a real
 * Rhythm change is enough on its own. */
function buildRhythmOrLayoutPatch(spec: DesignSpecification): Partial<DesignSpecification> | undefined {
  const rhythmPatch: Partial<DesignSpecification> | undefined = spec.rhythm !== 'organic' ? { rhythm: 'organic' } : undefined;
  if (isStrictGridLayout(spec.repeatType)) {
    return { ...rhythmPatch, repeatType: 'scatter' };
  }
  return rhythmPatch ?? { rhythm: 'syncopated' };
}

type IssueRuleBuilder = (spec: DesignSpecification) => ArtDirectionRecommendation;

/** One rule per Section 2 visual issue — priority mirrors the real point
 * weight of the closest `engine/scoring.ts` `SOFT_PENALTY_RULES` entry
 * (gridAppearance/equalSpacingDetected/heroInsufficientDetail = 15-20pts
 * -> high; the rest -> medium/low), not an independently-invented scale. */
const ART_DIRECTION_RULES: Record<VisualIssueId, IssueRuleBuilder> = {
  weakHero: (spec) => ({
    id: 'increaseHeroDetail',
    label: 'Increase Hero Detail',
    priority: 'high',
    rationale: 'Hero motifs blend into the fillers instead of anchoring the composition.',
    specPatch:
      JSON.stringify(spec.hierarchy) !== JSON.stringify(HIERARCHY_PRESETS[HIGHEST_HERO_SCALE_PRESET].value)
        ? { hierarchy: HIERARCHY_PRESETS[HIGHEST_HERO_SCALE_PRESET].value }
        : undefined,
  }),
  crowdedAreas: (spec) => ({
    id: 'increaseNegativeSpace',
    label: 'Increase Negative Space',
    priority: 'medium',
    rationale: 'One region of the tile holds a disproportionate share of all motifs.',
    specPatch: { negativeSpace: clamp01(spec.negativeSpace + 0.1), density: clamp01(spec.density - 0.05) },
  }),
  deadSpace: (spec) => ({
    id: 'reduceNegativeSpace',
    label: 'Reduce Negative Space',
    priority: 'medium',
    rationale: 'A large empty region breaks up the composition.',
    specPatch: { negativeSpace: clamp01(spec.negativeSpace - 0.1), density: clamp01(spec.density + 0.05) },
  }),
  mechanicalSpacing: (spec) => ({
    id: 'improveRhythmSpacing',
    label: isStrictGridLayout(spec.repeatType) ? 'Change Repeat Layout' : 'Improve Rhythm',
    priority: 'high',
    rationale: 'Nearest-neighbor spacing reads as suspiciously even, not organic.',
    specPatch: buildRhythmOrLayoutPatch(spec),
  }),
  gridAppearance: (spec) => ({
    id: 'improveRhythmGrid',
    label: isStrictGridLayout(spec.repeatType) ? 'Change Repeat Layout' : 'Improve Rhythm',
    priority: 'high',
    rationale: 'Neighbor directions concentrate on the axes — the tile reads as a grid.',
    specPatch: buildRhythmOrLayoutPatch(spec),
  }),
  weakClusters: () => ({
    id: 'increaseClusterSize',
    label: 'Increase Cluster Size',
    priority: 'medium',
    rationale: 'Hero motifs have little real supporting company nearby — no Design Specification field controls cluster archetype/size yet, so this is advisory only.',
    specPatch: undefined,
  }),
  lowDetail: () => ({
    id: 'increaseMotifDetail',
    label: 'Increase Motif Detail',
    priority: 'low',
    rationale: 'Motifs average very few SVG nodes — the pattern may read as flat or generic. No spec field controls per-motif detail directly; try a more intricate motif category in the Inspector.',
    specPatch: undefined,
  }),
  repeatedRotation: (spec) => ({
    id: 'rotateLeaves',
    label: 'Rotate Leaves',
    priority: 'medium',
    rationale: 'Over half of all instances share nearly the same rotation.',
    specPatch: spec.flow !== 'dynamic' ? { flow: 'dynamic' } : undefined,
  }),
  repeatedScale: () => ({
    id: 'varyMotifScale',
    label: 'Vary Motif Scale',
    priority: 'low',
    rationale: 'Over half of all instances share nearly the same scale. No spec field controls per-motif scale jitter directly; a Style DNA preset with a wider hierarchy-tier scale spread may help.',
    specPatch: undefined,
  }),
  weakFlow: (spec) => ({
    id: 'improveFlow',
    label: 'Improve Flow',
    priority: 'medium',
    rationale: "Placement doesn't read as a deliberate directional sweep.",
    specPatch: spec.flow === 'calm' ? { flow: 'directional' } : spec.flow === 'directional' ? { flow: 'dynamic' } : undefined,
  }),
};

/** Builds one Art Direction recommendation per detected Section 2 visual
 * issue. Never fabricates a recommendation for an issue that wasn't
 * actually detected. */
export function buildArtDirectionRecommendations(spec: DesignSpecification, visualIssues: VisualIssue[]): ArtDirectionRecommendation[] {
  return visualIssues.filter((issue) => issue.detected).map((issue) => ART_DIRECTION_RULES[issue.id](spec));
}
