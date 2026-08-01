import type { EvidenceBand } from '../../marketing/domain/evidence';
import type { AutopilotMode } from '../../autopilot/domain/autopilotMode';
import type { AutopilotProductionGoal } from '../../autopilot/collectionRolePlanner';

// Build 030 Part 2 — "AI Starts the Conversation" domain model. Every type
// below is deliberately business-language and evidence-carrying: nothing
// here has a field for a fabricated number (revenue, sales, downloads).
// Where a number cannot be honestly known it is represented as `null`,
// never as `0` or a guessed default — every consumer must render an
// honest label ("Unknown" / "Not enough data" / ...) for a `null`.

/** Module 13's five offline/data-status labels — reused across the Morning
 * Brief, Decision Engine, and every panel's "how sure is this?" footer, so
 * the whole surface uses one shared vocabulary rather than each module
 * inventing its own freshness wording. */
export const AI_CEO_DATA_STATUS_VALUES = ['LIVE_DATA', 'SAVED_SNAPSHOT', 'LOCAL_PORTFOLIO_ANALYSIS', 'OFFLINE_RECOMMENDATION', 'INSUFFICIENT_DATA'] as const;
export type AiCeoDataStatus = (typeof AI_CEO_DATA_STATUS_VALUES)[number];

export function isValidAiCeoDataStatus(value: unknown): value is AiCeoDataStatus {
  return typeof value === 'string' && (AI_CEO_DATA_STATUS_VALUES as readonly string[]).includes(value);
}

/** The 11 action families from the spec's Decision Engine section, plus
 * `CONTINUE_INTERRUPTED_RUN` for Module 11 ("Continue Yesterday"). Each one
 * maps either to a real Autopilot hand-off (`AiCeoAutopilotHandoff`) or to
 * a real navigation/UI action — never a stub. */
export const AI_CEO_ACTION_VALUES = [
  'CREATE_NEW_COLLECTION',
  'EXPAND_EXISTING_COLLECTION',
  'CREATE_MISSING_COORDINATE_PATTERNS',
  'CREATE_NEW_COLORWAYS',
  'REVIEW_REJECTED_ITEMS',
  'COMPLETE_SEO',
  'MOVE_READY_TO_PORTFOLIO',
  'PREPARE_FOR_SUBMISSION',
  'PAUSE_SATURATED_CATEGORY',
  'DIVERSIFY_PORTFOLIO',
  'USE_EVERGREEN_FALLBACK',
  'CONTINUE_INTERRUPTED_RUN',
] as const;
export type AiCeoActionType = (typeof AI_CEO_ACTION_VALUES)[number];

export function isValidAiCeoActionType(value: unknown): value is AiCeoActionType {
  return typeof value === 'string' && (AI_CEO_ACTION_VALUES as readonly string[]).includes(value);
}

/** Module 9's "ask for approval before starting a production run" — the
 * only shape a recommendation is ever allowed to hand off into generation
 * work is this same `MissionControlAutopilotAction` shape Build 030 Part 1
 * already uses for `AutopilotView`'s `initialAction` prop (re-declared here
 * rather than imported from the component file, so this domain module has
 * no dependency on `components/`). Handing this to `AutopilotView` still
 * lands on its own plan-review screen — nothing here bypasses that
 * approval step. */
export interface AiCeoAutopilotHandoff {
  mode: AutopilotMode;
  requestedCount: number;
  marketplace?: string | null;
  productionGoal?: AutopilotProductionGoal;
  userInstruction?: string;
}

/** Module 12's required expandable explanation shape — one object every
 * proactive statement (Morning Brief, a single recommendation, a Portfolio
 * Doctor finding) can point to, so "no hidden recommendation logic" has one
 * concrete, testable shape instead of being a UI convention nobody checks. */
export interface AiCeoExplanation {
  recommendation: string;
  why: string[];
  evidence: string[];
  confidence: EvidenceBand;
  freshness: AiCeoDataStatus;
  freshnessLabel: string;
  assumptions: string[];
  risks: string[];
  alternative: string | null;
  /** Confirmed-memory summaries that actually influenced this
   * recommendation, always prefixed "Based on your confirmed preference…"
   * by the UI — empty when memory played no part, never a placeholder. */
  memoryUsed: string[];
  missingData: string[];
}

export interface AiCeoRecommendation {
  id: string;
  action: AiCeoActionType;
  title: string;
  reason: string;
  evidenceRefs: string[];
  confidence: EvidenceBand;
  risks: string[];
  alternativeAction: AiCeoActionType | null;
  alternativeTitle: string | null;
  alternativeReason: string | null;
  dataFreshness: AiCeoDataStatus;
  freshnessLabel: string;
  /** Qualitative only — "Fills your largest portfolio gap", never a
   * revenue/sales estimate (Core Principle). */
  expectedImpact: string;
  autopilotAction: AiCeoAutopilotHandoff | null;
  /** For recommendations whose primary action is real navigation (e.g.
   * "Continue Yesterday" -> Autopilot History's own working Resume button,
   * "Review Rejected Items" -> Portfolio) rather than a new generation
   * plan — mutually exclusive with `autopilotAction` in practice, never
   * both real at once. */
  navigateTarget: 'autopilotHistory' | 'portfolio' | 'marketing' | null;
  memoryInfluence: string[];
}

export function isValidAiCeoRecommendation(value: unknown): value is AiCeoRecommendation {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<AiCeoRecommendation>;
  return typeof r.id === 'string' && isValidAiCeoActionType(r.action) && typeof r.title === 'string' && Array.isArray(r.evidenceRefs);
}

export const AI_CEO_BRIEF_SCHEMA_VERSION = 1;

/** Module 1's Morning Brief — every one of the spec's 14 required sections
 * is represented by a named field below rather than free text, so a test
 * can assert each section exists rather than parsing prose. */
export interface AiCeoBrief {
  id: string;
  createdAt: number;
  greeting: string;
  dateLabel: string;
  dataStatus: AiCeoDataStatus;
  dataStatusLabel: string;
  /** `null` when no real prior-session record exists — Module 1's own
   * "if real records exist" qualifier, never a fabricated summary. */
  yesterdaySummary: string | null;
  topRecommendation: AiCeoRecommendation;
  alternativeRecommendations: AiCeoRecommendation[];
  portfolioImpact: string;
  productionSizeRecommendation: string;
  confidence: EvidenceBand;
  freshnessLabel: string;
  risks: string[];
  missingInformation: string[];
  primaryAction: AiCeoAutopilotHandoff | null;
  explanation: AiCeoExplanation;
  schemaVersion: number;
}

export function isValidAiCeoBrief(value: unknown): value is AiCeoBrief {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<AiCeoBrief>;
  return typeof b.id === 'string' && typeof b.createdAt === 'number' && !!b.topRecommendation && isValidAiCeoRecommendation(b.topRecommendation);
}

// ---------------------------------------------------------------------------
// Module 5 — Business Goals

export const BUSINESS_GOAL_TYPE_VALUES = [
  'GROW_PORTFOLIO',
  'IMPROVE_DIVERSITY',
  'COMPLETE_COLLECTIONS',
  'PREPARE_MORE_FOR_SUBMISSION',
  'INCREASE_ADOBE_COVERAGE',
  'INCREASE_SHUTTERSTOCK_COVERAGE',
  'INCREASE_ETSY_COVERAGE',
  'PRODUCE_EVERGREEN',
  'PRODUCE_SEASONAL',
  'REDUCE_REJECTION_RATE',
  'CUSTOM',
] as const;
export type BusinessGoalType = (typeof BUSINESS_GOAL_TYPE_VALUES)[number];

export function isValidBusinessGoalType(value: unknown): value is BusinessGoalType {
  return typeof value === 'string' && (BUSINESS_GOAL_TYPE_VALUES as readonly string[]).includes(value);
}

export const BUSINESS_GOAL_STATUS_VALUES = ['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type BusinessGoalStatus = (typeof BUSINESS_GOAL_STATUS_VALUES)[number];

export const BUSINESS_GOAL_SCHEMA_VERSION = 1;

export interface BusinessGoal {
  id: string;
  type: BusinessGoalType;
  title: string;
  targetDate: number | null;
  targetQuantity: number | null;
  preferredMarketplaces: string[];
  availableTimePerDayMinutes: number | null;
  preferredWorkingDays: string[];
  excludedCategoryIds: string[];
  notes: string;
  /** Set only when the user's own notes/title look like a revenue/income
   * target — always paired with the Core Principle's honesty warning
   * (`describeRevenueGoalWarning`), never silently converted into a
   * required image count. */
  revenueGoalDetected: boolean;
  status: BusinessGoalStatus;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export function isValidBusinessGoal(value: unknown): value is BusinessGoal {
  if (!value || typeof value !== 'object') return false;
  const g = value as Partial<BusinessGoal>;
  return typeof g.id === 'string' && isValidBusinessGoalType(g.type) && typeof g.title === 'string' && typeof g.createdAt === 'number';
}

// ---------------------------------------------------------------------------
// Modules 6-7 — AI Conversation Engine + Conversation History

export const AI_CONVERSATION_SCHEMA_VERSION = 1;

export interface AiConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  schemaVersion: number;
}

export function isValidAiConversation(value: unknown): value is AiConversation {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<AiConversation>;
  return typeof c.id === 'string' && typeof c.title === 'string' && typeof c.createdAt === 'number';
}

export type AiConversationRole = 'user' | 'ai';

export const AI_CONVERSATION_MESSAGE_SCHEMA_VERSION = 1;

export interface AiConversationMessage {
  id: string;
  conversationId: string;
  role: AiConversationRole;
  text: string;
  createdAt: number;
  recognizedIntent: string | null;
  extractedParameters: Record<string, string | number> | null;
  aiResponse: string | null;
  evidenceRefs: string[];
  linkedMissionId: string | null;
  linkedGoalId: string | null;
  linkedAutonomousDesignRunId: string | null;
  linkedCollectionId: string | null;
  actionTaken: string | null;
  result: string | null;
  userFeedback: 'helpful' | 'not_helpful' | null;
  schemaVersion: number;
}

export function isValidAiConversationMessage(value: unknown): value is AiConversationMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<AiConversationMessage>;
  return typeof m.id === 'string' && typeof m.conversationId === 'string' && (m.role === 'user' || m.role === 'ai') && typeof m.createdAt === 'number';
}

// ---------------------------------------------------------------------------
// Module 8 — User-Confirmed AI Memory. Deliberately two stores, not one
// store with a status field: `AiMemoryCandidate` (SUGGESTED/REJECTED) is
// what the system has merely noticed; `AiMemory` (CONFIRMED/ARCHIVED) is
// the only store any recommendation logic is ever allowed to read from —
// so "only CONFIRMED memory may influence future recommendations" is
// enforced by which store a function imports, not by a runtime status
// check that could be forgotten.

export const AI_MEMORY_TYPE_VALUES = [
  'PREFERRED_STYLE',
  'PREFERRED_MARKETPLACE',
  'PREFERRED_PRODUCT_TARGET',
  'PREFERRED_COLLECTION_SIZE',
  'PREFERRED_PALETTE_FAMILY',
  'AVOIDED_CATEGORY',
  'AVOIDED_HERO_MOTIF',
  'PREFERRED_DENSITY',
  'PREFERRED_AUTOPILOT_MODE',
  'AVAILABLE_WORKING_TIME',
  'CONFIRMED_BUSINESS_RULE',
  'CONFIRMED_LESSON',
] as const;
export type AiMemoryType = (typeof AI_MEMORY_TYPE_VALUES)[number];

export function isValidAiMemoryType(value: unknown): value is AiMemoryType {
  return typeof value === 'string' && (AI_MEMORY_TYPE_VALUES as readonly string[]).includes(value);
}

export const AI_MEMORY_CANDIDATE_STATUS_VALUES = ['SUGGESTED', 'REJECTED', 'PROMOTED'] as const;
export type AiMemoryCandidateStatus = (typeof AI_MEMORY_CANDIDATE_STATUS_VALUES)[number];

export const AI_MEMORY_CANDIDATE_SCHEMA_VERSION = 1;

export interface AiMemoryCandidate {
  id: string;
  type: AiMemoryType;
  value: string;
  /** Plain, human-readable evidence for the suggestion — e.g. "You chose
   * Etsy as the target marketplace on 3 of your last 3 Autopilot runs." —
   * never a bare count with no sentence around it. */
  evidence: string;
  observedCount: number;
  status: AiMemoryCandidateStatus;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export function isValidAiMemoryCandidate(value: unknown): value is AiMemoryCandidate {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<AiMemoryCandidate>;
  return typeof c.id === 'string' && isValidAiMemoryType(c.type) && typeof c.value === 'string' && typeof c.createdAt === 'number';
}

export const AI_MEMORY_STATUS_VALUES = ['CONFIRMED', 'ARCHIVED'] as const;
export type AiMemoryStatus = (typeof AI_MEMORY_STATUS_VALUES)[number];

export const AI_MEMORY_SCHEMA_VERSION = 1;

export interface AiMemory {
  id: string;
  type: AiMemoryType;
  value: string;
  status: AiMemoryStatus;
  sourceCandidateId: string | null;
  confirmedAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export function isValidAiMemory(value: unknown): value is AiMemory {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<AiMemory>;
  return typeof m.id === 'string' && isValidAiMemoryType(m.type) && typeof m.value === 'string' && typeof m.confirmedAt === 'number';
}

// ---------------------------------------------------------------------------
// Module 4 — Portfolio Doctor

export const PORTFOLIO_DIAGNOSIS_VERDICT_VALUES = ['HEALTHY', 'NEEDS_ATTENTION', 'UNBALANCED', 'INSUFFICIENT_DATA'] as const;
export type PortfolioDiagnosisVerdict = (typeof PORTFOLIO_DIAGNOSIS_VERDICT_VALUES)[number];

export interface PortfolioDiagnosisFinding {
  code: string;
  verdict: PortfolioDiagnosisVerdict;
  finding: string;
  evidence: string;
  affectedCount: number;
  confidence: EvidenceBand;
  recommendedAction: string;
  sendToAutopilotAction: AiCeoAutopilotHandoff | null;
}

export const PORTFOLIO_DIAGNOSIS_SCHEMA_VERSION = 1;

export interface PortfolioDiagnosis {
  id: string;
  createdAt: number;
  overallVerdict: PortfolioDiagnosisVerdict;
  findings: PortfolioDiagnosisFinding[];
  schemaVersion: number;
}

export function isValidPortfolioDiagnosis(value: unknown): value is PortfolioDiagnosis {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<PortfolioDiagnosis>;
  return typeof d.id === 'string' && typeof d.createdAt === 'number' && Array.isArray(d.findings);
}

// ---------------------------------------------------------------------------
// Module 3 — Business Coach

export interface BusinessCoachCard {
  code: string;
  title: string;
  /** Always a real count/label — an honest "0" or "No unfinished work"
   * rather than an omitted card, so an empty portfolio still renders every
   * required card (spec: "show only real counts... honest empty state"). */
  value: string;
  detail: string;
  actionLabel: string | null;
  autopilotAction: AiCeoAutopilotHandoff | null;
  navigateTarget: 'autopilotHistory' | 'portfolio' | 'marketing' | null;
}

export const BUSINESS_COACH_RUN_SCHEMA_VERSION = 1;

export interface BusinessCoachRun {
  id: string;
  createdAt: number;
  cards: BusinessCoachCard[];
  schemaVersion: number;
}

export function isValidBusinessCoachRun(value: unknown): value is BusinessCoachRun {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<BusinessCoachRun>;
  return typeof r.id === 'string' && typeof r.createdAt === 'number' && Array.isArray(r.cards);
}

// ---------------------------------------------------------------------------
// Module 14 — reuses `RECOMMENDATION_HISTORY_STORE` (`storage/db.ts`) for
// `proactiveRecommendationHistory`, indexed by `recommendationType`/`refId`
// exactly as that store was originally provisioned in Build 028.

export type ProactiveRecommendationOutcome = 'shown' | 'accepted' | 'adjusted' | 'dismissed';

export interface ProactiveRecommendationHistoryEntry {
  id: string;
  recommendationType: 'aiCeoRecommendation';
  refId: string;
  action: AiCeoActionType;
  outcome: ProactiveRecommendationOutcome;
  createdAt: number;
}

export function isValidProactiveRecommendationHistoryEntry(value: unknown): value is ProactiveRecommendationHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<ProactiveRecommendationHistoryEntry>;
  return typeof e.id === 'string' && typeof e.refId === 'string' && typeof e.createdAt === 'number';
}
