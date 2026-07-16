import type { PortfolioPatternRecord } from './types';
import { bucket, classifyDuplicate, DEFAULT_DUPLICATE_THRESHOLDS, type DuplicateThresholds } from './fingerprint';

// Build 013, Section 8 (Similarity and Duplicate Intelligence) — the
// portfolio-scale pass that runs `fingerprint.ts`'s per-pair classifier
// across a full generated manifest. Bucketed by `(styleDnaId, layoutId)`
// first, exactly as `BUILD_013_AUDIT.md` committed to, so a 5,000-pattern
// manifest costs at most ~15 buckets * C(≈333, 2) ≈ 830,000 pairwise
// comparisons total, not the 12.5M a naive all-pairs pass would need —
// still bounded and fast (each comparison is a small Jaccard set op), never
// approximated or sampled.

function densityFromFingerprint(fingerprint: string): number {
  const match = fingerprint.match(/density:(-?[\d.]+)/);
  return match ? Number(match[1]) : 0;
}

function nodesFromFingerprint(fingerprint: string): number {
  const match = fingerprint.match(/nodes:(-?[\d.]+)/);
  return match ? Number(match[1]) : 0;
}

/** Mutates `patterns` in place, setting `duplicateStatus`/`similarTo` on
 * every record whose within-bucket comparisons found a match at or above
 * the `near` threshold. Returns aggregate counts per status for the
 * report — real counts, not estimates. */
export function computePortfolioDuplicates(patterns: PortfolioPatternRecord[], thresholds: DuplicateThresholds = DEFAULT_DUPLICATE_THRESHOLDS): Record<'exactDuplicate' | 'deterministicDuplicate' | 'nearDuplicate', number> {
  const buckets = new Map<string, PortfolioPatternRecord[]>();
  for (const p of patterns) {
    const key = `${p.styleDnaId}::${p.layoutId}`;
    const group = buckets.get(key);
    if (group) group.push(p);
    else buckets.set(key, [p]);
  }

  const counts = { exactDuplicate: 0, deterministicDuplicate: 0, nearDuplicate: 0 };

  for (const group of buckets.values()) {
    const prepared = group.map((p) => ({
      record: p,
      shapeSignatures: p.shapeSignatures,
      productTarget: p.productTarget,
      paletteId: p.similarityFingerprint.match(/palette:([^|]+)/)?.[1],
      compositionZone: p.compositionZone,
      densityBucket: bucket(densityFromFingerprint(p.similarityFingerprint), 0.05),
      nodeCountBucket: bucket(nodesFromFingerprint(p.similarityFingerprint), 200),
    }));

    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const classification = classifyDuplicate(prepared[i], prepared[j], thresholds);
        if (!classification) continue;

        const a = prepared[i].record;
        const b = prepared[j].record;
        if (classification.status !== 'acceptableVariant') {
          counts[classification.status]++;
          a.similarTo.push(b.patternId);
          b.similarTo.push(a.patternId);
          // A tile can match multiple neighbors; keep its most severe
          // classification (exact > deterministic > near) rather than the
          // last one encountered, so a report never understates severity.
          const severity = { exactDuplicate: 3, deterministicDuplicate: 2, nearDuplicate: 1 } as const;
          for (const rec of [a, b]) {
            const current = rec.duplicateStatus && rec.duplicateStatus in severity ? severity[rec.duplicateStatus as keyof typeof severity] : 0;
            if (severity[classification.status] > current) rec.duplicateStatus = classification.status;
          }
        }
      }
    }
  }

  return counts;
}
