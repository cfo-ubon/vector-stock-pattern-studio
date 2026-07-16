import { createRng, rngBool, rngPick } from '../engine/rng';
import type { Rng } from '../engine/types';
import { deriveSeed } from '../engine/candidateEngine';
import type { DesignSpecification } from '../trend/designSpecTypes';
import { generateInitialPopulation } from './candidateGenerator';
import { evaluateFitness } from './fitnessEvaluation';
import { selectCandidates } from './selectionStrategy';
import { enforceDiversity } from './diversityControl';
import { recordGeneration } from './evolutionTimeline';
import { shouldStop } from './stoppingConditions';
import { applyRandomMutations } from './mutationEngine';
import { crossoverSpecs } from './crossoverEngine';
import { DEFAULT_EVOLUTION_CONFIG, type EvolutionConfig, type EvolutionResult, type EvaluatedCandidate, type EvolutionCandidate, type EvolutionTimeline } from './types';

// Design Evolution Engine (Phase 8) — orchestrator. Wires Sections 1-9
// together into one reproducible generation loop: candidates -> fitness
// -> diversity -> timeline -> stopping check -> selection -> next
// generation's candidates (crossover and/or mutation). Nothing in this
// file generates artwork or scores anything itself — every real decision
// is delegated to the section module that owns it.

const NEXT_GEN_PURPOSE = 'dee-gen';

function pickTwoDistinctParents(parents: EvaluatedCandidate[], rng: Rng): [EvaluatedCandidate, EvaluatedCandidate] {
  const a = rngPick(rng, parents);
  let b = rngPick(rng, parents);
  let guard = 0;
  while (b.id === a.id && parents.length > 1 && guard < 10) {
    b = rngPick(rng, parents);
    guard += 1;
  }
  return [a, b];
}

/** Builds generation `generationIndex`'s population from the previous
 * generation's selected parents. Candidate 0 is always the previous
 * generation's best, carried over unchanged — elitism, so the timeline's
 * best score can never regress from one generation to the next (see
 * `evolutionTimeline.ts`'s `summarizeTimeline().monotonicallyImproved`).
 * Every other candidate is either a crossover of two selected parents
 * (`config.crossoverRate` chance) or a mutation of one selected parent,
 * with an additional chance (`config.mutationRate`) of extra mutations
 * layered onto a crossover child too. */
function breedNextGeneration(parents: EvaluatedCandidate[], previousBest: EvaluatedCandidate, seed: string, generationIndex: number, config: EvolutionConfig): EvolutionCandidate[] {
  const children: EvolutionCandidate[] = [
    { id: previousBest.id, spec: previousBest.spec, dna: { ...previousBest.dna } },
  ];

  for (let i = 1; i < config.populationSize; i++) {
    const candidateId = deriveSeed(seed, `${NEXT_GEN_PURPOSE}${generationIndex}`, i);
    const rng = createRng(candidateId);
    const useCrossover = parents.length >= 2 && rngBool(rng, config.crossoverRate);

    if (useCrossover) {
      const [parentA, parentB] = pickTwoDistinctParents(parents, rng);
      const { spec, record } = crossoverSpecs(parentA.spec, parentB.spec, rng);
      const withMutation = rngBool(rng, config.mutationRate) ? applyRandomMutations(spec, rng, 0) : { spec, mutations: [] };
      children.push({
        id: candidateId,
        spec: withMutation.spec,
        dna: {
          candidateId,
          generation: generationIndex,
          parentIds: [parentA.id, parentB.id],
          appliedMutations: withMutation.mutations,
          crossover: { parentAId: parentA.id, parentBId: parentB.id, ...record },
        },
      });
    } else {
      const parent = rngPick(rng, parents);
      const { spec, mutations } = applyRandomMutations(parent.spec, rng, config.mutationRate);
      children.push({
        id: candidateId,
        spec,
        dna: { candidateId, generation: generationIndex, parentIds: [parent.id], appliedMutations: mutations, crossover: null },
      });
    }
  }

  return children;
}

/** Runs a full evolution: generates an initial population from
 * `seedSpec`, then repeatedly evaluates -> checks diversity -> records
 * -> checks stopping conditions -> selects -> breeds, until a Section 9
 * stopping condition fires. Every id (`deriveSeed(seed, purpose, index)`,
 * `engine/candidateEngine.ts`, unchanged) is derived from `seed`, so the
 * same `(seedSpec, seed, config)` always reproduces the exact same
 * timeline and winner. */
export function runEvolution(seedSpec: DesignSpecification, seed: string, configOverrides: Partial<EvolutionConfig> = {}): EvolutionResult {
  const config: EvolutionConfig = { ...DEFAULT_EVOLUTION_CONFIG, ...configOverrides };
  const startedAt = Date.now();
  const timeline: EvolutionTimeline = [];
  let evaluationsUsed = 0;
  let population = generateInitialPopulation(seedSpec, seed, config.populationSize, config.mutationRate);
  let generationIndex = 0;
  let stoppedReason = '';
  let best: EvaluatedCandidate | null = null;
  // The elite carried into each new generation was already evaluated at
  // the end of the previous one — reusing that result instead of
  // re-rendering it keeps the real render cost proportional to genuinely
  // *new* candidates only.
  let carriedForward = new Map<string, EvaluatedCandidate>();

  for (;;) {
    const evaluated = population.map((candidate) => {
      const reused = carriedForward.get(candidate.id);
      if (reused) return reused;
      evaluationsUsed += 1;
      return evaluateFitness(candidate);
    });

    const diverse = enforceDiversity(evaluated, config.diversityMinDistance, config.populationSize);
    const record = recordGeneration(generationIndex, diverse);
    timeline.push(record);

    const generationBest = diverse.find((c) => c.id === record.bestCandidateId)!;
    if (!best || generationBest.fitness.score > best.fitness.score) best = generationBest;

    const decision = shouldStop({ generationIndex, bestScore: best.fitness.score, startedAt, evaluationsUsed }, config);
    if (decision.stop) {
      stoppedReason = decision.reason;
      break;
    }

    const selectionRng = createRng(deriveSeed(seed, 'dee-select', generationIndex));
    const parentCount = Math.max(2, Math.ceil(config.populationSize / 2));
    const parents = selectCandidates(diverse, parentCount, config.selectionAlgorithm, selectionRng);
    population = breedNextGeneration(parents, generationBest, seed, generationIndex + 1, config);
    carriedForward = new Map([[generationBest.id, generationBest]]);
    generationIndex += 1;
  }

  return {
    seedSpec,
    seed,
    timeline,
    best: best!,
    generationsUsed: timeline.length,
    evaluationsUsed,
    stoppedReason,
    config,
  };
}
