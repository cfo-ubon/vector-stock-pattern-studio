// Build 028 — Marketing Intelligence facade, following this barrel's
// existing pattern (see `../style`, `../marketplace`, etc.): a thin,
// stable re-export surface over the real logic in `app/src/marketing/`,
// no logic of its own. Consumers of the knowledge layer (the AI Design
// Director, future recommendation wiring) import from here rather than
// reaching into `marketing/*` directly.

export {
  createResearchSource,
  isValidResearchSourceType,
  RESEARCH_SOURCE_TYPES,
  type ResearchSource,
  type ResearchSourceType,
} from '../../marketing/domain/researchSource';

export {
  createMarketObservation,
  isValidTrendDirection,
  isValidBuyerIntent,
  TREND_DIRECTIONS,
  BUYER_INTENT_VALUES,
  type MarketObservation,
  type TrendDirection,
  type BuyerIntent,
} from '../../marketing/domain/marketObservation';

export {
  createMarketSnapshot,
  duplicateMarketSnapshot,
  describeSnapshotFreshness,
  type MarketSnapshot,
} from '../../marketing/domain/marketSnapshot';

export { EVIDENCE_STATUS_VALUES, EVIDENCE_BAND_VALUES, type EvidenceStatus, type EvidenceBand } from '../../marketing/domain/evidence';

export {
  saveSnapshot,
  duplicateSnapshot,
  archiveSnapshot,
  compareSnapshots,
  exportSnapshotAsJson,
  importSnapshotFromJson,
  getMostRecentSnapshotForOfflineUse,
} from '../../marketing/snapshot/snapshotService';
