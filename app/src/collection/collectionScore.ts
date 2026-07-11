import { checkSvgStringValidity } from '../engine/candidateEngine';
import type { AssetType, GeneratedCollection } from './collectionGenerator';

// Collection Score — the Collection Studio spec's 5-dimension scoring
// (Style/Palette/Motif/Flow Consistency + Commercial Readiness). Every
// dimension is computed from the collection's own real, already-generated
// data (patternParams the generator resolved, the assembled assets' actual
// SVG strings) — no guessing, no placeholder numbers, the same
// "real, narrowly-scoped, directly-tested" convention every other scoring
// module in this app follows (engine/scoring.ts, engine/qualityScore.ts,
// metadata/submissionCenter.ts's SEO analyzer).

export interface CollectionScore {
  styleConsistency: number;
  paletteConsistency: number;
  motifConsistency: number;
  flowConsistency: number;
  commercialReadiness: number;
  overall: number;
  issues: string[];
}

/** The 10 creative asset types every collection must contain — used by the
 * commercialReadiness dimension's completeness check. Deliberately excludes
 * metadata/seoPackage: those are SEO extras, not part of the Collection
 * Studio spec's core 10-asset structure. */
export const REQUIRED_ASSET_TYPES: AssetType[] = [
  'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern',
  'borderPattern', 'cornerPattern', 'spotMotifSheet', 'decorativeElementsSheet', 'collectionPreview',
];

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
  const { assets, patternParams } = collection;
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

  const overall = Math.round((styleConsistency + paletteConsistency + motifConsistency + flowConsistency + commercialReadiness) / 5);

  return { styleConsistency, paletteConsistency, motifConsistency, flowConsistency, commercialReadiness, overall, issues };
}
