import type { DesignSpecification } from '../trend/designSpecTypes';
import type { DesignCritique } from '../critic/designCritique';
import type { DesignReport } from '../critic/designReport';
import type { QualityGateResult } from '../critic/qualityGate';
import type { JsonDiffEntry } from '../workbench/jsonDiff';

// Design Evolution Engine (Phase 8) — Section 8 "Design DNA" plus every
// other shared type the engine's modules pass between each other. This
// phase never generates artwork or scores anything itself: fitness comes
// from the real Design Critic (`critic/designReport.ts` +
// `critic/qualityGate.ts`, Phase 7), tiles come from the real SVG
// Intelligence Engine (`trend/designSpecQuality.ts`'s
// `runDesignSpecQualityLoop`, unchanged), and lineage diffs come from the
// real Workbench diff utility (`workbench/jsonDiff.ts`'s `diffJson`,
// unchanged) — this file only names the new shapes that hold their
// outputs together across a population and across generations.

/** The 6 mutation levers Section 2 names by example. Every operator is a
 * real `DesignSpecification` field (or, for `overlap`, the closest real
 * field that actually drives it — see `mutationEngine.ts`'s header
 * comment) — never a fabricated field. */
export type MutationType = 'clusterDensity' | 'motifScale' | 'overlap' | 'hierarchy' | 'paletteWeighting' | 'negativeSpace';

/** One applied mutation, with its exact effect captured via the real
 * `diffJson` utility rather than a hand-written description that could
 * drift from what actually changed. */
export interface AppliedMutation {
  type: MutationType;
  diff: JsonDiffEntry[];
}

/** Section 3 "Crossover Engine" trait groups. Each group's fields are
 * always taken wholly from one parent (never field-by-field within a
 * group) so a crossover child never ends up with, say, a palette from
 * parent A paired with color roles resolved for parent B's palette. */
export type CrossoverTrait = 'composition' | 'palette' | 'cluster' | 'motif';

export interface CrossoverRecord {
  parentAId: string;
  parentBId: string;
  traitsFromA: CrossoverTrait[];
  traitsFromB: CrossoverTrait[];
}

/** Section 8 "Design DNA" — every candidate's full lineage: which
 * generation it belongs to, which candidate(s) it descended from, and
 * exactly which mutations/crossover produced it from those parents. A
 * DNA record's `parentIds` has 0 entries for the untouched seed
 * candidate, 1 entry for a pure mutation, and 2 entries for a crossover
 * child (in which case `crossover` is set). */
export interface DesignDna {
  candidateId: string;
  generation: number;
  parentIds: string[];
  appliedMutations: AppliedMutation[];
  crossover: CrossoverRecord | null;
}

export interface EvolutionCandidate {
  id: string;
  spec: DesignSpecification;
  dna: DesignDna;
}

/** Section 4 "Fitness Evaluation" — transparent scoring: the full 11-
 * dimension Design Critique is kept alongside the single `score` used for
 * selection, so nothing about why a candidate scored the way it did is
 * hidden behind one number. `rejected` mirrors the Candidate Engine's own
 * hard-reject sentinel (`score === -1` when a candidate's node count
 * blows the safety budget) — surfaced explicitly rather than left for a
 * caller to infer from a suspicious-looking `-1`, the same transparency
 * discipline `critic/improvementLoop.ts` applies to the same condition. */
export interface EvolutionFitness {
  score: number;
  rejected: boolean;
  critique: DesignCritique;
  gate: QualityGateResult;
  meetsCommercialBar: boolean;
}

export interface EvaluatedCandidate extends EvolutionCandidate {
  fitness: EvolutionFitness;
  report: DesignReport;
}

export type SelectionAlgorithm = 'elitist' | 'tournament' | 'rouletteWheel';

export interface EvolutionConfig {
  /** Candidates per generation. */
  populationSize: number;
  /** Section 9 stopping condition — hard cap on generations. */
  maxGenerations: number;
  /** Probability an extra mutation is layered onto a mutation-only child. */
  mutationRate: number;
  /** Probability a new child is produced via crossover instead of pure
   * mutation of a single selected parent. */
  crossoverRate: number;
  selectionAlgorithm: SelectionAlgorithm;
  /** Section 6 "Diversity Control" — minimum `diffJson` distance (field
   * count) two kept candidates in the same generation must have. */
  diversityMinDistance: number;
  /** Section 9 stopping condition — stop as soon as the best candidate's
   * fitness score reaches this value. Undefined disables the check. */
  qualityThreshold?: number;
  /** Section 9 stopping condition — wall-clock budget in milliseconds.
   * Undefined disables the check. */
  maxDurationMs?: number;
  /** Section 9 stopping condition — hard cap on total fitness
   * evaluations across the whole run (a direct proxy for compute spent,
   * since each evaluation renders a real candidate pool). Undefined
   * disables the check. */
  maxEvaluations?: number;
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  populationSize: 6,
  maxGenerations: 3,
  mutationRate: 0.6,
  crossoverRate: 0.5,
  selectionAlgorithm: 'tournament',
  diversityMinDistance: 2,
  qualityThreshold: undefined,
  maxDurationMs: undefined,
  maxEvaluations: undefined,
};

export interface EvolutionGenerationRecord {
  index: number;
  candidates: EvaluatedCandidate[];
  bestCandidateId: string;
  bestScore: number;
  averageScore: number;
  /** Average pairwise `diffJson` distance across this generation's
   * candidates — a transparency figure for Section 6, not used to gate
   * anything itself. */
  diversityAverageDistance: number;
}

export type EvolutionTimeline = EvolutionGenerationRecord[];

export interface EvolutionResult {
  seedSpec: DesignSpecification;
  seed: string;
  timeline: EvolutionTimeline;
  best: EvaluatedCandidate;
  generationsUsed: number;
  evaluationsUsed: number;
  stoppedReason: string;
  config: EvolutionConfig;
}
