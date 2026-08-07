import { parseCommandBarInput } from '../missionControl/commandBarParser';
import { resolveMissionGoalMode, MISSION_GOAL_MODE_LABEL_EN, type MissionGoalMode } from '../missionControl/goalModes';
import { parseCustomGoal, type ParsedCustomGoal } from '../autopilot/customGoalParser';
import type { AiCeoAutopilotHandoff, AiCeoRecommendation, PortfolioDiagnosis } from './domain/types';

// Build 030 Part 2, Module 6 — AI Conversation Engine. Deterministic,
// entirely local intent recognition (no LLM call, no network — Module 15's
// "core AI CEO behavior must work without a cloud provider" applies here
// specifically). The spec's named Thai commands are matched first; every
// fallthrough lands on the same real, already-existing interpreters
// (`missionControl/commandBarParser.ts` -> `autopilot/customGoalParser.ts`)
// used by the AI Command Bar since Build 030 Part 1 — never a second,
// parallel natural-language interpreter. Genuinely unrecognizable input
// (no keyword pattern, no count, no marketplace, no action verb) is the
// one honest "I cannot complete this command locally yet" case, per the
// spec's explicit instruction never to pretend a cloud AI request
// succeeded when no provider is connected.

export type AiConversationIntent =
  | 'todaysFocus'
  | 'startTodaysMission'
  | 'generateCount'
  | 'createCollectionForMarketplace'
  | 'addToPortfolio'
  | 'fillMissingCategory'
  | 'continueYesterday'
  | 'checkPortfolio'
  | 'viewUnfinishedWork'
  | 'createMoreColorways'
  | 'prepareForSubmission'
  | 'openAdvancedMode'
  | 'goalMode'
  | 'navigate'
  | 'customGoal'
  | 'unsupported';

export type ConversationNavigateTarget = 'portfolio' | 'marketing' | 'designDirector' | 'autopilotHistory' | 'advancedMode';

export interface ParsedConversationIntent {
  intent: AiConversationIntent;
  extractedParameters: Record<string, string | number> | null;
  goalMode?: MissionGoalMode;
  navigateTarget?: ConversationNavigateTarget;
  customGoal?: ParsedCustomGoal;
}

// Thai command + English equivalent, verbatim from the spec's Module 6 list.
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: AiConversationIntent }> = [
  { pattern: /วันนี้ควรทำอะไร|what should i do today/i, intent: 'todaysFocus' },
  { pattern: /เริ่มภารกิจวันนี้|start today'?s mission/i, intent: 'startTodaysMission' },
  { pattern: /สร้าง\s*\d+\s*ลาย|create\s*\d+\s*patterns?/i, intent: 'generateCount' },
  { pattern: /สร้าง\s*collection\s*สำหรับ|create\s*(a\s*)?collection\s*for/i, intent: 'createCollectionForMarketplace' },
  { pattern: /เพิ่ม\s*portfolio|add\s*to\s*portfolio/i, intent: 'addToPortfolio' },
  { pattern: /เติมหมวดที่ขาด|fill\s*(the\s*)?missing\s*categor/i, intent: 'fillMissingCategory' },
  { pattern: /ทำงานต่อจากเมื่อวาน|continue\s*(from\s*)?yesterday/i, intent: 'continueYesterday' },
  { pattern: /ตรวจ\s*portfolio|check\s*(my\s*)?portfolio/i, intent: 'checkPortfolio' },
  { pattern: /ดูงานที่ยังไม่เสร็จ|view\s*unfinished\s*work/i, intent: 'viewUnfinishedWork' },
  { pattern: /สร้าง\s*colorway\s*เพิ่ม|create\s*(more|additional)\s*colorways?/i, intent: 'createMoreColorways' },
  { pattern: /เตรียมงานพร้อมส่งขาย|prepare\s*(work\s*)?for\s*submission/i, intent: 'prepareForSubmission' },
  { pattern: /เปิดโหมดขั้นสูง|open\s*advanced\s*mode/i, intent: 'openAdvancedMode' },
];

const ACTION_VERB_PATTERN = /\b(create|generate|build|make|design)\b|สร้าง|ทำ|ออกแบบ/i;

export function parseConversationIntent(text: string): ParsedConversationIntent {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { intent: 'unsupported', extractedParameters: null };

  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (!pattern.test(trimmed)) continue;
    if (intent === 'generateCount') {
      const parsed = parseCustomGoal(trimmed);
      return { intent, extractedParameters: parsed.count !== null ? { count: parsed.count } : null };
    }
    if (intent === 'createCollectionForMarketplace') {
      const parsed = parseCustomGoal(trimmed);
      return { intent, extractedParameters: parsed.marketplace ? { marketplace: parsed.marketplace } : null };
    }
    return { intent, extractedParameters: null };
  }

  const commandBarResult = parseCommandBarInput(trimmed);
  if (commandBarResult.kind === 'navigate') return { intent: 'navigate', extractedParameters: null, navigateTarget: commandBarResult.target };
  if (commandBarResult.kind === 'goalMode') return { intent: 'goalMode', extractedParameters: null, goalMode: commandBarResult.goalMode };

  const parsed = commandBarResult.parsed;
  if (parsed.count === null && parsed.marketplace === null && !ACTION_VERB_PATTERN.test(trimmed)) {
    return { intent: 'unsupported', extractedParameters: null };
  }
  return { intent: 'customGoal', extractedParameters: null, customGoal: parsed };
}

export const CONVERSATION_UNSUPPORTED_MESSAGE =
  'I cannot complete this command locally yet. Try: "วันนี้ควรทำอะไร" / "What should I do today", "สร้าง 10 ลาย" / "Create 10 patterns", "ตรวจ Portfolio" / "Check my Portfolio".';

export interface ConversationContext {
  topRecommendation: AiCeoRecommendation;
  continueYesterdayAction: AiCeoRecommendation | null;
  portfolioDiagnosis: PortfolioDiagnosis | null;
  defaultRequestedCount: number;
}

export interface ConversationResponse {
  responseText: string;
  autopilotAction: AiCeoAutopilotHandoff | null;
  navigateTarget: ConversationNavigateTarget | null;
}

/** Turns a parsed intent into a real response — every branch either hands
 * off a real `AiCeoAutopilotHandoff` (still requiring the user's approval
 * on Autopilot's own plan screen, per Module 9), points to a real existing
 * screen, or honestly says it cannot help. Never a generic chatbot reply. */
export function respondToConversationIntent(parsed: ParsedConversationIntent, rawText: string, context: ConversationContext): ConversationResponse {
  switch (parsed.intent) {
    case 'todaysFocus':
    case 'startTodaysMission':
      return { responseText: `${context.topRecommendation.title}. ${context.topRecommendation.reason}`, autopilotAction: context.topRecommendation.autopilotAction, navigateTarget: context.topRecommendation.navigateTarget };

    case 'generateCount': {
      const count = typeof parsed.extractedParameters?.count === 'number' ? parsed.extractedParameters.count : context.defaultRequestedCount;
      const base = context.topRecommendation.autopilotAction ?? { mode: 'FULL_AUTOPILOT' as const, productionGoal: 'auto' as const };
      return { responseText: `Starting a plan for ${count} pattern(s) using "${context.topRecommendation.title}".`, autopilotAction: { ...base, requestedCount: count }, navigateTarget: null };
    }

    case 'createCollectionForMarketplace': {
      const marketplace = typeof parsed.extractedParameters?.marketplace === 'string' ? parsed.extractedParameters.marketplace : null;
      if (!marketplace) {
        return { responseText: 'I could not recognize a marketplace in that sentence — try naming one explicitly (e.g. Adobe Stock, Etsy, Shutterstock).', autopilotAction: null, navigateTarget: null };
      }
      return { responseText: `Starting a collection plan targeting ${marketplace}.`, autopilotAction: { mode: 'GUIDED_AUTOPILOT', requestedCount: context.defaultRequestedCount, marketplace, productionGoal: 'collection' }, navigateTarget: null };
    }

    case 'addToPortfolio':
      return { responseText: 'Opening Autopilot History so you can import READY items into your Portfolio.', autopilotAction: null, navigateTarget: 'autopilotHistory' };

    case 'fillMissingCategory':
      return {
        responseText: context.topRecommendation.action === 'DIVERSIFY_PORTFOLIO' ? context.topRecommendation.reason : 'Starting a plan for your least-covered category.',
        autopilotAction: { mode: 'PORTFOLIO_GAP', requestedCount: context.defaultRequestedCount, productionGoal: 'portfolioExpansion' },
        navigateTarget: null,
      };

    case 'continueYesterday':
    case 'viewUnfinishedWork':
      return context.continueYesterdayAction
        ? { responseText: context.continueYesterdayAction.reason, autopilotAction: context.continueYesterdayAction.autopilotAction, navigateTarget: context.continueYesterdayAction.navigateTarget }
        : { responseText: 'No unfinished work was found — everything from your last session is complete.', autopilotAction: null, navigateTarget: null };

    case 'checkPortfolio':
      return {
        responseText: context.portfolioDiagnosis
          ? `Portfolio Doctor: ${context.portfolioDiagnosis.overallVerdict}. ${context.portfolioDiagnosis.findings.map((f) => f.finding).join(' ')}`
          : 'No Portfolio diagnosis has been run yet.',
        autopilotAction: null,
        navigateTarget: 'portfolio',
      };

    case 'createMoreColorways':
      return { responseText: `Starting a plan for additional colorways of "${context.topRecommendation.title}".`, autopilotAction: context.topRecommendation.autopilotAction, navigateTarget: null };

    case 'prepareForSubmission':
      return { responseText: 'Opening Portfolio to prepare items for submission.', autopilotAction: null, navigateTarget: 'portfolio' };

    case 'openAdvancedMode':
      return { responseText: 'Opening Advanced Mode.', autopilotAction: null, navigateTarget: 'advancedMode' };

    case 'navigate':
      return { responseText: `Opening ${parsed.navigateTarget}.`, autopilotAction: null, navigateTarget: parsed.navigateTarget ?? null };

    case 'goalMode': {
      if (!parsed.goalMode) return { responseText: CONVERSATION_UNSUPPORTED_MESSAGE, autopilotAction: null, navigateTarget: null };
      const resolved = resolveMissionGoalMode(parsed.goalMode);
      return {
        responseText: `Starting: ${MISSION_GOAL_MODE_LABEL_EN[parsed.goalMode]}.`,
        autopilotAction: { mode: resolved.mode, requestedCount: context.defaultRequestedCount, marketplace: resolved.marketplace, productionGoal: resolved.productionGoal },
        navigateTarget: null,
      };
    }

    case 'customGoal':
      return parsed.customGoal
        ? { responseText: `Starting a plan for "${parsed.customGoal.theme}".`, autopilotAction: { mode: 'CUSTOM_GOAL', requestedCount: parsed.customGoal.count ?? context.defaultRequestedCount, userInstruction: rawText.trim() }, navigateTarget: null }
        : { responseText: CONVERSATION_UNSUPPORTED_MESSAGE, autopilotAction: null, navigateTarget: null };

    case 'unsupported':
    default:
      return { responseText: CONVERSATION_UNSUPPORTED_MESSAGE, autopilotAction: null, navigateTarget: null };
  }
}
