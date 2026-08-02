import { computeConfidence } from '../decisionOS/confidenceEngine';
import type { EvidenceBundle, EvidenceRecord, BusinessImpact, ConfidenceResult, ConfidenceBand } from '../decisionOS/domain/types';

// Mission 3, Part 3 — Expected Impact Engine. Qualitative only, reusing
// Decision OS's own `BusinessImpact` enum ('VERY_HIGH'/'HIGH'/'MEDIUM'/
// '/LOW'/'UNKNOWN' — exactly the spec's "Allowed" list) and its real
// Confidence Engine (`computeConfidence`, Build 031B Part 3) rather than
// inventing a second confidence model. Never estimates revenue: the
// output is always one of the 5 named qualitative levels plus a real
// explanation of which real evidence produced it.

export interface ImpactAssessment {
  expectedImpact: BusinessImpact;
  confidence: ConfidenceResult;
}

function buildEvidenceBundle(evidence: string[], now: number): EvidenceBundle {
  const records: EvidenceRecord[] = evidence.map((label, i) => ({
    id: `factory-improvement-evidence-${i}`,
    source: 'pipeline',
    label,
    timestamp: now,
    freshness: 'LIVE',
    completeness: 1,
    confidenceImpact: 1,
    missingData: [],
    value: label,
  }));
  return { gatheredAt: now, records };
}

/** Disclosed policy table combining the source module's own raw
 * `businessImpact` (from `BottleneckReport`/Root Cause, real & structural)
 * with the evidence's Confidence Engine band — a well-evidenced HIGH
 * finding is graded up to VERY_HIGH; a sparsely-evidenced one is graded
 * down. This never invents a number: both inputs are already real. */
function mapImpact(businessImpact: BusinessImpact, band: ConfidenceBand): BusinessImpact {
  if (band === 'unknown') return 'UNKNOWN';
  if (businessImpact === 'VERY_HIGH') return band === 'high' ? 'VERY_HIGH' : 'HIGH';
  if (businessImpact === 'HIGH') return band === 'high' ? 'VERY_HIGH' : 'HIGH';
  if (businessImpact === 'MEDIUM') return band === 'high' ? 'HIGH' : band === 'medium' ? 'MEDIUM' : 'LOW';
  if (businessImpact === 'LOW') return band === 'high' ? 'MEDIUM' : 'LOW';
  return 'UNKNOWN';
}

export function assessExpectedImpact(evidence: string[], businessImpact: BusinessImpact | null, now: number = Date.now()): ImpactAssessment {
  const bundle = buildEvidenceBundle(evidence, now);
  const confidence = computeConfidence(bundle, []);
  if (businessImpact === null || businessImpact === 'UNKNOWN' || confidence.band === 'unknown') {
    return { expectedImpact: 'UNKNOWN', confidence };
  }
  return { expectedImpact: mapImpact(businessImpact, confidence.band), confidence };
}
