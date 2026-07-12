// Design Critic & Art Direction Engine (Phase 7) — top-level barrel, the
// one import surface other modules/UI consume instead of reaching into
// each critic/* file directly. Every export is a real re-export from an
// already-real submodule (see each file's own header comment).

export * as DesignCritique from './designCritique';
export * as VisualAnalysis from './visualAnalysis';
export * as Problems from './problems';
export * as ArtDirection from './artDirection';
export * as StyleCoach from './styleCoach';
export * as CollectionCritic from './collectionCritic';
export * as DesignReport from './designReport';
export * as ImprovementLoop from './improvementLoop';
export * as QualityGate from './qualityGate';
