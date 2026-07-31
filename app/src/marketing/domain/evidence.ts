// Build 028 — the one evidence-provenance enum shared by every Marketing
// Intelligence record that feeds a recommendation. This is deliberately its
// own tiny module (not inlined per-record) so `marketObservation.ts`,
// `marketKeyword.ts`, `marketOpportunity.ts`, and the AI Design Director's
// `designBrief.ts` field-rationale entries all reference the exact same
// type — the non-negotiable rule (see BUILD_028_AUDIT.md Section 4) is that
// nothing in this build may silently default an unknown source to
// `VERIFIED_SOURCE`; `SAMPLE_DATA` and `AI_INFERENCE` are real, equally
// first-class members precisely so the UI can render a visible, honest
// badge instead of quietly presenting inferred or demo data as researched
// fact.

export const EVIDENCE_STATUS_VALUES = [
  'VERIFIED_SOURCE',
  'USER_IMPORTED',
  'USER_OBSERVATION',
  'LOCAL_SALES_DATA',
  'LOCAL_PORTFOLIO_DATA',
  'AI_INFERENCE',
  'SAMPLE_DATA',
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUS_VALUES)[number];

export function isValidEvidenceStatus(value: unknown): value is EvidenceStatus {
  return typeof value === 'string' && (EVIDENCE_STATUS_VALUES as readonly string[]).includes(value);
}

/** Qualitative demand/competition/opportunity bands — used everywhere a
 * numeric estimate would imply false precision this build has no real data
 * source for (see the task's own "do not invent search volume numbers"
 * rule). `UNKNOWN` is a real, displayable value, not an absence of a field. */
export const EVIDENCE_BAND_VALUES = ['very-low', 'low', 'medium', 'high', 'very-high', 'unknown'] as const;

export type EvidenceBand = (typeof EVIDENCE_BAND_VALUES)[number];

export function isValidEvidenceBand(value: unknown): value is EvidenceBand {
  return typeof value === 'string' && (EVIDENCE_BAND_VALUES as readonly string[]).includes(value);
}
