import type { AutopilotMode } from '../autopilot/domain/autopilotMode';
import type { AutopilotProductionGoal } from '../autopilot/collectionRolePlanner';

// Build 030 ("AI CEO & Mission Control") — the business-language Goal Modes
// from the spec's "AI GOAL MODES" section. Each one is a thin UX label over
// an existing Build 029 `AutopilotMode` (+ an optional marketplace/
// production-goal preset) — no new decision logic, no new evidence
// selection. `resolveMissionGoalMode` is the single place that mapping
// lives, so Mission Control and the AI Command Bar both read the same
// translation instead of each hardcoding their own.

export const MISSION_GOAL_MODE_VALUES = [
  'EARN_FASTER',
  'GROW_PORTFOLIO',
  'SEASONAL_COLLECTION',
  'FILL_PORTFOLIO_GAPS',
  'EVERGREEN_INCOME',
  'EXPAND_ADOBE',
  'EXPAND_SHUTTERSTOCK',
  'EXPAND_ETSY',
  'USE_TODAYS_RECOMMENDATION',
  'AI_CHOOSES_EVERYTHING',
] as const;

export type MissionGoalMode = (typeof MISSION_GOAL_MODE_VALUES)[number];

export function isValidMissionGoalMode(value: unknown): value is MissionGoalMode {
  return typeof value === 'string' && (MISSION_GOAL_MODE_VALUES as readonly string[]).includes(value);
}

export const MISSION_GOAL_MODE_LABEL_EN: Record<MissionGoalMode, string> = {
  EARN_FASTER: 'Earn Faster',
  GROW_PORTFOLIO: 'Grow Portfolio',
  SEASONAL_COLLECTION: 'Seasonal Collection',
  FILL_PORTFOLIO_GAPS: 'Fill Portfolio Gaps',
  EVERGREEN_INCOME: 'Evergreen Income',
  EXPAND_ADOBE: 'Expand Adobe Stock',
  EXPAND_SHUTTERSTOCK: 'Expand Shutterstock',
  EXPAND_ETSY: 'Expand Etsy',
  USE_TODAYS_RECOMMENDATION: "Use Today's Recommendation",
  AI_CHOOSES_EVERYTHING: 'AI Chooses Everything',
};

export const MISSION_GOAL_MODE_LABEL_TH: Record<MissionGoalMode, string> = {
  EARN_FASTER: 'เร่งสร้างรายได้',
  GROW_PORTFOLIO: 'ขยาย Portfolio',
  SEASONAL_COLLECTION: 'คอลเลกชันตามฤดูกาล',
  FILL_PORTFOLIO_GAPS: 'เติมหมวดที่ยังขาด',
  EVERGREEN_INCOME: 'รายได้แนวไม่มีฤดูกาล',
  EXPAND_ADOBE: 'ขยายพอร์ต Adobe Stock',
  EXPAND_SHUTTERSTOCK: 'ขยายพอร์ต Shutterstock',
  EXPAND_ETSY: 'ขยายพอร์ต Etsy',
  USE_TODAYS_RECOMMENDATION: 'ใช้คำแนะนำวันนี้',
  AI_CHOOSES_EVERYTHING: 'ให้ AI ตัดสินใจทุกอย่าง',
};

export interface ResolvedMissionGoal {
  mode: AutopilotMode;
  /** `null` means "Auto" — the same "Auto" the Autopilot start screen's
   * own marketplace selector already offers, never a fabricated pick. */
  marketplace: string | null;
  productionGoal: AutopilotProductionGoal;
}

/** The one place a business-language Goal Mode is translated into the real
 * `AutopilotMode` + marketplace preset the existing Decision Engine
 * consumes — reused by both the Goal Mode grid and the AI Command Bar so
 * neither has to re-decide what each goal "means". */
export function resolveMissionGoalMode(goalMode: MissionGoalMode): ResolvedMissionGoal {
  switch (goalMode) {
    case 'EARN_FASTER':
      return { mode: 'TODAYS_MISSION', marketplace: null, productionGoal: 'auto' };
    case 'GROW_PORTFOLIO':
      return { mode: 'SELLABLE_COLLECTION', marketplace: null, productionGoal: 'collection' };
    case 'SEASONAL_COLLECTION':
      return { mode: 'SEASONAL_OPPORTUNITY', marketplace: null, productionGoal: 'seasonal' };
    case 'FILL_PORTFOLIO_GAPS':
      return { mode: 'PORTFOLIO_GAP', marketplace: null, productionGoal: 'portfolioExpansion' };
    case 'EVERGREEN_INCOME':
      return { mode: 'EVERGREEN_COMMERCIAL', marketplace: null, productionGoal: 'auto' };
    case 'EXPAND_ADOBE':
      return { mode: 'GUIDED_AUTOPILOT', marketplace: 'Adobe Stock', productionGoal: 'auto' };
    case 'EXPAND_SHUTTERSTOCK':
      return { mode: 'GUIDED_AUTOPILOT', marketplace: 'Shutterstock', productionGoal: 'auto' };
    case 'EXPAND_ETSY':
      return { mode: 'GUIDED_AUTOPILOT', marketplace: 'Etsy', productionGoal: 'auto' };
    case 'USE_TODAYS_RECOMMENDATION':
      return { mode: 'TODAYS_MISSION', marketplace: null, productionGoal: 'auto' };
    case 'AI_CHOOSES_EVERYTHING':
      return { mode: 'FULL_AUTOPILOT', marketplace: null, productionGoal: 'auto' };
  }
}
