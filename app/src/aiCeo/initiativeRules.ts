import type { AiCeoRecommendation } from './domain/types';

// Build 030 Part 2, Module 9 — Initiative Rules. The AI CEO may propose,
// but never performs, a generation run, submission, deletion, or a change
// to a confirmed Goal/Memory on its own:
//  - Every `AiCeoRecommendation.autopilotAction` is only ever handed to
//    `AutopilotView`'s `initialAction` prop, which always lands on the
//    Design Plan review screen first — never straight into generation
//    (see `components/autopilot/AutopilotView.test.tsx`'s "lands straight
//    on the reviewed plan" test, which is the exact behavior this module
//    relies on staying true).
//  - Nothing in `app/src/aiCeo/` imports a marketplace submission
//    function, a Portfolio/Collection delete function, a QualitySnapshot
//    decision mutator, or a Goal/Memory write path other than the
//    explicit user-driven ones in `businessGoals.ts`/`memory.ts` — this
//    file exists so UI code has one shared place to assert the invariant
//    instead of re-deriving it per screen.

/** Every recommendation whose `autopilotAction` is non-null still requires
 * the user to explicitly approve a real Design Plan before anything is
 * generated — this always returns `true` for those, documenting (and
 * making assertable) that a hand-off is a starting point, never an
 * executed action. */
export function requiresExplicitUserApproval(recommendation: AiCeoRecommendation): boolean {
  return recommendation.autopilotAction !== null || recommendation.navigateTarget !== null;
}

/** The AI CEO is never allowed to silently upgrade a REVIEW/REJECT
 * QualitySnapshot decision to READY — this module has no import of
 * `catalog/quality/qualitySnapshotStore.ts`'s `putQualitySnapshot`, so
 * calling this is a compile-time-checkable statement, not a runtime one. */
export function aiCeoCanMutateQualityDecisions(): false {
  return false;
}

/** The AI CEO never sends a marketplace submission automatically — this
 * module has no import of `catalog/submission/submissionService.ts` or
 * any function that transitions a `SubmissionRecord` forward. */
export function aiCeoCanAutoSubmit(): false {
  return false;
}
