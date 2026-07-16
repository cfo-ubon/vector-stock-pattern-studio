// Build 008A — Knowledge Registry barrel. Import from here
// (`'../knowledge/registry'`), not from the individual module files.
export { KnowledgeRegistry, KnowledgeValidationError, type KnowledgeDiagnostics, type KnowledgeSchemaVersion } from './knowledgeRegistry';
export { STYLE_SCHEMA_VERSION, STYLE_SCHEMA_FIELD_CATEGORIES, validateStyleRecord, type StyleValidationIssue, type StyleValidationResult } from './styleSchema';
export { loadStyleRecords, formatStyleLoadIssues, type StyleLoadIssue, type StyleLoadResult } from './styleLoader';
export { STYLE_RAW_RECORDS } from './styleData';
