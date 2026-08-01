// Build 031B — Decision OS ("the Business Brain"). This file is the one
// shared vocabulary every policy/evidence provider/decision consumer in
// the app imports — mirrors this repo's own convention of one small
// `domain/types.ts` per subsystem (`aiCeo/domain/types.ts`,
// `commercial/domain/types.ts`) rather than scattering these shapes
// across call sites.
//
// The whole point of this module: every business decision anywhere in the
// app must be expressible as Policy + Evidence -> Confidence -> Decision.
// Nothing here fabricates a number — `EvidenceRecord.completeness` and
// `ConfidenceResult.score` are always derived from real, inspectable
// inputs (see `confidenceEngine.ts`), and `BusinessImpact` is a fixed
// qualitative enum, never a revenue estimate, per the spec's explicit
// "never estimate revenue" rule.

/** The 6 domains Part 7 of the spec scopes an initial policy set to.
 * Every `PolicyDefinition` declares exactly one; the Decision Engine only
 * ever evaluates policies within the domain a caller asks about. */
export const POLICY_DOMAINS = ['factory', 'portfolio', 'marketplace', 'collection', 'qa', 'commercial'] as const;
export type PolicyDomain = (typeof POLICY_DOMAINS)[number];

export const POLICY_STATUS_VALUES = ['ENABLED', 'DISABLED'] as const;
export type PolicyStatus = (typeof POLICY_STATUS_VALUES)[number];

/** A user-configurable override of a policy's default status/priority —
 * kept as a separate, small record (never mutating `PolicyDefinition`
 * itself, which is code-defined and immutable at runtime) so "Policy
 * Management" (Part 9) is a real, persisted, backend-only capability
 * without needing to rewrite policy source files. `null` on either field
 * means "use the policy's own default" — an override row does not have to
 * override both. */
export interface PolicyOverride {
  /** Equal to `policyId` — kept as its own field only so this record
   * satisfies the same `{id: string}` shape every other generic store in
   * this app (`aiCeo/storage/genericStore.ts`) already keys on, rather
   * than inventing a second CRUD helper for one store. */
  id: string;
  policyId: string;
  status: PolicyStatus | null;
  priority: number | null;
  updatedAt: number;
}

/** The 9 evidence domains Part 2 of the spec names. Every
 * `EvidenceProvider` is registered under exactly one of these. */
export const EVIDENCE_SOURCE_KINDS = ['portfolio', 'collection', 'qa', 'commercial', 'marketplace', 'businessGoals', 'mission', 'pipeline', 'export'] as const;
export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number];

/** How old/reliable an individual piece of evidence is, computed from its
 * own `timestamp` relative to "now" by `evidenceEngine.ts` — never
 * asserted by the provider itself, so two providers can't disagree on what
 * "fresh" means. `UNKNOWN` is a real, displayable value (no timestamp
 * exists to judge freshness from at all), matching this codebase's
 * existing "unknown is a real value, not an absence of one" convention
 * (`marketing/domain/evidence.ts`'s `EvidenceBand`). */
export const EVIDENCE_FRESHNESS_VALUES = ['LIVE', 'RECENT', 'STALE', 'UNKNOWN'] as const;
export type EvidenceFreshness = (typeof EVIDENCE_FRESHNESS_VALUES)[number];

/** One real, inspectable fact a policy can reason about. `value` is
 * intentionally `unknown` — each evidence provider documents its own
 * payload shape; policies that consume a given evidence `id` know what to
 * expect, matching the "typed per producer/consumer pair" pattern already
 * used by `catalog/dashboard/recommendationEngine.ts`'s
 * `Recommendation.code`. */
export interface EvidenceRecord {
  /** Stable, human-readable, e.g. "portfolio:categoryCounts" — never a
   * random ID, so the same real fact always reports under the same
   * `evidenceIds` entry in a `Decision`, making decisions comparable. */
  id: string;
  source: EvidenceSourceKind;
  label: string;
  timestamp: number;
  freshness: EvidenceFreshness;
  /** 0-1 — how much of the "shape" this evidence record is supposed to
   * carry is actually present (e.g. 1.0 for a fully-populated readiness
   * report, 0 for "no data exists yet"). Never fabricated: a provider that
   * has nothing real to report returns `completeness: 0`, not a guessed
   * mid-value. */
  completeness: number;
  /** 0-1 — how much this record, when complete and fresh, is allowed to
   * raise overall decision confidence. A provider that only ever supplies
   * a minor supporting fact declares a low `confidenceImpact`; the
   * Confidence Engine (Part 3) is the only place these get summed. */
  confidenceImpact: number;
  /** Named fields this record is missing (e.g. `['qualitySnapshot']`) —
   * always populated when `completeness < 1`, never left implicit. */
  missingData: string[];
  value: unknown;
}

export interface EvidenceBundle {
  gatheredAt: number;
  records: EvidenceRecord[];
}

/** One policy's real, explainable opinion about the current
 * evidence/context — never a bare boolean. `applies: false` means the
 * policy had nothing to say (e.g. "Repair before Generate" when nothing
 * needs repair); `applies: true` always comes with a non-empty `detail`. */
export interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  domain: PolicyDomain;
  applies: boolean;
  /** A candidate recommended action this policy is suggesting, or `null`
   * if this policy only warns/blocks without proposing one. */
  action: string | null;
  /** Non-null only when this policy is refusing `context.requestedAction`
   * outright (e.g. "readiness 42% is below the 95% threshold"). */
  blockedReason: string | null;
  /** Non-null for a non-blocking caution the Decision still surfaces. */
  warning: string | null;
  detail: string;
  evidenceIds: string[];
}

/** Every field here is genuinely data — a `PolicyDefinition` is
 * serializable except for its one function, `evaluate`, which is the
 * policy's actual (typed, testable, centralized) business rule. This is
 * the spec's own "policies must be data driven, no hardcoded business
 * decisions inside UI" requirement: the UI never encodes "if X then Y" —
 * it calls the Decision Engine, which evaluates policies like this one. */
export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  domain: PolicyDomain;
  version: number;
  /** Lower runs first / wins ties among multiple applicable
   * recommendations — mirrors this codebase's existing
   * "FUNDAMENTAL_BLOCKERS run first" convention
   * (`commercial/readinessEngine.ts`). */
  defaultPriority: number;
  defaultStatus: PolicyStatus;
  requiredEvidence: EvidenceSourceKind[];
  expectedOutcome: string;
  /** The qualitative Business Impact (Part 5) this policy's action
   * represents when it fires with full confidence — downgraded by the
   * Decision Engine when actual confidence is lower (Part 3/5's "never
   * fabricate confidence" applies to impact too: an uncertain decision
   * cannot honestly claim "Very High" impact). */
  impactWhenApplies: BusinessImpact;
  examples: string[];
  evaluate: (evidence: EvidenceBundle, context: DecisionRequestContext) => PolicyEvaluation;
}

/** What a caller asks the Decision Engine to resolve. `data` is the
 * module-specific payload (already-loaded records the caller reuses from
 * its own existing loaders — see each `adapters/*.ts` file) that evidence
 * providers and policies read; the Decision Engine and its policies never
 * reach into IndexedDB themselves. */
export interface DecisionRequestContext {
  domain: PolicyDomain;
  /** The action being considered, if the caller has one in mind (e.g.
   * `'export'`) — policies that only ever warn/recommend (never block) can
   * safely ignore this and leave it `null`. */
  requestedAction: string | null;
  now: number;
  data: Record<string, unknown>;
  /** Explicit, caller-supplied acknowledgement that a BLOCKED decision
   * should be allowed to proceed anyway — mirrors
   * `commercial/safetyThreshold.ts`'s own `allowOverride` parameter. Never
   * set implicitly; the Decision Engine never treats "no evidence" as
   * consent to override. */
  allowOverride?: boolean;
}

export const BUSINESS_IMPACT_VALUES = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
export type BusinessImpact = (typeof BUSINESS_IMPACT_VALUES)[number];

export const CONFIDENCE_BAND_VALUES = ['high', 'medium', 'low', 'unknown'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BAND_VALUES)[number];

/** Every number here is derived, never asserted — `factors` exists so
 * `explanation` (Part 6) can point at exactly which input moved the score,
 * satisfying the spec's "explain calculation" requirement without the
 * caller needing to re-derive it. */
export interface ConfidenceResult {
  score: number;
  band: ConfidenceBand;
  explanation: string[];
  factors: {
    evidenceCompleteness: number;
    policyCoverage: number;
    missingInfoPenalty: number;
    conflictPenalty: number;
    unknownPenalty: number;
  };
}

/** The one shared output shape every AI module in the app now produces
 * its core recommendation through (Part 4). Every field is either a real
 * value or an honest empty/`null`/`'UNKNOWN'` — never fabricated. */
export interface Decision {
  id: string;
  domain: PolicyDomain;
  requestedAction: string | null;
  recommendedAction: string | null;
  businessImpact: BusinessImpact;
  businessImpactReasons: string[];
  alternative: { action: string; reason: string } | null;
  blockedReasons: string[];
  warnings: string[];
  policyIds: string[];
  evidenceIds: string[];
  confidence: ConfidenceResult;
  explanation: string[];
  createdAt: number;
}

/** Part 8 — the audit history row for one `Decision`. Deliberately a flat
 * copy of `Decision`'s own fields (not a foreign-key reference into a
 * separate policy/evidence table) so the timeline stays readable and
 * restorable years after the policies that produced it may have changed —
 * this is NOT learning (the spec is explicit: "no learning logic in this
 * build"), it is an immutable audit record. */
export interface DecisionTimelineEntry {
  id: string;
  decisionId: string;
  domain: PolicyDomain;
  requestedAction: string | null;
  recommendedAction: string | null;
  businessImpact: BusinessImpact;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  policyIds: string[];
  evidenceIds: string[];
  blockedReasons: string[];
  warnings: string[];
  explanation: string[];
  createdAt: number;
}

export function isValidPolicyDomain(value: unknown): value is PolicyDomain {
  return typeof value === 'string' && (POLICY_DOMAINS as readonly string[]).includes(value);
}

export function isValidDecisionTimelineEntry(value: unknown): value is DecisionTimelineEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.decisionId === 'string' && isValidPolicyDomain(v.domain) && typeof v.createdAt === 'number' && Array.isArray(v.policyIds) && Array.isArray(v.evidenceIds);
}

export function isValidPolicyOverride(value: unknown): value is PolicyOverride {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.policyId === 'string' && typeof v.updatedAt === 'number';
}
