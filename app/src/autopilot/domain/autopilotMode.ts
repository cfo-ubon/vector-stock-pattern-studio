// Build 029 (Autonomous Design Autopilot) — the 8 entry modes offered on
// the "ออกแบบให้ฉันวันนี้ / Design for Me Today" start screen. Each mode
// only changes HOW the Decision Engine (`autopilot/decisionEngine.ts`)
// selects its source evidence and resolves open fields — every mode still
// produces the same real `DesignPlan` shape and still goes through the same
// one-click generation pipeline. No mode is a stub; every one is wired to a
// real source of evidence (Market Snapshot/Opportunity/Daily Mission,
// Portfolio coverage, or a parsed custom-goal sentence).

export const AUTOPILOT_MODE_VALUES = [
  'FULL_AUTOPILOT',
  'GUIDED_AUTOPILOT',
  'TODAYS_MISSION',
  'PORTFOLIO_GAP',
  'SELLABLE_COLLECTION',
  'EVERGREEN_COMMERCIAL',
  'SEASONAL_OPPORTUNITY',
  'CUSTOM_GOAL',
] as const;

export type AutopilotMode = (typeof AUTOPILOT_MODE_VALUES)[number];

export function isValidAutopilotMode(value: unknown): value is AutopilotMode {
  return typeof value === 'string' && (AUTOPILOT_MODE_VALUES as readonly string[]).includes(value);
}

export const AUTOPILOT_MODE_LABEL_TH: Record<AutopilotMode, string> = {
  FULL_AUTOPILOT: 'ระบบตัดสินใจทุกอย่าง',
  GUIDED_AUTOPILOT: 'ระบบตัดสินใจทั้งหมด แต่ผู้ใช้แก้ไขข้อจำกัดสำคัญได้',
  TODAYS_MISSION: 'ใช้คำแนะนำล่าสุดจากเมนูนักการตลาด',
  PORTFOLIO_GAP: 'เลือกสิ่งที่ Portfolio ยังขาด',
  SELLABLE_COLLECTION: 'สร้าง Collection ที่สมบูรณ์ทั้งชุด',
  EVERGREEN_COMMERCIAL: 'เน้นแนวที่ไม่ขึ้นกับฤดูกาล',
  SEASONAL_OPPORTUNITY: 'ใช้โอกาสตามฤดูกาลและช่วงเวลาส่งขาย',
  CUSTOM_GOAL: 'ผู้ใช้พิมพ์เป้าหมายสั้น ๆ เพียงประโยคเดียว',
};

export const AUTOPILOT_MODE_LABEL_EN: Record<AutopilotMode, string> = {
  FULL_AUTOPILOT: 'Full Autopilot',
  GUIDED_AUTOPILOT: 'Guided Autopilot',
  TODAYS_MISSION: "Use Today's Market Mission",
  PORTFOLIO_GAP: 'Expand My Portfolio',
  SELLABLE_COLLECTION: 'Build a Sellable Collection',
  EVERGREEN_COMMERCIAL: 'Evergreen Commercial',
  SEASONAL_OPPORTUNITY: 'Seasonal Opportunity',
  CUSTOM_GOAL: 'Custom Goal',
};

/** Modes that require the user to be able to lock/edit constraints before
 * generation (Module 4). `FULL_AUTOPILOT` and every "themed" mode still let
 * the user open the constraint panel from the Design Plan screen — this
 * only marks the modes where the flow defaults straight into it. */
export const GUIDED_MODES: ReadonlySet<AutopilotMode> = new Set(['GUIDED_AUTOPILOT']);

/** Modes honest about needing zero live market evidence — Module 12's two
 * offline fallback modes double as first-class entry modes too. */
export const OFFLINE_SAFE_MODES: ReadonlySet<AutopilotMode> = new Set(['PORTFOLIO_GAP', 'EVERGREEN_COMMERCIAL']);
