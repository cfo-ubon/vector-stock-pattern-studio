import { describe, it, expect } from 'vitest';
import { LAYOUT_LIST } from '../../layouts';
import { CLUSTER_ARCHETYPES } from '../../engine/clusterEngine';
import { listPatternGrammars } from '../../services/patternGrammarService';
import {
  LAYOUT_CLUSTER_ARCHETYPES,
  listFlowProfiles,
  listRhythmProfiles,
  getFlowRotationJitter,
  getRhythmStrength,
  listClusterArchetypes,
  getClusterArchetypesForLayout,
  listRepeatStrategies,
  listCompositionKnowledge,
  getCompositionKnowledge,
  isCompositionNegativeSpaceCompatible,
  isCompositionDensityCompatible,
} from './index';

describe('knowledge/composition: Flow and Rhythm', () => {
  it('lists all 3 real Flow profiles and Rhythm profiles', () => {
    expect(listFlowProfiles()).toEqual(['calm', 'directional', 'dynamic']);
    expect(listRhythmProfiles()).toEqual(['regular', 'organic', 'syncopated']);
  });

  it('getFlowRotationJitter / getRhythmStrength read the real engine/styleDna.ts tables', () => {
    expect(getFlowRotationJitter('dynamic')).toBe(30);
    expect(getRhythmStrength('syncopated')).toBe(0.6);
  });
});

describe('knowledge/composition: Cluster archetypes', () => {
  it('listClusterArchetypes matches the real Cluster Composition Engine', () => {
    expect(listClusterArchetypes()).toEqual(CLUSTER_ARCHETYPES);
  });

  it('getClusterArchetypesForLayout returns the real pool for a cluster-aware layout', () => {
    expect(getClusterArchetypesForLayout('scatter')).toEqual(LAYOUT_CLUSTER_ARCHETYPES.scatter);
  });

  it('getClusterArchetypesForLayout returns [] for a layout that does not route through the Cluster Engine', () => {
    expect(getClusterArchetypesForLayout('grid')).toEqual([]);
  });

  it('every archetype in LAYOUT_CLUSTER_ARCHETYPES is a real CLUSTER_ARCHETYPES member', () => {
    for (const archetypes of Object.values(LAYOUT_CLUSTER_ARCHETYPES)) {
      for (const archetype of archetypes!) {
        expect(CLUSTER_ARCHETYPES).toContain(archetype);
      }
    }
  });
});

describe('knowledge/composition: repeat strategies + pattern grammar facade', () => {
  it('listRepeatStrategies matches the real Layout Library', () => {
    expect(listRepeatStrategies().length).toBe(LAYOUT_LIST.length);
  });

  it('listCompositionKnowledge / getCompositionKnowledge match the real Pattern Grammar Library', () => {
    expect(listCompositionKnowledge().length).toBe(listPatternGrammars().length);
    const grammar = listPatternGrammars()[0];
    expect(getCompositionKnowledge(grammar.id)).toEqual(grammar);
  });

  it('isCompositionNegativeSpaceCompatible / isCompositionDensityCompatible honor the real ranges', () => {
    const grammar = listPatternGrammars()[0];
    expect(isCompositionDensityCompatible(grammar.id, grammar.densityRange.min)).toBe(true);
    expect(isCompositionNegativeSpaceCompatible(grammar.id, grammar.negativeSpaceRange.min)).toBe(true);
  });
});
