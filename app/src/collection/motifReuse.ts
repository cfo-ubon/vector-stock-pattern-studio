import type { FactoryMotif, MotifFamily, MotifRole } from '../engine/motifFactory';
import type { MotifPlacementLogEntry } from '../engine/borderCornerAssets';
import type { CollectionManifest } from './collectionGenerator';

// Motif Reuse Engine — Commercial Collection Engine Phase 4b, Section 6.
// Every field here is read straight off data collection/collectionGenerator.ts
// already computed (the manifest's real asset->motif relationships, the
// real FactoryMotif set, and the real per-placement rotation/scale variants
// buildBorderStrip/buildCornerUnit already chose) — this module never
// generates geometry itself, it only reports on reuse that's already real.
//
// Honest scope note: the brief names "Shared Leaves" as its own category
// alongside "Shared Fillers"/"Shared Decorative Elements". This codebase's
// motif vocabulary tracks *role* (hero/secondary/filler/accent/icon/
// background — engine/motifFactory.ts's `MotifRole`) and *family*
// (flower/leaf/branch/berry/icon/decorative/background/geometric —
// `MotifFamily`) as two separate, real, already-computed dimensions.
// "Shared Leaves" is reported here as reused motifs whose *family* is
// literally 'leaf' (real for tropical/some botanical collections, honestly
// empty for a geometric or mandala collection that has no leaf-family
// motifs to share) rather than inventing a parallel role that no generator
// actually tags.

/** One shared motif's real placement at one specific spot, tagged with
 * which collection asset used it — `MotifPlacementLogEntry` (rotation/
 * scale) plus the asset id, so "Variant Rotations"/"Variant Shapes" report
 * real numbers instead of a guess. */
export interface CollectionMotifPlacement extends MotifPlacementLogEntry {
  assetId: string;
}

export interface MotifReuseEntry {
  motifId: string;
  role: MotifRole;
  family: MotifFamily;
  /** Every distinct asset id this motif's id appears in (from the
   * manifest's real relationships list), sorted for determinism. */
  usedInAssetIds: string[];
  /** usedInAssetIds.length — >1 means this motif is genuinely reused, not
   * just generated once and used once. */
  reuseCount: number;
  /** Real per-placement rotation/scale variants this motif got, when the
   * asset that placed it tracks placement-level data (currently Border and
   * Corner assets — engine/borderCornerAssets.ts). Empty for motifs placed
   * by builders that don't expose per-instance data (e.g. buildMotifSheet's
   * plain reference grid has no meaningful "variant" beyond uniform fit-
   * scale, so it's honestly omitted rather than fabricated). */
  variants: CollectionMotifPlacement[];
}

export interface MotifReuseReport {
  sharedHeroMotifs: MotifReuseEntry[];
  sharedLeaves: MotifReuseEntry[];
  sharedFillers: MotifReuseEntry[];
  sharedDecorativeElements: MotifReuseEntry[];
  /** Every distinct motif id referenced by any asset in the collection. */
  totalDistinctMotifs: number;
  /** How many of those are used in more than one asset (reuseCount > 1). */
  reusedMotifCount: number;
  /** reusedMotifCount / totalDistinctMotifs, 0-100. */
  reuseRatio: number;
}

/** Builds the Section 6 report from a collection's own already-computed
 * manifest relationships, factory motif set, and (optional) real placement
 * log — pure aggregation, no regeneration, no guessing. `placements`
 * defaults to empty so callers that only have relationships/motifs (no
 * placement-level detail) still get a real, if variant-less, report. */
export function buildMotifReuseReport(
  relationships: CollectionManifest['relationships'],
  motifs: FactoryMotif[],
  placements: CollectionMotifPlacement[] = [],
): MotifReuseReport {
  const motifById = new Map(motifs.map((m) => [m.id, m]));

  const assetIdsByMotif = new Map<string, Set<string>>();
  for (const rel of relationships) {
    const set = assetIdsByMotif.get(rel.motifId) ?? new Set<string>();
    set.add(rel.assetId);
    assetIdsByMotif.set(rel.motifId, set);
  }

  const variantsByMotif = new Map<string, CollectionMotifPlacement[]>();
  for (const p of placements) {
    const list = variantsByMotif.get(p.motifId) ?? [];
    list.push(p);
    variantsByMotif.set(p.motifId, list);
  }

  const entries: MotifReuseEntry[] = [...assetIdsByMotif.entries()].map(([motifId, assetIdSet]) => {
    const motif = motifById.get(motifId);
    return {
      motifId,
      role: motif?.role ?? 'accent',
      family: motif?.family ?? 'decorative',
      usedInAssetIds: [...assetIdSet].sort(),
      reuseCount: assetIdSet.size,
      variants: variantsByMotif.get(motifId) ?? [],
    };
  });

  const reused = entries.filter((e) => e.reuseCount > 1);
  const totalDistinctMotifs = entries.length;
  const reusedMotifCount = reused.length;

  return {
    sharedHeroMotifs: reused.filter((e) => e.role === 'hero'),
    sharedLeaves: reused.filter((e) => e.family === 'leaf'),
    sharedFillers: reused.filter((e) => e.role === 'filler'),
    sharedDecorativeElements: reused.filter((e) => e.role === 'accent'),
    totalDistinctMotifs,
    reusedMotifCount,
    reuseRatio: totalDistinctMotifs > 0 ? Math.round((reusedMotifCount / totalDistinctMotifs) * 100) : 0,
  };
}
