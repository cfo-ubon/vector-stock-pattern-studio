import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Marketplace evidence provider. Reads
// `context.data.marketplace`, supplied by the adapter from
// `metadata/marketplaceProfiles.ts`'s real, already-loaded profile
// records — never a second marketplace registry.

export interface MarketplaceEvidenceInput {
  profile: { marketplaceId: string; future: boolean; contributorUrlVerified: boolean } | null;
  timestamp: number;
}

export function marketplaceEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.marketplace as MarketplaceEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'marketplace:profileVerification',
      source: 'marketplace',
      label: 'Marketplace profile verification status',
      timestamp: input.timestamp,
      freshness,
      completeness: input.profile ? 1 : 0,
      confidenceImpact: 0.4,
      missingData: input.profile ? [] : ['marketplaceProfile'],
      value: input.profile,
    },
  ];
}
