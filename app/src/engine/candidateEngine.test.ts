import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics, computeOverallScore } from './scoring';
import {
  generateCandidates,
  generateCandidatesChunked,
  pickBestCandidate,
  deriveSeed,
  rejectExactDuplicates,
  CANDIDATE_COUNTS,
  type Candidate,
  type GenerationMode,
} from './candidateEngine';

function makeCandidate(id: string, svg: object, rejected = false): Candidate {
  const tile = buildTile({ ...defaultParams(), seed: id });
  const metrics = computeMetrics(tile);
  const { score } = computeOverallScore(metrics, 'stockClean');
  return {
    candidateId: id,
    derivedSeed: id,
    tileData: { ...tile, svg: svg as typeof tile.svg },
    metrics,
    score: rejected ? -1 : score,
    rejected,
    rejectionReasons: [],
    penaltyReasons: [],
  };
}

const MODES: GenerationMode[] = ['fast', 'standard', 'premium'];

describe('deriveSeed', () => {
  it('is deterministic and varies by purpose/index', () => {
    expect(deriveSeed('abc', 'candidate', 0)).toBe(deriveSeed('abc', 'candidate', 0));
    expect(deriveSeed('abc', 'candidate', 0)).not.toBe(deriveSeed('abc', 'candidate', 1));
    expect(deriveSeed('abc', 'candidate', 0)).not.toBe(deriveSeed('xyz', 'candidate', 0));
  });
});

describe('generateCandidates', () => {
  it('produces the configured candidate count per mode', () => {
    const base = { ...defaultParams(), seed: 'candidate-count-check' };
    for (const mode of MODES) {
      const candidates = generateCandidates(base, mode, 'stockClean');
      expect(candidates.length).toBe(CANDIDATE_COUNTS[mode]);
    }
  });

  it('is fully deterministic: same seed + settings + mode + preset -> identical pool', () => {
    const base = { ...defaultParams(), seed: 'candidate-determinism' };
    const a = generateCandidates(base, 'standard', 'stockClean');
    const b = generateCandidates(base, 'standard', 'stockClean');
    expect(a.map((c) => c.derivedSeed)).toEqual(b.map((c) => c.derivedSeed));
    expect(a.map((c) => c.score)).toEqual(b.map((c) => c.score));
  });

  it('every candidate has a valid, finite score or is rejected', () => {
    const base = { ...defaultParams(), seed: 'candidate-validity' };
    const candidates = generateCandidates(base, 'fast', 'textilePremium');
    for (const c of candidates) {
      expect(Number.isFinite(c.score)).toBe(true);
      if (c.rejected) {
        expect(c.rejectionReasons.length).toBeGreaterThan(0);
      } else {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('different base seeds produce different candidate pools', () => {
    const a = generateCandidates({ ...defaultParams(), seed: 'seed-a' }, 'fast', 'stockClean');
    const b = generateCandidates({ ...defaultParams(), seed: 'seed-b' }, 'fast', 'stockClean');
    expect(a.map((c) => c.derivedSeed)).not.toEqual(b.map((c) => c.derivedSeed));
  });

  it('never hard-rejects a normal default-params tile (no NaN/raster/empty)', () => {
    const candidates = generateCandidates({ ...defaultParams(), seed: 'candidate-no-reject' }, 'fast', 'stockClean');
    expect(candidates.every((c) => !c.rejected)).toBe(true);
  });
});

describe('rejectExactDuplicates', () => {
  it('hard-rejects a later candidate whose rendered SVG is byte-identical to an earlier one', () => {
    const svgA = { tag: 'g' as const, children: [{ tag: 'circle' as const, attrs: { cx: 1, cy: 2, r: 3 } }] };
    const svgB = { tag: 'g' as const, children: [{ tag: 'circle' as const, attrs: { cx: 1, cy: 2, r: 3 } }] }; // structurally identical
    const svgC = { tag: 'g' as const, children: [{ tag: 'circle' as const, attrs: { cx: 9, cy: 9, r: 9 } }] }; // different
    const candidates = [makeCandidate('a', svgA), makeCandidate('b', svgB), makeCandidate('c', svgC)];
    rejectExactDuplicates(candidates);
    expect(candidates[0].rejected).toBe(false);
    expect(candidates[1].rejected).toBe(true);
    expect(candidates[1].rejectionReasons.some((r) => r.includes('identical rendered output'))).toBe(true);
    expect(candidates[2].rejected).toBe(false);
  });

  it('does not compare against a candidate already rejected for another reason', () => {
    const svg = { tag: 'g' as const, children: [] };
    const candidates = [makeCandidate('a', svg, true), makeCandidate('b', svg, false)];
    rejectExactDuplicates(candidates);
    // 'b' should NOT be rejected merely for matching an already-rejected 'a'.
    expect(candidates[1].rejected).toBe(false);
  });

  it('never hard-rejects a small pool of visually distinct real candidates as false-positive duplicates', () => {
    // Regression guard for the bug this rule originally had (comparing
    // aggregate metric scores instead of rendered output caused false
    // positives — same settings naturally score similarly without being
    // visually identical).
    const candidates = generateCandidates({ ...defaultParams(), seed: 'no-false-duplicate' }, 'standard', 'stockClean');
    const duplicateRejections = candidates.filter((c) => c.rejectionReasons.some((r) => r.includes('identical rendered output')));
    expect(duplicateRejections.length).toBe(0);
  });
});

describe('pickBestCandidate', () => {
  it('picks the highest-scoring non-rejected candidate', () => {
    const candidates = generateCandidates({ ...defaultParams(), seed: 'pick-best' }, 'standard', 'stockClean');
    const winner = pickBestCandidate(candidates);
    const maxValidScore = Math.max(...candidates.filter((c) => !c.rejected).map((c) => c.score));
    expect(winner.score).toBe(maxValidScore);
    expect(winner.rejected).toBe(false);
  });

  it('falls back to the full pool if every candidate is somehow rejected', () => {
    const candidates = generateCandidates({ ...defaultParams(), seed: 'fallback' }, 'fast', 'stockClean').map((c) => ({
      ...c,
      rejected: true,
    }));
    const winner = pickBestCandidate(candidates);
    expect(candidates).toContain(winner);
  });
});

describe('generateCandidatesChunked', () => {
  it('produces the same pool as the synchronous version', async () => {
    const base = { ...defaultParams(), seed: 'chunked-parity' };
    const sync = generateCandidates(base, 'fast', 'stockClean');
    const chunked = await generateCandidatesChunked(base, 'fast', 'stockClean');
    expect(chunked.map((c) => c.derivedSeed)).toEqual(sync.map((c) => c.derivedSeed));
    expect(chunked.map((c) => c.score)).toEqual(sync.map((c) => c.score));
  });

  it('reports progress for every completed candidate', async () => {
    const base = { ...defaultParams(), seed: 'chunked-progress' };
    const progressUpdates: Array<{ completed: number; total: number }> = [];
    await generateCandidatesChunked(base, 'fast', 'stockClean', (p) => progressUpdates.push(p));
    expect(progressUpdates.length).toBe(CANDIDATE_COUNTS.fast);
    expect(progressUpdates[progressUpdates.length - 1]).toEqual({ completed: CANDIDATE_COUNTS.fast, total: CANDIDATE_COUNTS.fast });
  });

  it('stops early when cancelled', async () => {
    const base = { ...defaultParams(), seed: 'chunked-cancel' };
    const token = { cancelled: false };
    let count = 0;
    const result = await generateCandidatesChunked(base, 'premium', 'stockClean', () => {
      count++;
      if (count === 2) token.cancelled = true;
    }, token);
    expect(result.length).toBeLessThan(CANDIDATE_COUNTS.premium);
    expect(result.length).toBeGreaterThan(0);
  });
});
