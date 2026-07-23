// Build 026 — Commercial Intelligence public barrel, mirroring the
// convention established by `catalog/submission/index.ts` and other
// large feature modules in this repo.

export type {
  CommercialConfidenceLevel,
  CommercialDimension,
  DimensionRejectionBreakdown,
  CommercialDimensionOutcome,
  CommercialFeedbackReport,
  GenerateCommercialFeedbackInput,
} from './commercialFeedbackEngine';
export {
  MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE,
  MIN_SAMPLE_SIZE_HIGH_CONFIDENCE,
  COMMERCIAL_FEEDBACK_DIMENSIONS,
  generateCommercialFeedback,
} from './commercialFeedbackEngine';

export type { ProductionRecommendation, ProductionRecommendationInput, ProductionRecommendationReport } from './productionRecommendations';
export { DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET, generateProductionRecommendations } from './productionRecommendations';
