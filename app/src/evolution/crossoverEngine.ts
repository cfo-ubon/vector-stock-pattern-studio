import type { Rng } from '../engine/types';
import { rngBool } from '../engine/rng';
import type { DesignSpecification } from '../trend/designSpecTypes';
import { diffJson, type JsonDiffEntry } from '../workbench/jsonDiff';
import type { CrossoverTrait, CrossoverRecord } from './types';

// Design Evolution Engine (Phase 8) — Section 3 "Crossover Engine". Each
// of the brief's 4 named crossover kinds (Composition/Palette/Cluster/
// Motif) is a group of real `DesignSpecification` fields that always
// travels together from a single parent, never mixed field-by-field
// within a group — so a child can never end up with, say, `palette.id`
// from parent A paired with `colorRoles` resolved for parent B's palette.
// `styleDnaId` and every non-evolved field (project/marketplace/trend/
// keywordBundle/svgHints/seoHints/exportHints/qualityTargets) always come
// from parent A, the same "maintain Style DNA" discipline the Mutation
// Engine applies by never touching that field at all.

const TRAITS: CrossoverTrait[] = ['composition', 'palette', 'cluster', 'motif'];

function pickTraitFields(spec: DesignSpecification, trait: CrossoverTrait): Partial<DesignSpecification> {
  switch (trait) {
    case 'composition':
      return { composition: spec.composition, repeatType: spec.repeatType, rhythm: spec.rhythm, flow: spec.flow };
    case 'palette':
      return { palette: spec.palette, colorRoles: spec.colorRoles, background: spec.background };
    case 'cluster':
      return { hierarchy: spec.hierarchy, density: spec.density, negativeSpace: spec.negativeSpace };
    case 'motif':
      return { heroMotifs: spec.heroMotifs, secondaryMotifs: spec.secondaryMotifs, fillers: spec.fillers };
  }
}

/** Combines two parents' real trait groups into one child spec. Every
 * trait group is a coin flip (`rng`) between "take parent A's real
 * values" and "take parent B's real values" — never an interpolation or
 * fabricated blend of the two, so the child's fields are always values
 * that already existed in a real evaluated candidate. */
export function crossoverSpecs(parentA: DesignSpecification, parentB: DesignSpecification, rng: Rng): { spec: DesignSpecification; record: Omit<CrossoverRecord, 'parentAId' | 'parentBId'>; diff: JsonDiffEntry[] } {
  const traitsFromA: CrossoverTrait[] = [];
  const traitsFromB: CrossoverTrait[] = [];
  let child: DesignSpecification = { ...parentA };

  for (const trait of TRAITS) {
    const fromA = rngBool(rng);
    if (fromA) {
      traitsFromA.push(trait);
      child = { ...child, ...pickTraitFields(parentA, trait) };
    } else {
      traitsFromB.push(trait);
      child = { ...child, ...pickTraitFields(parentB, trait) };
    }
  }

  return {
    spec: child,
    record: { traitsFromA, traitsFromB },
    diff: diffJson(parentA, child),
  };
}
