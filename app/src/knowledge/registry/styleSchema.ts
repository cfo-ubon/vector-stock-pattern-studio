import type { StyleDna } from '../../engine/styleDna';

// Build 008A, Section 4 (Style Schema) — a versioned schema for Style DNA.
// This is NOT a re-shape of the data: `engine/styleDna.ts`'s `StyleDna`
// interface (id/label/description/categories/layouts/.../exportRecommendation,
// one flat record) is the app's own public shape already — its own
// `exportStyleDnaJson`/`importStyleDnaJson` round-trip it as-is, and every
// consumer across App.tsx/collectionGenerator.ts/trend/*/Workbench reads
// it flat. Restructuring it into nested groups here would break that
// public format for zero real benefit (Section 7's compatibility
// requirement exists precisely to prevent this). Instead, this module
// gives the EXISTING flat shape a real version number and groups its
// fields under the brief's own named categories for documentation and
// diagnostics — a schema in the sense of "a versioned, validated contract
// for what a Style record must contain," not a new JSON layout.

export const STYLE_SCHEMA_VERSION = '1.0';

/** The brief's own 10 named field categories, mapped onto the real,
 * already-shipped `StyleDna` fields — used by `KnowledgeRegistry.diagnostics()`
 * to report which category a validation issue belongs to, and by this
 * module's own tests to assert every `StyleDna` field is accounted for
 * (no field silently uncategorized). */
export const STYLE_SCHEMA_FIELD_CATEGORIES = {
  identity: ['id', 'label', 'description', 'custom', 'trendPresetId'],
  designPhilosophy: ['motifComplexity', 'rhythmProfile', 'colorStrategy', 'backgroundStrategy', 'svgDepthMode'],
  heroStrategy: ['hierarchyPreset', 'premiumHero', 'preferredFamilies'],
  clusterStrategy: ['clusterStyle', 'clusterDensity', 'preferredClusterArchetypes'],
  density: ['density'],
  negativeSpace: ['negativeSpace'],
  flow: ['flowProfile', 'preferredZones', 'overlapMode', 'overlapAmount'],
  palette: ['paletteIds', 'botanicalGrowthPreset'],
  commercialNotes: ['exportRecommendation'],
  compatibility: ['categories', 'layouts'],
} as const satisfies Record<string, Array<keyof StyleDna>>;

const REQUIRED_STRING_FIELDS: Array<keyof StyleDna> = ['id', 'label', 'description', 'hierarchyPreset'];
const REQUIRED_NUMBER_FIELDS: Array<keyof StyleDna> = ['density', 'negativeSpace', 'overlapAmount', 'clusterDensity'];
const REQUIRED_ARRAY_FIELDS: Array<keyof StyleDna> = ['categories', 'layouts', 'paletteIds'];
const REQUIRED_ENUM_FIELDS: Record<string, string[]> = {
  overlapMode: ['none', 'subtle', 'natural', 'dense'],
  flowProfile: ['calm', 'directional', 'dynamic'],
  rhythmProfile: ['regular', 'organic', 'syncopated'],
  clusterStyle: ['none', 'loose', 'tight', 'bouquet'],
  motifComplexity: ['simple', 'moderate', 'intricate'],
  colorStrategy: ['dominantDuo', 'fullPalette', 'monochromeAccent', 'highContrast'],
  backgroundStrategy: ['minimalLight', 'richContrast', 'darkMoody', 'neutralPaper'],
  svgDepthMode: ['flat', 'soft', 'dimensional'],
};

export interface StyleValidationIssue {
  /** Dot-path field name, e.g. `"density"` or `"exportRecommendation.tileSize"`. */
  field: string;
  message: string;
}

export interface StyleValidationResult {
  valid: boolean;
  issues: StyleValidationIssue[];
}

/** Validates one raw record against the Style Schema — missing fields,
 * wrong types, and out-of-enum values, each with a readable message
 * naming the exact field and what's wrong (Section 6's own requirement).
 * Cross-record checks (duplicate ids, unknown category/palette/hierarchy
 * references) are deliberately NOT here — those need the full loaded set
 * and the engine's own currently-registered tables, so they live in
 * `KnowledgeRegistry.validate()` instead, matching the same "each check
 * lives where it has the context to run" precedent `isStyleDnaCompatible`
 * in `engine/styleDna.ts` already set for cross-referencing. */
export function validateStyleRecord(record: unknown): StyleValidationResult {
  const issues: StyleValidationIssue[] = [];
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return { valid: false, issues: [{ field: '(root)', message: 'Style record must be a plain object.' }] };
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
  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(r[field]) || (r[field] as unknown[]).length === 0) {
      issues.push({ field, message: `Missing or empty required array field "${field}".` });
    }
  }
  for (const [field, allowed] of Object.entries(REQUIRED_ENUM_FIELDS)) {
    const value = r[field];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      issues.push({ field, message: `Field "${field}" must be one of [${allowed.join(', ')}], got ${JSON.stringify(value)}.` });
    }
  }

  const exportRec = r.exportRecommendation;
  if (typeof exportRec !== 'object' || exportRec === null || Array.isArray(exportRec)) {
    issues.push({ field: 'exportRecommendation', message: 'Missing or invalid "exportRecommendation" object.' });
  } else {
    const er = exportRec as Record<string, unknown>;
    if (typeof er.tileSize !== 'number') issues.push({ field: 'exportRecommendation.tileSize', message: 'Must be a number.' });
    if (typeof er.patternScale !== 'number') issues.push({ field: 'exportRecommendation.patternScale', message: 'Must be a number.' });
    if (!Array.isArray(er.recommendedSites) || er.recommendedSites.length === 0) {
      issues.push({ field: 'exportRecommendation.recommendedSites', message: 'Must be a non-empty array.' });
    }
  }

  return { valid: issues.length === 0, issues };
}
