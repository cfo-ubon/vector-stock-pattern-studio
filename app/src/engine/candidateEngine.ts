import type { GenerateParams, TileData } from './types';
import { buildTile } from './tile';
import { serialize } from './svgAst';
import { extractInstances, countNodes } from './svgGeometry';
import { computeMetrics, computeOverallScore, type CompositionMetrics, type QualityPresetId } from './scoring';

// Composition Candidate Engine — replaces the old "generate once -> render"
// pipeline for the new "Generate Best" flow: build a deterministic pool of
// candidate tiles from the same base seed, score each from real geometry,
// hard-reject anything structurally broken, and rank the rest. The plain
// single-shot `buildTile` path (used by the existing Generate / Generate 9
// Variations buttons) is untouched — this is an additive, opt-in pipeline.

export type GenerationMode = 'fast' | 'standard' | 'premium';

export const CANDIDATE_COUNTS: Record<GenerationMode, number> = {
  fast: 4,
  standard: 8,
  premium: 12,
};

export interface Candidate {
  candidateId: string;
  derivedSeed: string;
  tileData: TileData;
  metrics: CompositionMetrics;
  score: number;
  rejected: boolean;
  rejectionReasons: string[];
  penaltyReasons: string[];
}

/** Deterministic sub-seed derivation: `baseSeed + purpose + index` always
 * hashes to the same seed via createRng's cyrb53 hash, so
 * "seed + settings + mode" fully determines the whole candidate pool (and
 * therefore its winner) with no Math.random anywhere in this pipeline. */
export function deriveSeed(baseSeed: string, purpose: string, index: number): string {
  return `${baseSeed}::${purpose}::${index}`;
}

const HARD_NODE_BUDGET = 8000;

interface HardRejectResult {
  rejected: boolean;
  reasons: string[];
}

function applyHardRejectRules(tileData: TileData): HardRejectResult {
  const reasons: string[] = [];
  const instances = extractInstances(tileData);
  if (instances.length === 0) reasons.push('empty pattern — no motifs placed');

  const svgStr = serialize(tileData.svg);
  if (/NaN|Infinity/.test(svgStr)) reasons.push('invalid geometry (NaN/Infinity coordinate)');
  if (/<image[\s/>]/.test(svgStr)) reasons.push('raster <image> element present');
  if (/(?:xlink:href|href)\s*=\s*"(?!#)[^"]/.test(svgStr)) reasons.push('external resource reference present');

  const ids = instances.map((i) => i.index);
  if (new Set(ids).size !== ids.length) reasons.push('duplicate motif ids');

  const nodeCount = countNodes(tileData.svg);
  if (nodeCount > HARD_NODE_BUDGET) reasons.push(`node count ${nodeCount} exceeds safety budget ${HARD_NODE_BUDGET}`);

  return { rejected: reasons.length > 0, reasons };
}

/** Hard-reject a candidate whose rendered SVG is byte-for-byte identical to
 * an earlier, still-valid candidate in the same pool (the original spec's
 * "candidate ซ้ำกันมากเกินไป" rule) — a diverse pool is only useful if the
 * candidates actually differ.
 *
 * This deliberately compares the *rendered output*, not the aggregate
 * CompositionMetrics scores: an earlier version of this check compared
 * metrics instead and had to be reverted — candidates drawn from the same
 * base settings (same category/layout/density, only a different derived
 * seed) naturally cluster tightly in metric-score space simply because
 * consistent settings produce consistently-scored results, which isn't
 * duplication at all. Exact-output comparison has no such false-positive
 * risk: two candidates only match here if they are visually and
 * structurally identical. In this engine's architecture (independent
 * derived seeds, no mutation/crossover) that's expected to be rare —
 * this exists as a real, tested safety net rather than something intended
 * to fire often. */
export function rejectExactDuplicates(candidates: Candidate[]): void {
  const seen: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].rejected) continue;
    const svgStr = serialize(candidates[i].tileData.svg);
    const dupIndex = seen.findIndex((s, j) => s === svgStr && !candidates[j].rejected);
    if (dupIndex !== -1) {
      candidates[i].rejected = true;
      candidates[i].score = -1;
      candidates[i].rejectionReasons = [...candidates[i].rejectionReasons, `identical rendered output to ${candidates[dupIndex].candidateId}`];
    }
    seen[i] = svgStr;
  }
}

export interface CandidatePoolResult {
  candidates: Candidate[];
  winner: Candidate;
  mode: GenerationMode;
  qualityPreset: QualityPresetId;
}

function buildOneCandidate(baseParams: GenerateParams, qualityPreset: QualityPresetId, index: number): Candidate {
  const derivedSeed = deriveSeed(baseParams.seed, 'candidate', index);
  const tileData = buildTile({ ...baseParams, seed: derivedSeed });
  const { rejected, reasons } = applyHardRejectRules(tileData);
  const metrics = computeMetrics(tileData);
  const { score, penaltyReasons } = computeOverallScore(metrics, qualityPreset);
  return {
    candidateId: `candidate-${index + 1}`,
    derivedSeed,
    tileData,
    metrics,
    score: rejected ? -1 : score,
    rejected,
    rejectionReasons: reasons,
    penaltyReasons,
  };
}

/** Build and score a deterministic candidate pool from `baseParams`. Every
 * candidate reuses `baseParams` verbatim except `seed`, which is replaced by
 * a derived sub-seed per candidate index — the existing `buildTile`
 * pipeline (layouts, generators, hierarchy, filler, shadow/highlight) runs
 * completely unmodified for each one.
 *
 * Synchronous — fine for tests and for light categories/layouts, but a
 * dense high-motif-count tile (e.g. Botanical + Dense Premium at high
 * density can place 800+ motifs, each running the growth-engine's arc
 * sampling) can take ~0.5-1.5s per candidate. The UI uses
 * `generateCandidatesChunked` below instead so it never blocks the main
 * thread for the whole pool at once. */
export function generateCandidates(baseParams: GenerateParams, mode: GenerationMode, qualityPreset: QualityPresetId): Candidate[] {
  const count = CANDIDATE_COUNTS[mode];
  const candidates: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    candidates.push(buildOneCandidate(baseParams, qualityPreset, i));
  }
  rejectExactDuplicates(candidates);
  return candidates;
}

export interface CandidateProgress {
  completed: number;
  total: number;
}

export interface CancelToken {
  cancelled: boolean;
}

/** Same deterministic result as `generateCandidates`, but yields to the
 * event loop between each candidate (one macrotask per candidate) so the
 * tab stays responsive/paintable and a mid-run cancel can take effect
 * promptly — without the complexity of a Web Worker. Returns whatever
 * candidates completed before `token.cancelled` was observed. */
export async function generateCandidatesChunked(
  baseParams: GenerateParams,
  mode: GenerationMode,
  qualityPreset: QualityPresetId,
  onProgress?: (progress: CandidateProgress) => void,
  token?: CancelToken,
): Promise<Candidate[]> {
  const count = CANDIDATE_COUNTS[mode];
  const candidates: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    if (token?.cancelled) break;
    candidates.push(buildOneCandidate(baseParams, qualityPreset, i));
    onProgress?.({ completed: candidates.length, total: count });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  rejectExactDuplicates(candidates);
  return candidates;
}

/** Highest-scoring non-rejected candidate; falls back to the whole pool
 * (ranked by score, which is -1 for every rejected candidate) only in the
 * pathological case where every candidate was hard-rejected, so callers
 * always get a renderable tile. */
export function pickBestCandidate(candidates: Candidate[]): Candidate {
  const valid = candidates.filter((c) => !c.rejected);
  const pool = valid.length > 0 ? valid : candidates;
  return pool.reduce((best, c) => (c.score > best.score ? c : best), pool[0]);
}

/** Full pipeline: generate the pool, pick the winner, and bundle the mode/
 * preset used so callers can display "chosen from N candidates". */
export function generateBest(baseParams: GenerateParams, mode: GenerationMode, qualityPreset: QualityPresetId): CandidatePoolResult {
  const candidates = generateCandidates(baseParams, mode, qualityPreset);
  const winner = pickBestCandidate(candidates);
  return { candidates, winner, mode, qualityPreset };
}
