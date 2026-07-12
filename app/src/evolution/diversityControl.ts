import type { DesignSpecification } from '../trend/designSpecTypes';
import { diffJson } from '../workbench/jsonDiff';
import type { EvaluatedCandidate } from './types';

// Design Evolution Engine (Phase 8) — Section 6 "Diversity Control".
// Similarity is measured with the same real `diffJson` utility the
// Workbench History panel already uses to compare Design Spec snapshots
// — no second diffing implementation. "Distance" is simply the number of
// leaf-level differences between two specs: 0 means identical, and it
// grows with every field that differs, which is exactly the
// field-by-field granularity the Mutation/Crossover Engines produce.

export function measureDistance(specA: DesignSpecification, specB: DesignSpecification): number {
  return diffJson(specA, specB).length;
}

export function averagePairwiseDistance(specs: DesignSpecification[]): number {
  if (specs.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      total += measureDistance(specs[i], specs[j]);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

/** Greedily keeps the highest-fitness candidates first, dropping any
 * candidate whose spec is within `minDistance` of one already kept (a
 * near-duplicate of something better already survived, so the weaker
 * twin is the one that goes) — this is a *soft* preference, not a hard
 * population cutoff: if diversity pruning would shrink the generation
 * below `targetSize`, the highest-fitness dropped candidates are added
 * back in fitness order until `targetSize` is reached (or the pool is
 * exhausted), so diversity control can never stall evolution by pruning
 * too aggressively. Style consistency is preserved for free — nothing
 * here touches `styleDnaId` or any spec field, it only decides which
 * already-real candidates survive. */
export function enforceDiversity(evaluated: EvaluatedCandidate[], minDistance: number, targetSize: number): EvaluatedCandidate[] {
  const byScore = [...evaluated].sort((a, b) => b.fitness.score - a.fitness.score);
  const kept: EvaluatedCandidate[] = [];
  const dropped: EvaluatedCandidate[] = [];

  for (const candidate of byScore) {
    const tooClose = kept.some((k) => measureDistance(k.spec, candidate.spec) < minDistance);
    if (tooClose) dropped.push(candidate);
    else kept.push(candidate);
  }

  let result = kept.slice(0, targetSize);
  if (result.length < Math.min(targetSize, evaluated.length)) {
    const need = Math.min(targetSize, evaluated.length) - result.length;
    result = result.concat(dropped.slice(0, need));
  }
  return result;
}
