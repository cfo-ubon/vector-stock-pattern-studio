import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';
import type { EvidenceSelection } from '../../autopilot/decisionEngine';

// Build 031B, Part 10 — Marketplace adapter. Turns
// `autopilot/decisionEngine.ts`'s already-computed `EvidenceSelection`
// (Build 029) plus a simple Portfolio-has-assets flag into the
// `DecisionRequestContext.data` shape `missionEvidenceProvider`/
// `portfolioEvidenceProvider` expect — never recomputes "is there live
// evidence" itself, only reshapes what `aiCeo/decisionEngine.ts` already
// has in hand from its own `selectEvidence` call.

export const MARKETPLACE_FALLBACK_SOURCES: EvidenceSourceKind[] = ['mission', 'portfolio'];

export function marketplaceFallbackContext(evidence: EvidenceSelection, hasLiveEvidence: boolean, portfolioAssetCount: number, now: number): DecisionRequestContext {
  return {
    domain: 'marketplace',
    requestedAction: null,
    now,
    data: {
      mission: { hasLiveEvidence, note: evidence.note, confidenceBand: evidence.confidence, timestamp: now },
      portfolio: { totalAssets: portfolioAssetCount, categoryConcentration: null, leastCoveredCategory: null, oversupplyShare: 0.4, timestamp: now },
    },
  };
}
