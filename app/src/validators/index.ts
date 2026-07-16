import designSpecificationSchema from '../schemas/designSpecification.schema.json';
import trendPackSchema from '../schemas/trendPack.schema.json';
import marketplaceProfileSchema from '../schemas/marketplaceProfile.schema.json';
import keywordBundleSchema from '../schemas/keywordBundle.schema.json';
import styleDnaSchema from '../schemas/styleDna.schema.json';
import patternGrammarSchema from '../schemas/patternGrammar.schema.json';
import motifGrammarSchema from '../schemas/motifGrammar.schema.json';
import colorRoleSystemSchema from '../schemas/colorRoleSystem.schema.json';
import paletteSchema from '../schemas/palette.schema.json';
import qualityTargetSchema from '../schemas/qualityTarget.schema.json';
import rejectRulesSchema from '../schemas/rejectRules.schema.json';
import learningHistorySchema from '../schemas/learningHistory.schema.json';
import assetSchema from '../schemas/asset.schema.json';

import { validateAgainstSchema, type JsonSchema, type SchemaRegistry, type ValidationIssue } from './jsonSchemaValidator';

// Schema registry (Design Intelligence Core Phase 1, deliverable 10) — every
// schema in /schemas keyed by its own `$id`, so any schema's `$ref` can
// resolve another schema file by name (e.g. designSpecification.schema.json's
// `"$ref": "keywordBundle.schema.json"`). Built once here; every per-domain
// validator below reuses this same registry.
export const SCHEMA_REGISTRY: SchemaRegistry = {
  'designSpecification.schema.json': designSpecificationSchema as JsonSchema,
  'trendPack.schema.json': trendPackSchema as JsonSchema,
  'marketplaceProfile.schema.json': marketplaceProfileSchema as JsonSchema,
  'keywordBundle.schema.json': keywordBundleSchema as JsonSchema,
  'styleDna.schema.json': styleDnaSchema as JsonSchema,
  'patternGrammar.schema.json': patternGrammarSchema as JsonSchema,
  'motifGrammar.schema.json': motifGrammarSchema as JsonSchema,
  'colorRoleSystem.schema.json': colorRoleSystemSchema as JsonSchema,
  'palette.schema.json': paletteSchema as JsonSchema,
  'qualityTarget.schema.json': qualityTargetSchema as JsonSchema,
  'rejectRules.schema.json': rejectRulesSchema as JsonSchema,
  'learningHistory.schema.json': learningHistorySchema as JsonSchema,
  'asset.schema.json': assetSchema as JsonSchema,
};

function makeValidator(schemaId: string) {
  const schema = SCHEMA_REGISTRY[schemaId];
  return (data: unknown): ValidationIssue[] => validateAgainstSchema(data, schema, SCHEMA_REGISTRY);
}

export const validateDesignSpecificationData = makeValidator('designSpecification.schema.json');
export const validateTrendPackData = makeValidator('trendPack.schema.json');
export const validateMarketplaceProfileData = makeValidator('marketplaceProfile.schema.json');
export const validateKeywordBundleData = makeValidator('keywordBundle.schema.json');
export const validateStyleDnaData = makeValidator('styleDna.schema.json');
export const validatePatternGrammarData = makeValidator('patternGrammar.schema.json');
export const validateMotifGrammarData = makeValidator('motifGrammar.schema.json');
export const validateColorRoleSystemData = makeValidator('colorRoleSystem.schema.json');
export const validatePaletteData = makeValidator('palette.schema.json');
export const validateQualityTargetData = makeValidator('qualityTarget.schema.json');
export const validateRejectRulesData = makeValidator('rejectRules.schema.json');
export const validateLearningHistoryData = makeValidator('learningHistory.schema.json');
export const validateAssetData = makeValidator('asset.schema.json');

export type { JsonSchema, SchemaRegistry, ValidationIssue } from './jsonSchemaValidator';
export { validateAgainstSchema, isValid } from './jsonSchemaValidator';
