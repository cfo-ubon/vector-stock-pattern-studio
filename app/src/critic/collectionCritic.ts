import { computeCollectionScore, type CollectionScore } from '../collection/collectionScore';
import type { GeneratedCollection } from '../collection/collectionGenerator';

// Design Critic & Art Direction Engine (Phase 7) — Section 6 "Collection
// Critic". `collection/collectionScore.ts`'s `computeCollectionScore`
// (Commercial Collection Engine Phase 4) already IS the real cross-asset
// consistency evaluator — this module packages its output into the
// brief's own named checklist (Palette, Motifs, Layouts, Visual Identity,
// Variation) rather than recomputing anything.
//
// Mapping (documented, not fabricated): Palette <- `paletteConsistency`,
// Motifs <- `motifConsistency`, Layouts <- `layoutDiversity`, Variation
// <- `motifShapeDiversity` (real shape-topology diversity pooled across
// the collection — the direct "how much does it actually vary" counter-
// balance to Motifs' consistency check). "Visual Identity" has no
// existing dedicated measurement in this codebase (confirmed during
// Phase 7 scoping) — rather than inventing a new independent metric, it
// is honestly derived here as the average of the three real consistency
// signals (style/palette/motif), i.e. "does this collection look like it
// came from one hand", and documented as a composite, not a fabricated
// standalone score.

export interface CollectionCriticIssue {
  /** The real Thai-language issue string `computeCollectionScore` already
   * produces — kept verbatim, never machine-translated (avoids
   * mistranslation risk). */
  message: string;
}

export interface CollectionCritique {
  palette: number;
  motifs: number;
  layouts: number;
  visualIdentity: number;
  variation: number;
  commercialReadiness: number;
  overall: number;
  issues: CollectionCriticIssue[];
  raw: CollectionScore;
}

/** Builds the Section 6 critique from a real, already-generated
 * Collection — pure packaging of `computeCollectionScore`'s real output. */
export function critiqueCollection(collection: GeneratedCollection): CollectionCritique {
  const score = computeCollectionScore(collection);
  const visualIdentity = Math.round((score.styleConsistency + score.paletteConsistency + score.motifConsistency) / 3);
  return {
    palette: score.paletteConsistency,
    motifs: score.motifConsistency,
    layouts: score.layoutDiversity,
    visualIdentity,
    variation: score.motifShapeDiversity,
    commercialReadiness: score.commercialReadiness,
    overall: score.overall,
    issues: score.issues.map((message) => ({ message })),
    raw: score,
  };
}
