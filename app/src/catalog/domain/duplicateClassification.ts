import { shapeSetSimilarity } from '../../portfolio/fingerprint';

// Build 026, Phase 2 — 5-way duplicate classification. This module does
// NOT replace `import/duplicates.ts`'s `detectDuplicate` (asset-import
// time, exact/possible) or `submission/submissionDuplicateDetection.ts`
// (submission-time conflict checks) — both stay exactly as they are and
// keep running. This is an additional, coarser-grained classification
// layer the brief asks for by name (`EXACT_DUPLICATE`/`CONFIG_DUPLICATE`/
// `SEED_DUPLICATE`/`POSSIBLE_VISUAL_DUPLICATE`/`NOT_DUPLICATE`), built by
// composing signals those two existing modules and
// `portfolio/fingerprint.ts`'s `shapeSetSimilarity` (Build 013's real
// shape-topology Jaccard similarity, already used for portfolio-scale
// near-duplicate detection) already provide — no new similarity metric is
// invented here.
//
// Honest limitation, stated once here rather than hidden: `shapeSignatures`
// (per-motif shape topology) only exists for assets that still carry their
// generation-time metadata (freshly generated, or imported with the JSON
// sidecar this app itself produces). An asset imported from a bare SVG
// with no JSON sidecar (e.g. a raw file dragged in from outside this app)
// has no shape signatures available, so `POSSIBLE_VISUAL_DUPLICATE` for
// that case falls back to a coarser structural-similarity heuristic (same
// style/composition/product-target family, different seed) — this is
// disclosed as a heuristic, never presented as true pixel/perceptual
// comparison it is not.

export type DuplicateClassification =
  | 'EXACT_DUPLICATE'
  | 'CONFIG_DUPLICATE'
  | 'SEED_DUPLICATE'
  | 'POSSIBLE_VISUAL_DUPLICATE'
  | 'NOT_DUPLICATE';

export interface DuplicateClassificationCandidate {
  productionAssetId?: string;
  sourceHashes: string[];
  generatorVersion: string | null;
  styleDna: string | null;
  presetId: string | null;
  compositionType: string | null;
  productTargets: string[];
  generatorSeed: string | null;
  /** Present only when generation-time metadata (or a re-derivable
   * equivalent) is available — see the module doc comment's disclosed
   * limitation. */
  shapeSignatures?: string[];
}

export interface DuplicateClassificationResult {
  classification: DuplicateClassification;
  /** Which existing candidate (if any) this was classified against. */
  matchedAgainstIndex: number | null;
  /** Human-readable reasons, always non-empty for anything but
   * `NOT_DUPLICATE` — the brief requires every duplicate signal to be
   * explainable, not a bare label. */
  reasons: string[];
  /** Present only for `POSSIBLE_VISUAL_DUPLICATE` classifications backed
   * by real shape-signature comparison (not the coarser fallback
   * heuristic) — callers can use this to distinguish a measured
   * similarity score from the structural-family heuristic. */
  shapeSimilarity?: number;
}

function sortedTargets(targets: string[]): string {
  return [...targets].sort().join(',');
}

function hasHashOverlap(a: string[], b: string[]): boolean {
  return a.some((h) => b.includes(h));
}

const VISUAL_SIMILARITY_THRESHOLD = 0.8;

/** Classifies `candidate` against every entry in `existing`, returning the
 * single strongest classification found (in the brief's own severity
 * order: exact > config > seed > possible-visual > none) — a candidate
 * that is an exact duplicate of one existing asset and merely a
 * config-duplicate of another is reported as `EXACT_DUPLICATE`, never
 * silently downgraded by iteration order. Never rejects/blocks anything
 * itself — purely classification, matching the brief's "do not silently
 * reject near-duplicates" rule; the caller decides what to do with the
 * result. */
export function classifyDuplicateCandidate(
  candidate: DuplicateClassificationCandidate,
  existing: DuplicateClassificationCandidate[],
): DuplicateClassificationResult {
  let best: DuplicateClassificationResult = { classification: 'NOT_DUPLICATE', matchedAgainstIndex: null, reasons: [] };
  const rank: Record<DuplicateClassification, number> = {
    EXACT_DUPLICATE: 4,
    CONFIG_DUPLICATE: 3,
    SEED_DUPLICATE: 2,
    POSSIBLE_VISUAL_DUPLICATE: 1,
    NOT_DUPLICATE: 0,
  };

  existing.forEach((other, index) => {
    const result = classifyPair(candidate, other);
    if (rank[result.classification] > rank[best.classification]) {
      best = { ...result, matchedAgainstIndex: index };
    }
  });

  return best;
}

function classifyPair(
  candidate: DuplicateClassificationCandidate,
  other: DuplicateClassificationCandidate,
): Omit<DuplicateClassificationResult, 'matchedAgainstIndex'> {
  const reasons: string[] = [];

  // EXACT_DUPLICATE: same content-derived production identity, or any raw
  // source-file byte hash in common — the strongest possible signal.
  if (candidate.productionAssetId && candidate.productionAssetId === other.productionAssetId) {
    return { classification: 'EXACT_DUPLICATE', reasons: ['Same productionAssetId (identical generation configuration and content).'] };
  }
  if (hasHashOverlap(candidate.sourceHashes, other.sourceHashes)) {
    return { classification: 'EXACT_DUPLICATE', reasons: ['At least one identical source-file SHA-256 hash.'] };
  }

  // CONFIG_DUPLICATE: identical generation configuration (everything that
  // deterministically produces the same output GIVEN the same seed) but a
  // different seed — i.e. the same recipe run with a different random draw.
  const sameConfig =
    candidate.generatorVersion === other.generatorVersion &&
    candidate.styleDna === other.styleDna &&
    candidate.presetId === other.presetId &&
    candidate.compositionType === other.compositionType &&
    sortedTargets(candidate.productTargets) === sortedTargets(other.productTargets);
  const sameSeed = Boolean(candidate.generatorSeed) && candidate.generatorSeed === other.generatorSeed;

  if (sameConfig && !sameSeed) {
    reasons.push('Identical generator version, Style DNA, preset, composition, and product targets — different seed.');
    return { classification: 'CONFIG_DUPLICATE', reasons };
  }

  // SEED_DUPLICATE: same seed and preset, but something about the
  // configuration or resulting content differs (e.g. regenerated after a
  // generator update, or the same seed reused under a different preset) —
  // a weaker signal than CONFIG_DUPLICATE because the seed alone does not
  // guarantee the same output once anything else about the recipe changes.
  if (sameSeed && candidate.presetId === other.presetId && !sameConfig) {
    reasons.push('Same generator seed and preset, but generator version/composition/product targets differ.');
    return { classification: 'SEED_DUPLICATE', reasons };
  }

  // POSSIBLE_VISUAL_DUPLICATE: real shape-signature comparison when both
  // sides have it (Build 013's Jaccard similarity over shape topology);
  // otherwise the disclosed coarser structural-family fallback.
  if (candidate.shapeSignatures && other.shapeSignatures) {
    const similarity = shapeSetSimilarity(candidate.shapeSignatures, other.shapeSignatures);
    if (similarity >= VISUAL_SIMILARITY_THRESHOLD) {
      return {
        classification: 'POSSIBLE_VISUAL_DUPLICATE',
        reasons: [`Shape-signature similarity ${(similarity * 100).toFixed(0)}% (measured, not a heuristic).`],
        shapeSimilarity: similarity,
      };
    }
  } else if (
    candidate.styleDna &&
    candidate.styleDna === other.styleDna &&
    candidate.compositionType === other.compositionType &&
    sortedTargets(candidate.productTargets) === sortedTargets(other.productTargets) &&
    candidate.generatorSeed !== other.generatorSeed
  ) {
    reasons.push('Same style/composition/product-target family with a different seed — structural heuristic only, no shape comparison available for this pair.');
    return { classification: 'POSSIBLE_VISUAL_DUPLICATE', reasons };
  }

  return { classification: 'NOT_DUPLICATE', reasons: [] };
}
