import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Commercial evidence provider. Reads
// `context.data.commercial`, supplied by the adapter from Build 031A's
// already-computed `CommercialReadinessReport`
// (`commercial/readinessEngine.ts`) and `commercialPackageHistoryStore.ts`
// — never a second readiness computation.

export interface CommercialEvidenceInput {
  readiness: { assetId: string; score: number; threshold: number } | null;
  hasSeo: boolean | null;
  recentPackage: { found: boolean; builtAt: number | null; cooldownMs: number } | null;
  timestamp: number;
}

export function commercialEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.commercial as CommercialEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'commercial:readiness',
      source: 'commercial',
      label: 'Commercial Readiness score',
      timestamp: input.timestamp,
      freshness,
      completeness: input.readiness ? 1 : 0,
      confidenceImpact: 0.7,
      missingData: input.readiness ? [] : ['readinessReport'],
      value: input.readiness,
    },
    {
      id: 'commercial:seoStatus',
      source: 'commercial',
      label: 'SEO metadata present',
      timestamp: input.timestamp,
      freshness,
      completeness: input.hasSeo === null ? 0 : 1,
      confidenceImpact: 0.3,
      missingData: input.hasSeo === null ? ['submission'] : [],
      value: { hasSeo: input.hasSeo },
    },
    {
      id: 'commercial:recentPackage',
      source: 'commercial',
      label: 'Recently built commercial package for this target',
      timestamp: input.timestamp,
      freshness,
      completeness: input.recentPackage ? 1 : 0,
      confidenceImpact: 0.4,
      missingData: input.recentPackage ? [] : ['packageHistory'],
      value: input.recentPackage,
    },
  ];
}
