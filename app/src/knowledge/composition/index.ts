import { FLOW_ROTATION_JITTER, RHYTHM_STRENGTH, type FlowProfile, type RhythmProfile } from '../../engine/styleDna';
import { CLUSTER_ARCHETYPES, type ClusterArchetype } from '../../engine/clusterEngine';
import { LAYOUT_LIST } from '../../layouts';
import type { LayoutId, PatternLayout } from '../../engine/types';
import { listPatternGrammars, getPatternGrammar, isNegativeSpaceCompatible, isDensityCompatible } from '../../services/patternGrammarService';
import type { PatternGrammarData } from '../../pattern-grammar';

// Design Knowledge Engine (Phase 6.5) — Section 4 "Composition Knowledge".
// A thin facade over `engine/styleDna.ts`'s Flow/Rhythm constants,
// `engine/clusterEngine.ts` (Cluster Composition Engine, Project Phoenix
// V2), `pattern-grammar/*` (negative space + hierarchy compatibility), and
// `layouts/*` (repeat strategy).
//
// `LAYOUT_CLUSTER_ARCHETYPES` below moved here from
// `components/workbench/PropertyInspector.tsx`, which previously kept its
// own hand-copied literal of the exact same mapping (ported 1:1 from
// scatter.ts/toss.ts/bouquet.ts's own internal archetype-pool arrays,
// since `engine/clusterEngine.ts` itself has no per-layout mapping — each
// layout's own code picks its pool internally). Centralizing it here and
// having PropertyInspector import it is this phase's concrete fix for the
// "Do NOT duplicate rules across modules" requirement — one source of
// truth instead of two copies that could silently drift.

export const LAYOUT_CLUSTER_ARCHETYPES: Partial<Record<LayoutId, ClusterArchetype[]>> = {
  scatter: ['organicScatter', 'bouquet', 'asymmetric'],
  toss: ['diagonal', 'cascade', 'sCurve'],
  bouquet: ['bouquet'],
};

export function listFlowProfiles(): FlowProfile[] {
  return ['calm', 'directional', 'dynamic'];
}

export function listRhythmProfiles(): RhythmProfile[] {
  return ['regular', 'organic', 'syncopated'];
}

export function getFlowRotationJitter(profile: FlowProfile): number {
  return FLOW_ROTATION_JITTER[profile];
}

export function getRhythmStrength(profile: RhythmProfile): number {
  return RHYTHM_STRENGTH[profile];
}

export function listClusterArchetypes(): ClusterArchetype[] {
  return CLUSTER_ARCHETYPES;
}

/** The real cluster archetype candidate pool for a layout — empty for a
 * layout that doesn't route through the Cluster Composition Engine at
 * all (most layouts don't; see the module header). */
export function getClusterArchetypesForLayout(layoutId: LayoutId): ClusterArchetype[] {
  return LAYOUT_CLUSTER_ARCHETYPES[layoutId] ?? [];
}

export function listRepeatStrategies(): PatternLayout[] {
  return LAYOUT_LIST;
}

export function listCompositionKnowledge(): PatternGrammarData[] {
  return listPatternGrammars();
}

export function getCompositionKnowledge(patternGrammarId: string): PatternGrammarData | undefined {
  return getPatternGrammar(patternGrammarId);
}

export function isCompositionNegativeSpaceCompatible(patternGrammarId: string, negativeSpace: number): boolean {
  return isNegativeSpaceCompatible(patternGrammarId, negativeSpace);
}

export function isCompositionDensityCompatible(patternGrammarId: string, density: number): boolean {
  return isDensityCompatible(patternGrammarId, density);
}
