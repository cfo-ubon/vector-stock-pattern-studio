import type { AiCeoActionType, AiCeoRecommendation } from './domain/types';

// Build 030 Part 2, Module 11 — "Continue Yesterday". Deliberately not a
// second detection engine: every "unfinished work" signal it looks for
// (an interrupted run, un-imported READY items, rejected items to review,
// incomplete SEO, items not prepared for submission, empty collections)
// is already a real recommendation the Decision Engine (Module 2) already
// produces from real evidence — this module only picks the single
// highest-ranked one of those specific action types, so Mission Control's
// UX Section 3 ("Continue Unfinished Work") can show ONE best continuation
// action without maintaining a duplicate ranking.

const UNFINISHED_WORK_ACTIONS: ReadonlySet<AiCeoActionType> = new Set([
  'CONTINUE_INTERRUPTED_RUN',
  'MOVE_READY_TO_PORTFOLIO',
  'REVIEW_REJECTED_ITEMS',
  'COMPLETE_SEO',
  'PREPARE_FOR_SUBMISSION',
  'DIVERSIFY_PORTFOLIO',
]);

/** Given the Decision Engine's already-ranked list, returns the single
 * best "continue unfinished work" recommendation, or `null` when nothing
 * unfinished was found (an honest "nothing to continue" state, not an
 * empty-looking card). */
export function findContinueYesterdayAction(rankedRecommendations: AiCeoRecommendation[]): AiCeoRecommendation | null {
  return rankedRecommendations.find((r) => UNFINISHED_WORK_ACTIONS.has(r.action)) ?? null;
}
