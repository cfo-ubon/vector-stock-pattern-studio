// Asset Ecosystem Engine (Phase 9) — top-level barrel, the one import
// surface other modules/UI consume instead of reaching into each
// assets/* file directly. Every export is a real re-export from an
// already-real submodule (see each file's own header comment).

export * as Types from './types';
export * as Extraction from './extraction';
export * as Decomposition from './decomposition';
export * as Relationships from './relationships';
export * as Variants from './variants';
export * as Search from './search';
export * as Recommendation from './recommendation';
export * as QualityScore from './qualityScore';
export * as Library from './library';
export * as Validation from './validation';
