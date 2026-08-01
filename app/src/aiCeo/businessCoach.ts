import type { AiCeoActionType, BusinessCoachCard, BusinessCoachRun } from './domain/types';
import { businessCoachRunId } from './domain/id';
import { findContinueYesterdayAction } from './continueYesterday';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { BusinessStatus } from '../missionControl/businessStatus';
import { loadBusinessStatus } from '../missionControl/businessStatus';
import { rankAiCeoRecommendations, type AiCeoDecisionInput } from './decisionEngine';
import { putBusinessCoachRun } from './storage/businessCoachRunStore';
import { loadAiCeoDecisionContext } from './loadDecisionContext';

// Build 030 Part 2, Module 3 — Business Coach. Every card below is a real
// reshape of the Decision Engine's already-ranked recommendations
// (Module 2) plus Mission Control's own already-computed
// `missionControl/businessStatus.ts` (Build 030 Part 1) — no second
// scoring system, no fabricated count. An empty portfolio still renders
// all 8 required cards, each with an honest empty-state value.

const QUICK_WIN_ACTIONS: ReadonlySet<AiCeoActionType> = new Set(['MOVE_READY_TO_PORTFOLIO', 'COMPLETE_SEO', 'PREPARE_FOR_SUBMISSION']);
const BLOCKER_ACTIONS: ReadonlySet<AiCeoActionType> = new Set(['REVIEW_REJECTED_ITEMS', 'CONTINUE_INTERRUPTED_RUN']);

function countLast7Days(assets: PortfolioAsset[], now: number): number {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return assets.filter((a) => a.createdAt >= weekAgo && a.createdAt <= now).length;
}

export interface BuildBusinessCoachInput extends AiCeoDecisionInput {
  businessStatus: BusinessStatus;
}

export function buildBusinessCoach(input: BuildBusinessCoachInput): BusinessCoachRun {
  const recommendations = rankAiCeoRecommendations(input);
  const top = recommendations[0];
  const quickWin = recommendations.find((r) => QUICK_WIN_ACTIONS.has(r.action)) ?? null;
  const blocker = recommendations.find((r) => BLOCKER_ACTIONS.has(r.action)) ?? null;
  const unfinished = findContinueYesterdayAction(recommendations);
  const weeklyCount = countLast7Days(input.portfolioAssets, input.now);

  const cards: BusinessCoachCard[] = [
    {
      code: 'todays-focus',
      title: "Today's Focus",
      value: top.title,
      detail: top.reason,
      actionLabel: top.autopilotAction ? 'Start' : top.navigateTarget ? 'Open' : null,
      autopilotAction: top.autopilotAction,
      navigateTarget: top.navigateTarget,
      decisionTrace: top.decisionTrace,
    },
    {
      code: 'quick-win',
      title: 'Quick Win',
      value: quickWin ? quickWin.title : 'No quick win available right now',
      detail: quickWin ? quickWin.reason : 'Nothing low-effort is currently outstanding.',
      actionLabel: quickWin ? (quickWin.autopilotAction ? 'Start' : 'Open') : null,
      autopilotAction: quickWin?.autopilotAction ?? null,
      navigateTarget: quickWin?.navigateTarget ?? null,
      decisionTrace: quickWin?.decisionTrace ?? null,
    },
    {
      code: 'blocker',
      title: 'Most Important Blocker',
      value: blocker ? blocker.title : 'No blockers found',
      detail: blocker ? blocker.reason : 'Nothing is currently blocking progress.',
      actionLabel: blocker ? (blocker.autopilotAction ? 'Start' : 'Open') : null,
      autopilotAction: blocker?.autopilotAction ?? null,
      navigateTarget: blocker?.navigateTarget ?? null,
      decisionTrace: blocker?.decisionTrace ?? null,
    },
    {
      code: 'unfinished-work',
      title: 'Unfinished Work',
      value: unfinished ? unfinished.title : 'No unfinished work found',
      detail: unfinished ? unfinished.reason : 'No interrupted runs, un-imported Ready items, or empty collections were found.',
      actionLabel: unfinished ? (unfinished.autopilotAction ? 'Start' : 'Open') : null,
      autopilotAction: unfinished?.autopilotAction ?? null,
      navigateTarget: unfinished?.navigateTarget ?? null,
      decisionTrace: unfinished?.decisionTrace ?? null,
    },
    {
      code: 'next-action',
      title: 'Recommended Next Action',
      value: top.title,
      detail: top.reason,
      actionLabel: top.autopilotAction ? 'Start' : top.navigateTarget ? 'Open' : null,
      autopilotAction: top.autopilotAction,
      navigateTarget: top.navigateTarget,
      decisionTrace: top.decisionTrace,
    },
    {
      code: 'weekly-progress',
      title: 'Weekly Production Progress',
      value: `${weeklyCount} pattern(s) this week`,
      detail: 'Real count of Portfolio assets created in the last 7 days.',
      actionLabel: null,
      autopilotAction: null,
      navigateTarget: null,
      decisionTrace: null,
    },
    {
      code: 'portfolio-growth',
      title: 'Portfolio Growth',
      value: `${input.portfolioAssets.length} total pattern(s)`,
      detail: `${input.businessStatus.monthlyProgress.patternsThisMonth} added this month.`,
      actionLabel: null,
      autopilotAction: null,
      navigateTarget: null,
      decisionTrace: null,
    },
    {
      code: 'submission-readiness',
      title: 'Submission Readiness',
      value: `${input.businessStatus.commercialReadiness}% ready`,
      detail: `READY: ${input.businessStatus.submissionQueue.ready}, Pending Review: ${input.businessStatus.submissionQueue.pendingReview}, Pending Upload: ${input.businessStatus.submissionQueue.pendingUpload}.`,
      actionLabel: null,
      autopilotAction: null,
      navigateTarget: null,
      decisionTrace: null,
    },
  ];

  return { id: businessCoachRunId.generate(input.now), createdAt: input.now, cards, schemaVersion: 1 };
}

export async function generateAndSaveBusinessCoachRun(requestedCount = 10, now: number = Date.now()): Promise<BusinessCoachRun> {
  const [context, businessStatus] = await Promise.all([loadAiCeoDecisionContext(now), loadBusinessStatus(now)]);
  const run = buildBusinessCoach({ ...context, requestedCount, now, businessStatus });
  await putBusinessCoachRun(run);
  return run;
}
