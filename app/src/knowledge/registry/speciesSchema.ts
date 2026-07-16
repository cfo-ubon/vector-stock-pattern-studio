import type { BotanicalFamily } from '../../generators/botanicalFamilies';
import type { GROWTH_PRESETS } from '../../generators/growth';

// Build 008B, Section 1 (Commercial Botanical Species Library) — a real,
// versioned schema for botanical species knowledge, following the exact
// convention Build 008A's `styleSchema.ts` established (a schema module
// paired with a loader and real JSON data, not a re-shape of an existing
// public type). This SUPERSEDES Build 004/005/006/007's
// `BotanicalSpeciesProfile` (generators/botanicalFamilies.ts) with a
// genuinely richer record — every field the brief names (bloom category,
// flower diameter class, bloom stage range, petal count/arrangement/
// overlap/silhouette/edge, center/sepal structure, stem thickness,
// branching tendency, leaf/vein type, natural color families, premium/
// elegance/commercial-popularity scores, a real companion matrix, usage
// profiles) — while every field `BotanicalSpeciesProfile` already had
// (`silhouette`, `growthPreset`, `stemLengthScale`, `leafDensityScale`,
// `bouquetRole`, `companionFamilies`) keeps its exact old name and value
// space, so every existing consumer (`premiumHero.ts`,
// `illustrationFamily.ts`, `designKnowledge.ts`, `pickCompanionFamily`)
// reads unchanged data through the same field names it always has.
//
// `premiumScore`/`eleganceScore`/`commercialPopularity` are hand-authored
// editorial judgments — the same convention `engine/styleDna.ts`'s own
// `exportRecommendation.bestProductTargets` already established ("a
// hand-authored editorial judgment matching each style's own description,
// not a computed/measured score"). They inform Section 6's real asset-
// weighting and Section 4/8's species-selection bias; they are NEVER
// blended into Section 9's measured portfolio metrics (Illustration
// Quality, Hero Visibility, etc. stay 100% computed from real SVG
// structure) — mixing hand-authored input data with measured output
// metrics would be exactly the "fake metric" the brief forbids.

export const SPECIES_SCHEMA_VERSION = '1.0';

export type CompanionRole = 'foliage' | 'filler' | 'accentBerry';

/** Build 010, Section 4 (Botanical Relationship Engine V2): `CompanionRole`
 * only ever said WHICH part a companion draws (foliage/filler/berry) — real
 * florist companions also have a real spatial habit relative to the hero
 * stem, which nothing before this build encoded. `'trailing'` (e.g. a
 * wispy/airy companion draping past the hero's own footprint), `'nesting'`
 * (a filler/berry companion tucked in close, behind or among the hero's own
 * blooms), `'climbing'` (a companion that wraps/aligns along the hero's own
 * vertical stem axis), or `'none'`/undefined (no spatial bias — the exact
 * pre-Build-010 behavior). See `generators/premiumHero.ts`'s
 * `applyCompanionSpatialBias` for the consumer. */
export type SpatialRelationship = 'trailing' | 'nesting' | 'climbing' | 'none';

export interface SpeciesCompanion {
  family: BotanicalFamily;
  role: CompanionRole;
  /** 0-1, how strongly a real florist would reach for this pairing —
   * used as the real weight in `pickCompanionFamily`'s roll (Section 2),
   * replacing the old uniform random pick across a flat list. */
  strength: number;
  /** Build 010, Section 4: optional — undefined/`'none'` reproduces every
   * pre-Build-010 companion's exact behavior (no spatial bias). */
  spatialRelationship?: SpatialRelationship;
}

export type UsageProfileId =
  | 'luxuryFloral' | 'editorialBotanical' | 'wallpaper' | 'textile' | 'wedding'
  | 'greetingCard' | 'fabric' | 'packaging' | 'nursery' | 'vintage'
  | 'scandinavian' | 'minimal' | 'modern';

export const USAGE_PROFILE_IDS: UsageProfileId[] = [
  'luxuryFloral', 'editorialBotanical', 'wallpaper', 'textile', 'wedding',
  'greetingCard', 'fabric', 'packaging', 'nursery', 'vintage',
  'scandinavian', 'minimal', 'modern',
];

export interface BotanicalSpeciesRecord {
  id: BotanicalFamily;
  label: string;
  /** Real plant taxonomy (e.g. "Rosaceae") — genuine botanical
   * information, not decorative. */
  botanicalFamilyName: string;

  // --- Existing fields (Build 004/005/006/007), unchanged semantics ---
  silhouette: 'rounded' | 'layered' | 'spiky' | 'airy' | 'architectural' | 'wispy' | 'clustered' | 'broadLeaf';
  growthPreset: keyof typeof GROWTH_PRESETS;
  stemLengthScale: number;
  leafDensityScale: number;
  bouquetRole: 'statement' | 'supporting' | 'filler' | 'foliageOnly';
  /** Kept for backward compatibility — always exactly the `family` values
   * of `companions` below, in the same order, derived not hand-duplicated. */
  companionFamilies: BotanicalFamily[];

  // --- Section 1: new commercial artistic fields ---
  flowerDiameterClass: 'none' | 'small' | 'medium' | 'large' | 'extraLarge';
  bloomStageRange: [number, number];
  petalCountRange: [number, number];
  petalArrangement: 'none' | 'single' | 'double' | 'layered' | 'rosette' | 'spike' | 'cluster';
  petalOverlap: 'none' | 'slight' | 'moderate' | 'heavy';
  petalSilhouette: 'none' | 'rounded' | 'pointed' | 'ruffled' | 'trumpet' | 'star' | 'cupped';
  petalEdgeStyle: 'none' | 'smooth' | 'serrated' | 'ruffled' | 'fringed';
  centerStructure: 'none' | 'disc' | 'cone' | 'pompom' | 'open';
  sepalStructure: 'none' | 'minimal' | 'star' | 'fused' | 'leafy';
  stemThickness: 'thin' | 'medium' | 'thick';
  branchingTendency: 'single' | 'sparse' | 'branching' | 'shrubby';
  leafType: 'none' | 'ovate' | 'serrated' | 'narrow' | 'broad' | 'compound' | 'frond';
  veinType: 'none' | 'pinnate' | 'parallel' | 'palmate';
  naturalColorFamilies: string[];
  premiumScore: number;
  eleganceScore: number;
  commercialPopularity: number;

  // --- Section 2/4: companion matrix + usage profiles ---
  companions: SpeciesCompanion[];
  usageProfiles: UsageProfileId[];
}

const REQUIRED_STRING_FIELDS: Array<keyof BotanicalSpeciesRecord> = [
  'id', 'label', 'botanicalFamilyName', 'silhouette', 'growthPreset', 'bouquetRole',
  'flowerDiameterClass', 'petalArrangement', 'petalOverlap', 'petalSilhouette', 'petalEdgeStyle',
  'centerStructure', 'sepalStructure', 'stemThickness', 'branchingTendency', 'leafType', 'veinType',
];
const REQUIRED_NUMBER_FIELDS: Array<keyof BotanicalSpeciesRecord> = [
  'stemLengthScale', 'leafDensityScale', 'premiumScore', 'eleganceScore', 'commercialPopularity',
];
const SCORE_FIELDS: Array<keyof BotanicalSpeciesRecord> = ['premiumScore', 'eleganceScore', 'commercialPopularity'];

export interface SpeciesValidationIssue {
  field: string;
  message: string;
}
export interface SpeciesValidationResult {
  valid: boolean;
  issues: SpeciesValidationIssue[];
}

/** Validates one raw species record — missing/wrong-type fields, malformed
 * range tuples, out-of-[0,100] scores, and structurally invalid companion
 * entries, each with a readable, field-named message (mirrors
 * `styleSchema.ts`'s `validateStyleRecord` exactly). */
export function validateSpeciesRecord(record: unknown): SpeciesValidationResult {
  const issues: SpeciesValidationIssue[] = [];
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return { valid: false, issues: [{ field: '(root)', message: 'Species record must be a plain object.' }] };
  }
  const r = record as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof r[field] !== 'string' || r[field] === '') {
      issues.push({ field, message: `Missing or empty required string field "${field}".` });
    }
  }
  for (const field of REQUIRED_NUMBER_FIELDS) {
    if (typeof r[field] !== 'number' || Number.isNaN(r[field] as number)) {
      issues.push({ field, message: `Missing or non-numeric required field "${field}".` });
    }
  }
  for (const field of SCORE_FIELDS) {
    const v = r[field];
    if (typeof v === 'number' && (v < 0 || v > 100)) {
      issues.push({ field, message: `Field "${field}" must be in [0, 100], got ${v}.` });
    }
  }
  for (const field of ['bloomStageRange', 'petalCountRange'] as const) {
    const v = r[field];
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number' || v[0] > v[1]) {
      issues.push({ field, message: `Field "${field}" must be a real [min, max] number tuple with min <= max.` });
    }
  }
  if (!Array.isArray(r.naturalColorFamilies) || r.naturalColorFamilies.length === 0) {
    if (r.bouquetRole !== 'foliageOnly') {
      issues.push({ field: 'naturalColorFamilies', message: 'Must be a non-empty array for any blooming species.' });
    }
  }
  if (!Array.isArray(r.usageProfiles) || r.usageProfiles.length === 0) {
    issues.push({ field: 'usageProfiles', message: 'Must be a non-empty array — every species needs at least one real usage fit.' });
  }
  if (!Array.isArray(r.companions)) {
    issues.push({ field: 'companions', message: 'Must be an array (empty array is valid for a companion species itself).' });
  } else {
    r.companions.forEach((c, i) => {
      const companion = c as Record<string, unknown>;
      if (typeof companion?.family !== 'string') issues.push({ field: `companions[${i}].family`, message: 'Must be a string family id.' });
      if (!['foliage', 'filler', 'accentBerry'].includes(companion?.role as string)) {
        issues.push({ field: `companions[${i}].role`, message: `Must be one of [foliage, filler, accentBerry], got ${JSON.stringify(companion?.role)}.` });
      }
      if (typeof companion?.strength !== 'number' || (companion.strength as number) < 0 || (companion.strength as number) > 1) {
        issues.push({ field: `companions[${i}].strength`, message: 'Must be a number in [0, 1].' });
      }
      if (companion?.spatialRelationship !== undefined && !['trailing', 'nesting', 'climbing', 'none'].includes(companion.spatialRelationship as string)) {
        issues.push({
          field: `companions[${i}].spatialRelationship`,
          message: `If present, must be one of [trailing, nesting, climbing, none], got ${JSON.stringify(companion.spatialRelationship)}.`,
        });
      }
    });
  }

  return { valid: issues.length === 0, issues };
}
