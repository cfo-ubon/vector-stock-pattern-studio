import type { PortfolioAsset } from '../domain/types';
import { totalFileSize } from '../domain/asset';

// Sprint P1, Section 4 (Asset Identity and Duplicate Protection). Never
// modifies file bytes to compute any of these signals — every signal here
// is either a hash already computed during hashing (Section 5, step 2) or
// a plain metadata comparison against already-loaded catalog records.

export interface DuplicateCandidateSignals {
  /** SHA-256 of every raw source file being imported in this group. */
  fileHashes: string[];
  /** Normalized-JSON hash of the parsed JSON source, if one was included. */
  jsonHash?: string;
  originalFilename: string;
  totalFileSize: number;
  generatorSeed?: string;
}

export type DuplicateOutcome =
  | { kind: 'none' }
  | { kind: 'exact'; existingAsset: PortfolioAsset; matchedOn: string[] }
  | { kind: 'possible'; existingAsset: PortfolioAsset; matchedOn: string[] };

/** Exact duplicate: at least one byte-identical source file already exists
 * in the catalog under a different asset — this is the strongest possible
 * signal (a real SHA-256 collision on genuinely different content is not a
 * practical concern) and is the only outcome the import pipeline blocks
 * on by default. Everything else is at most a warning. */
export function detectDuplicate(candidate: DuplicateCandidateSignals, existingAssets: PortfolioAsset[]): DuplicateOutcome {
  for (const asset of existingAssets) {
    const hashOverlap = candidate.fileHashes.filter((h) => asset.sourceHashes.includes(h));
    if (hashOverlap.length > 0) {
      return { kind: 'exact', existingAsset: asset, matchedOn: ['sha256'] };
    }
  }

  for (const asset of existingAssets) {
    const matchedOn: string[] = [];

    if (candidate.jsonHash) {
      const assetJsonHash = jsonHashOf(asset);
      if (assetJsonHash && assetJsonHash === candidate.jsonHash) matchedOn.push('normalizedJsonHash');
    }

    if (
      asset.originalFilename === candidate.originalFilename &&
      sameApproxSize(totalFileSize(asset), candidate.totalFileSize)
    ) {
      matchedOn.push('filename+fileSize');
    }

    if (candidate.generatorSeed && asset.generatorSeed && candidate.generatorSeed === asset.generatorSeed) {
      matchedOn.push('generatorSeed');
    }

    if (matchedOn.length > 0) {
      return { kind: 'possible', existingAsset: asset, matchedOn };
    }
  }

  return { kind: 'none' };
}

function sameApproxSize(a: number, b: number): boolean {
  return a === b;
}

/** The catalog record itself doesn't store a normalized-JSON hash field
 * (only raw per-file SHA-256s) — Build 013's `hashParams`-style approach
 * of hashing *parsed* content only applies at import time, when the JSON
 * is actually in hand; for an already-catalogued asset we can only re-key
 * off its `notes`/`patternType`+`styleDna`+`presetId` combination as a
 * weak proxy. Left unimplemented deliberately (returns undefined) rather
 * than faking a signal — `filename+fileSize` and `generatorSeed` remain
 * the real possible-duplicate signals for already-catalogued assets;
 * `normalizedJsonHash` mainly protects *within one import batch* (see
 * `import/importPipeline.ts`), where the parsed JSON is available for
 * every candidate being compared. */
function jsonHashOf(_asset: PortfolioAsset): string | undefined {
  return undefined;
}
