import { createRng } from '../engine/rng';
import { deriveSeed } from '../engine/candidateEngine';
import type { DesignSpecification } from '../trend/designSpecTypes';
import { applyRandomMutations } from './mutationEngine';
import type { EvolutionCandidate } from './types';

// Design Evolution Engine (Phase 8) — Section 1 "Candidate Generator".
// Produces the starting (generation 0) population from one Design
// Specification, with a configurable candidate count. Reuses the exact
// `deriveSeed`/`createRng` reproducibility pattern `trend/designSpecQuality.ts`
// and `critic/improvementLoop.ts` already established (`engine/candidateEngine.ts`'s
// `deriveSeed`, unchanged) — a given `(seedSpec, seed, count)` always
// produces the exact same population.

const GENERATION_0_PURPOSE = 'dee-gen0';

/** Candidate 0 is always the untouched seed spec (real elitism: the
 * starting design is always a member of its own first generation, so
 * evolution can never silently produce a *worse* best-of-generation than
 * what the designer started with). Every other candidate is the seed
 * spec with 1+ real mutations applied via the Mutation Engine — not a
 * re-seeded re-render of the same spec (that's what the existing Quality
 * Loop already does; genuine spec-level variation is what Phase 8 adds). */
export function generateInitialPopulation(seedSpec: DesignSpecification, seed: string, count: number, mutationRate = 0.4): EvolutionCandidate[] {
  const size = Math.max(1, Math.floor(count));
  const candidates: EvolutionCandidate[] = [];

  for (let i = 0; i < size; i++) {
    const candidateSeed = deriveSeed(seed, GENERATION_0_PURPOSE, i);
    if (i === 0) {
      candidates.push({
        id: candidateSeed,
        spec: seedSpec,
        dna: { candidateId: candidateSeed, generation: 0, parentIds: [], appliedMutations: [], crossover: null },
      });
      continue;
    }
    const rng = createRng(candidateSeed);
    const { spec, mutations } = applyRandomMutations(seedSpec, rng, mutationRate);
    candidates.push({
      id: candidateSeed,
      spec,
      dna: { candidateId: candidateSeed, generation: 0, parentIds: [], appliedMutations: mutations, crossover: null },
    });
  }

  return candidates;
}
