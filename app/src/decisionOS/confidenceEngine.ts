import type { ConfidenceResult, EvidenceBundle, PolicyEvaluation } from './domain/types';

// Build 031B, Part 3 — Confidence Engine. Every number below is derived
// from real inputs already present on `EvidenceBundle`/`PolicyEvaluation`
// — nothing here is a fabricated "AI feels 87% sure" number. Zero
// evidence always produces zero confidence; this function never
// substitutes a mid-range guess when it genuinely does not know.

function bandFor(score: number, hasAnyEvidence: boolean): ConfidenceResult['band'] {
  if (!hasAnyEvidence) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/** Average `completeness` across gathered evidence, weighted by each
 * record's own `confidenceImpact` — a record declaring low impact can't
 * single-handedly drag the score down or up. */
function evidenceCompletenessScore(evidence: EvidenceBundle): number {
  if (evidence.records.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of evidence.records) {
    const weight = Math.max(r.confidenceImpact, 0.01);
    weightedSum += r.completeness * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/** What fraction of the policies that actually `applies: true` had every
 * evidence source their `PolicyDefinition.requiredEvidence` asked for
 * actually present in the gathered bundle — a policy firing on partial
 * evidence should not be treated the same as one that had everything it
 * asked for. */
function policyCoverageScore(evaluations: PolicyEvaluation[], evidence: EvidenceBundle): number {
  const applying = evaluations.filter((e) => e.applies);
  if (applying.length === 0) return 0;
  const evidenceIds = new Set(evidence.records.map((r) => r.id));
  let covered = 0;
  for (const e of applying) {
    if (e.evidenceIds.length === 0) continue; // a policy with no evidence dependency is trivially "covered"
    if (e.evidenceIds.every((id) => evidenceIds.has(id))) covered += 1;
  }
  return covered / applying.length;
}

export function computeConfidence(evidence: EvidenceBundle, policyEvaluations: PolicyEvaluation[]): ConfidenceResult {
  const explanation: string[] = [];
  const hasAnyEvidence = evidence.records.length > 0;

  if (!hasAnyEvidence) {
    explanation.push('No evidence was gathered — confidence cannot be computed.');
    return { score: 0, band: 'unknown', explanation, factors: { evidenceCompleteness: 0, policyCoverage: 0, missingInfoPenalty: 0, conflictPenalty: 0, unknownPenalty: 0 } };
  }

  const evidenceCompleteness = evidenceCompletenessScore(evidence);
  explanation.push(`Evidence completeness: ${Math.round(evidenceCompleteness * 100)}% (weighted average across ${evidence.records.length} record(s)).`);

  const policyCoverage = policyCoverageScore(policyEvaluations, evidence);
  const applyingCount = policyEvaluations.filter((e) => e.applies).length;
  if (applyingCount > 0) explanation.push(`Policy coverage: ${Math.round(policyCoverage * 100)}% of ${applyingCount} applicable polic${applyingCount === 1 ? 'y' : 'ies'} had every required evidence source present.`);
  else explanation.push('No policy applied to this evidence.');

  const missingCount = evidence.records.reduce((sum, r) => sum + r.missingData.length, 0);
  const missingInfoPenalty = Math.min(missingCount * 0.05, 0.4);
  if (missingCount > 0) explanation.push(`${missingCount} named missing-data field(s) across evidence reduce confidence.`);

  const distinctCandidateActions = new Set(policyEvaluations.filter((e) => e.applies && e.action !== null).map((e) => e.action));
  const conflictPenalty = distinctCandidateActions.size > 1 ? 0.15 : 0;
  if (conflictPenalty > 0) explanation.push(`${distinctCandidateActions.size} policies suggested different actions — treated as a mild conflict.`);

  const unknownCount = evidence.records.filter((r) => r.freshness === 'UNKNOWN').length;
  const unknownPenalty = Math.min(unknownCount * 0.05, 0.3);
  if (unknownCount > 0) explanation.push(`${unknownCount} evidence record(s) have unknown freshness.`);

  const raw = evidenceCompleteness * 0.5 + policyCoverage * 0.3 - missingInfoPenalty - conflictPenalty - unknownPenalty + 0.2;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  return {
    score,
    band: bandFor(score, hasAnyEvidence),
    explanation,
    factors: { evidenceCompleteness, policyCoverage, missingInfoPenalty, conflictPenalty, unknownPenalty },
  };
}
