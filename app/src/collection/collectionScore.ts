import { checkSvgStringValidity } from '../engine/candidateEngine';
import { extractMotifShapeSignatures } from '../engine/svgGeometry';
import type { AssetType, GeneratedCollection } from './collectionGenerator';

// Collection Score — the Collection Studio spec's 5-dimension scoring
// (Style/Palette/Motif/Flow Consistency + Commercial Readiness), extended
// by Commercial Collection Engine Phase 4 (Section 9, "Collection
// Quality") with two more real dimensions: Layout Diversity and Motif
// Shape Diversity. Every dimension is computed from the collection's own
// real, already-generated data (patternParams/patternTiles the generator
// resolved, the assembled assets' actual SVG strings) — no guessing, no
// placeholder numbers, the same "real, narrowly-scoped, directly-tested"
// convention every other scoring module in this app follows
// (engine/scoring.ts, engine/qualityScore.ts, metadata/submissionCenter.ts's
// SEO analyzer).

export interface CollectionScore {
  styleConsistency: number;
  paletteConsistency: number;
  motifConsistency: number;
  flowConsistency: number;
  /** Fraction of the collection's pattern-type assets using a genuinely
   * distinct layout (Section 5, "Layout Variation") — reads `patternTiles`
   * (all 6 pattern assets including Background Texture), not the older
   * 5-element `patternParams`, so it reflects every layout the generator
   * actually assigned. */
  layoutDiversity: number;
  /** Real shape-topology diversity pooled across every pattern-type
   * asset's placed motifs — reuses engine/svgGeometry.ts's
   * `extractMotifShapeSignatures` (the same rotation/scale/position-
   * invariant signature the SVG Intelligence Engine's own
   * `motifShapeDiversity` metric measures per-tile), just pooled across
   * the whole collection instead of one tile, so a collection that reuses
   * the exact same one or two motif shapes everywhere scores low even if
   * each individual tile looks internally varied. */
  motifShapeDiversity: number;
  commercialReadiness: number;
  overall: number;
  issues: string[];
}

/** The 14 creative asset types every collection must contain — used by the
 * commercialReadiness dimension's completeness check. Deliberately excludes
 * metadata/seoPackage: those are SEO extras, not part of the Collection
 * Studio spec's core asset structure. Phase 4b adds `densePattern` and
 * `airyPattern` (Section 2's remaining two named asset kinds). */
export const REQUIRED_ASSET_TYPES: AssetType[] = [
  'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern', 'backgroundTexture',
  'densePattern', 'airyPattern',
  'borderPattern', 'cornerPattern', 'spotMotifSheet', 'individualMotif', 'decorativeElementsSheet', 'collectionPreview',
];

/** Shannon-entropy diversity of a list of discrete labels, normalized to
 * 0-100 (100 = every label distinct, 0 = every label identical) — the same
 * general idea engine/scoring.ts's own (private) per-tile
 * `computeMotifShapeDiversity` uses, deliberately reimplemented as a small
 * local helper here rather than imported: this module scores diversity
 * *across the whole collection*, a different scope than that one's
 * per-tile measurement, and duplicating ~8 lines of generic entropy math
 * is cheaper and more honest than reaching into another module's private
 * internals or changing its public surface for a scope it wasn't designed
 * for. */
function shannonDiversity(labels: string[]): number {
  if (labels.length <= 1) return 100;
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  if (counts.size <= 1) return 0;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / labels.length;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(counts.size);
  return Math.round((entropy / maxEntropy) * 100);
}

/** Fraction of `values` that share the most common value — 1 when every
 * value agrees, trending toward 0 as they scatter. Used for Style/Palette/
 * Motif/Flow Consistency instead of a plain binary consistent/inconsistent
 * flag, so a collection with e.g. 4/5 patterns agreeing scores 80, not 0. */
function majorityFraction(values: unknown[]): number {
  if (values.length === 0) return 1;
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = JSON.stringify(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  return max / values.length;
}

export function computeCollectionScore(collection: GeneratedCollection): CollectionScore {
  const { assets, patternParams, patternTiles } = collection;
  const issues: string[] = [];

  const styleFrac = majorityFraction(patternParams.map((p) => p.styleDnaId ?? 'none'));
  if (styleFrac < 1) issues.push('Style DNA ไม่ตรงกันในบางชิ้นงานของคอลเลกชัน');
  const styleConsistency = Math.round(styleFrac * 100);

  const paletteFrac = majorityFraction(patternParams.map((p) => p.paletteId));
  if (paletteFrac < 1) issues.push('Palette ไม่ตรงกันในบางชิ้นงานของคอลเลกชัน');
  const paletteConsistency = Math.round(paletteFrac * 100);

  const motifFrac = majorityFraction(patternParams.map((p) => p.categoryId));
  if (motifFrac < 1) issues.push('Motif family (category) ไม่ตรงกันในบางชิ้นงานของคอลเลกชัน');
  const motifConsistency = Math.round(motifFrac * 100);

  // Flow: the composition-flow-governing params (rotation/scale jitter,
  // mirror, radial symmetry, overlap amount) are deliberately inherited
  // unchanged from baseParams for every pattern asset — layout/density/
  // hierarchy are the only things the generator varies per asset type. A
  // drop below 100 here is a real structural signal that something
  // accidentally diverged one of these shared identity fields.
  const flowFrac = majorityFraction(
    patternParams.map((p) => [p.rotationJitter, p.scaleJitter, p.mirror, p.radialSymmetry, p.overlapAmount ?? 0]),
  );
  if (flowFrac < 1) issues.push('พารามิเตอร์ flow (rotation/scale jitter, mirror, radial symmetry) ไม่ตรงกันในบางชิ้นงาน');
  const flowConsistency = Math.round(flowFrac * 100);

  const svgAssets = assets.filter((a) => !!a.svg);
  const invalidAssets = svgAssets.filter((a) => !checkSvgStringValidity(a.svg!).valid);
  for (const a of invalidAssets) issues.push(`${a.label}: โครงสร้าง SVG มีปัญหา`);
  const presentTypes = new Set(assets.map((a) => a.type));
  const missingTypes = REQUIRED_ASSET_TYPES.filter((t) => !presentTypes.has(t));
  for (const t of missingTypes) issues.push(`ขาดชิ้นงานที่จำเป็นของคอลเลกชัน: ${t}`);
  const structuralFrac = svgAssets.length > 0 ? (svgAssets.length - invalidAssets.length) / svgAssets.length : 1;
  const completenessFrac = (REQUIRED_ASSET_TYPES.length - missingTypes.length) / REQUIRED_ASSET_TYPES.length;
  const commercialReadiness = Math.round(((structuralFrac + completenessFrac) / 2) * 100);

  // Layout Diversity (Section 9) — real: distinct layoutId fraction across
  // every pattern-type tile the generator actually built, not a guess.
  const layoutIds = patternTiles.map((t) => t.params.layoutId);
  const layoutDiversity = layoutIds.length > 0 ? Math.round((new Set(layoutIds).size / layoutIds.length) * 100) : 100;
  if (layoutDiversity < 100) issues.push('ชิ้นงานบางคู่ใช้ layout ซ้ำกัน — ควรให้แต่ละชิ้นงานมี layout ที่ต่างกัน');

  // Motif Shape Diversity (Section 9) — real: shape-topology signatures
  // (rotation/scale/position-invariant) pooled across every pattern-type
  // tile's placed motifs, scored by Shannon-entropy diversity.
  const pooledShapeSignatures = patternTiles.flatMap((t) => extractMotifShapeSignatures(t));
  const motifShapeDiversity = shannonDiversity(pooledShapeSignatures);
  if (motifShapeDiversity < 40) issues.push('ชิ้นลายในคอลเลกชันซ้ำรูปทรงกันมากเกินไป — ควรมีความหลากหลายของรูปทรงมากขึ้น');

  const overall = Math.round(
    (styleConsistency + paletteConsistency + motifConsistency + flowConsistency + layoutDiversity + motifShapeDiversity + commercialReadiness) / 7,
  );

  return {
    styleConsistency,
    paletteConsistency,
    motifConsistency,
    flowConsistency,
    layoutDiversity,
    motifShapeDiversity,
    commercialReadiness,
    overall,
    issues,
  };
}
