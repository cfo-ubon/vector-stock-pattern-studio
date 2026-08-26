// AI-SBOS v3, Milestone 20 — Duplicate / Similarity Safety. Reuses the
// existing `normalizedJsonHash` (catalog/domain/hash.ts, the same
// order-independent hashing the import pipeline's own
// `catalog/import/duplicates.ts` uses for its "same design, different
// export" duplicate signal) for the hard exact-duplicate case. Near-
// duplicate ("TOO SIMILAR" — same layout/category with only a tiny
// numeric drift, which a batch of many derived seeds could otherwise
// produce) has no existing engine to reuse — nothing in this codebase
// compares two `GenerateParams` objects for near-equality — so this is a
// small, new, narrowly-scoped comparison, not a duplicated copy of
// anything that already exists.
import { normalizedJsonHash } from '../catalog/domain/hash';
import type { Concept } from './generateFromIntent';

export interface SimilarityWarning {
  conceptIdA: string;
  conceptIdB: string;
  kind: 'EXACT_DUPLICATE' | 'TOO_SIMILAR';
  reason: string;
}

const DENSITY_TOLERANCE = 0.03;
const MOTIF_SIZE_RELATIVE_TOLERANCE = 0.06;

function isNearlyEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Real, evidence-based pairwise comparison — flags a pair only when
 * layout AND category match exactly and both density and motif scale
 * are within a small, explicit tolerance of each other. Never flags
 * pairs that differ in the ways Concept Diversity (Milestone 6)
 * deliberately produces (different layoutId, larger density/scale
 * deltas). */
export async function checkCollectionSimilarity(concepts: Concept[]): Promise<SimilarityWarning[]> {
  const warnings: SimilarityWarning[] = [];
  const hashes = await Promise.all(concepts.map((c) => normalizedJsonHash(c.params)));

  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const a = concepts[i];
      const b = concepts[j];

      if (hashes[i] === hashes[j]) {
        warnings.push({ conceptIdA: a.id, conceptIdB: b.id, kind: 'EXACT_DUPLICATE', reason: 'Identical generation parameters (exact duplicate).' });
        continue;
      }

      if (
        a.params.categoryId === b.params.categoryId &&
        a.params.layoutId === b.params.layoutId &&
        isNearlyEqual(a.params.density, b.params.density, DENSITY_TOLERANCE) &&
        isNearlyEqual(a.params.motifSize, b.params.motifSize, b.params.motifSize * MOTIF_SIZE_RELATIVE_TOLERANCE)
      ) {
        warnings.push({
          conceptIdA: a.id,
          conceptIdB: b.id,
          kind: 'TOO_SIMILAR',
          reason: `Same layout (${a.params.layoutId}) and category, density within ${DENSITY_TOLERANCE} and motif scale within ${Math.round(MOTIF_SIZE_RELATIVE_TOLERANCE * 100)}% — differs only by seed, not composition.`,
        });
      }
    }
  }

  return warnings;
}
