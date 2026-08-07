import { parseCustomGoal, type ParsedCustomGoal } from '../autopilot/customGoalParser';
import { MISSION_GOAL_MODE_VALUES, type MissionGoalMode } from './goalModes';

// Build 030 ("AI Command Bar") — interprets one free-text sentence into
// either a recognized Goal Mode (a real, existing workflow) or, when
// nothing matches, the exact same `parseCustomGoal` (Build 029) the
// Autopilot's Custom Goal mode already uses — never a second, parallel
// natural-language interpreter. Keyword-based, no LLM call, no network:
// every result is either a real match found in the sentence or an honest
// fallback to Custom Goal, exactly like `customGoalParser.ts`'s own
// documented convention.

export type CommandBarAction =
  | { kind: 'goalMode'; goalMode: MissionGoalMode }
  | { kind: 'navigate'; target: 'portfolio' | 'marketing' | 'designDirector' | 'autopilotHistory' }
  | { kind: 'customGoal'; parsed: ParsedCustomGoal };

const GOAL_MODE_KEYWORDS: Array<{ pattern: RegExp; goalMode: MissionGoalMode }> = [
  { pattern: /earn faster|เร่งสร้างรายได้|help me earn/i, goalMode: 'EARN_FASTER' },
  { pattern: /grow (my )?portfolio|ขยาย\s*portfolio/i, goalMode: 'GROW_PORTFOLIO' },
  { pattern: /seasonal/i, goalMode: 'SEASONAL_COLLECTION' },
  { pattern: /portfolio gap|fill.*gap|เติมหมวด/i, goalMode: 'FILL_PORTFOLIO_GAPS' },
  { pattern: /evergreen/i, goalMode: 'EVERGREEN_INCOME' },
  { pattern: /adobe/i, goalMode: 'EXPAND_ADOBE' },
  { pattern: /shutterstock/i, goalMode: 'EXPAND_SHUTTERSTOCK' },
  { pattern: /etsy/i, goalMode: 'EXPAND_ETSY' },
  { pattern: /today'?s recommendation|today'?s mission|continue yesterday/i, goalMode: 'USE_TODAYS_RECOMMENDATION' },
  { pattern: /ai (choose|chooses|decide)|full autopilot/i, goalMode: 'AI_CHOOSES_EVERYTHING' },
];

type NavigateTarget = 'portfolio' | 'marketing' | 'designDirector' | 'autopilotHistory';

const NAVIGATE_KEYWORDS: Array<{ pattern: RegExp; target: NavigateTarget }> = [
  { pattern: /analyze my portfolio|portfolio health|open portfolio/i, target: 'portfolio' },
  { pattern: /market advisor|marketing intelligence/i, target: 'marketing' },
  { pattern: /design director|creative director/i, target: 'designDirector' },
  { pattern: /autopilot history|past runs|run history/i, target: 'autopilotHistory' },
];

/** Interprets one free-text sentence typed into the AI Command Bar. Order
 * matters: a recognized navigation intent wins first (an explicit "open
 * X" should never get reinterpreted as a generation goal), then a
 * recognized Goal Mode, then an honest fallback to the existing Custom
 * Goal parser — every path lands on a real, already-existing workflow
 * object, never a fabricated interpretation. */
export function parseCommandBarInput(text: string): CommandBarAction {
  const trimmed = text.trim();
  for (const { pattern, target } of NAVIGATE_KEYWORDS) {
    if (pattern.test(trimmed)) return { kind: 'navigate', target };
  }
  for (const { pattern, goalMode } of GOAL_MODE_KEYWORDS) {
    if (pattern.test(trimmed)) return { kind: 'goalMode', goalMode };
  }
  return { kind: 'customGoal', parsed: parseCustomGoal(trimmed) };
}

export function isMissionGoalMode(value: string): value is MissionGoalMode {
  return (MISSION_GOAL_MODE_VALUES as readonly string[]).includes(value);
}
