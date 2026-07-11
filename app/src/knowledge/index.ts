// Design Knowledge Engine (Phase 6.5) — top-level barrel. This is the one
// import surface the brief's "every engine must consume knowledge from
// DKE" success criterion is about: `import { ... } from '../knowledge'`
// instead of reaching into `services/*`, `style-dna/*`, `motif-grammar/*`,
// etc. directly. Every named export below is a real re-export of an
// already-real module (see each subfolder's own header comment for what
// it wraps and why) — this file adds no logic of its own.

export * as StyleKnowledge from './style';
export * as MotifKnowledge from './motif';
export * as PaletteKnowledge from './palette';
export * as CompositionKnowledge from './composition';
export * as PatternKnowledge from './pattern';
export * as CollectionKnowledge from './collection';
export * as MarketplaceKnowledge from './marketplace';
export * as RuleKnowledge from './rules';
export * as RecommendationEngine from './recommendation';
export * as LearningHistory from './history';
export * as KnowledgeValidation from './validation';
