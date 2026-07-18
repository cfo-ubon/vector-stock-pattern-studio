// Sprint P1, Section 6 (JSON Compatibility). This app already produces
// several genuinely different JSON shapes a user might re-import as a
// catalog source file: a raw `GenerateParams` settings object, a Project
// export (`{ schemaVersion, exportedAt, project }`, `project/projectJson.ts`),
// and a stock-submission `metadata.json`
// (`{ marketplace, seed, category, palette, title, ... }`,
// `metadata/exportPackage.ts`). Rather than hard-coding one schema, this
// module tolerantly probes a parsed JSON value for whichever of these
// shapes (or a subset of their fields) is actually present, extracts what
// it can, and never throws — an unrecognized shape still gets the asset
// created with the raw JSON retained as its `metadataReference` source
// file, just without derived metadata fields.

export interface ParsedPatternMetadata {
  detectedShape: 'generateParams' | 'projectExport' | 'submissionMetadata' | 'unknown';
  seed: string | null;
  styleDna: string | null;
  patternType: string | null;
  compositionType: string | null;
  productTargets: string[];
  colorPalette: string[];
  createdAt: number | null;
}

function emptyResult(): ParsedPatternMetadata {
  return {
    detectedShape: 'unknown',
    seed: null,
    styleDna: null,
    patternType: null,
    compositionType: null,
    productTargets: [],
    colorPalette: [],
    createdAt: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Pulls the same handful of fields out of a raw `GenerateParams`-shaped
 * object regardless of which wrapper (if any) it's nested inside — a
 * top-level settings export, `project.collections[0].collection.patternParams[0]`,
 * or a submission `metadata.json`'s flatter field names. */
function extractFromParamsLike(params: Record<string, unknown>): Partial<ParsedPatternMetadata> {
  return {
    seed: asString(params.seed),
    styleDna: asString(params.styleDnaId) ?? asString(params.styleDna),
    patternType: asString(params.categoryId) ?? asString(params.category) ?? asString(params.patternType),
    compositionType: asString(params.layoutId) ?? asString(params.compositionType),
    productTargets: (() => {
      const single = asString(params.productTarget);
      if (single) return [single];
      return asStringArray(params.productTargets);
    })(),
    colorPalette: asStringArray(params.customColors),
  };
}

/** Tolerant parse: never throws. Returns `detectedShape: 'unknown'` (with
 * every other field `null`/empty) for JSON that doesn't match any known
 * shape — this is a normal, non-error outcome, not a parse failure. */
export function parsePatternJson(raw: unknown): ParsedPatternMetadata {
  const result = emptyResult();
  if (!isRecord(raw)) return result;

  // Project export: `{ schemaVersion, exportedAt, project: { collections: [{ collection: { patternParams: [...] } }] } }`.
  if (isRecord(raw.project) && Array.isArray((raw.project as Record<string, unknown>).collections)) {
    result.detectedShape = 'projectExport';
    result.createdAt = typeof raw.exportedAt === 'number' ? raw.exportedAt : null;
    const collections = (raw.project as Record<string, unknown>).collections as unknown[];
    const firstCollection = collections.find(isRecord);
    const collection = firstCollection && isRecord(firstCollection.collection) ? firstCollection.collection : null;
    const patternParams = collection && Array.isArray(collection.patternParams) ? collection.patternParams : [];
    const firstParams = (patternParams as unknown[]).find(isRecord);
    if (firstParams) Object.assign(result, extractFromParamsLike(firstParams));
    return result;
  }

  // Stock-submission metadata.json: `{ marketplace, seed, category, palette, title, ... }`.
  if (typeof raw.marketplace === 'string' && ('seed' in raw || 'category' in raw)) {
    result.detectedShape = 'submissionMetadata';
    result.seed = asString(raw.seed);
    result.patternType = asString(raw.category) ?? asString(raw.defaultCategory);
    result.colorPalette = asStringArray(raw.palette);
    result.createdAt = typeof raw.generatedAt === 'number' ? raw.generatedAt : null;
    return result;
  }

  // Raw GenerateParams (or close enough — has at least a seed or a
  // categoryId/layoutId pair, the fields every real settings export has).
  if (typeof raw.seed === 'string' || (typeof raw.categoryId === 'string' && typeof raw.layoutId === 'string')) {
    result.detectedShape = 'generateParams';
    Object.assign(result, extractFromParamsLike(raw));
    return result;
  }

  return result;
}

export interface JsonParseOutcome {
  ok: boolean;
  value: unknown;
  metadata: ParsedPatternMetadata;
  error: string | null;
}

/** Parses raw JSON text, never throwing — a syntax error becomes
 * `{ ok: false, error: <message> }` so the import pipeline can surface a
 * useful message and keep going with the rest of the batch (Section 6:
 * "do not crash... allow importing the remaining valid files"). */
export function parseJsonText(text: string): JsonParseOutcome {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value, metadata: parsePatternJson(value), error: null };
  } catch (e) {
    return { ok: false, value: null, metadata: emptyResult(), error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}
