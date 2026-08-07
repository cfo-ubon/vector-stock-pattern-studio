import { describe, it, expect } from 'vitest';
import {
  MISSION_GOAL_MODE_VALUES,
  MISSION_GOAL_MODE_LABEL_EN,
  MISSION_GOAL_MODE_LABEL_TH,
  isValidMissionGoalMode,
  resolveMissionGoalMode,
} from './goalModes';

describe('MissionGoalMode', () => {
  it('has exactly the 10 spec-required goal modes', () => {
    expect(MISSION_GOAL_MODE_VALUES).toHaveLength(10);
  });

  it('has a real Thai and English label for every goal mode', () => {
    for (const mode of MISSION_GOAL_MODE_VALUES) {
      expect(MISSION_GOAL_MODE_LABEL_EN[mode]).toBeTruthy();
      expect(MISSION_GOAL_MODE_LABEL_TH[mode]).toBeTruthy();
    }
  });

  it('isValidMissionGoalMode accepts every real mode and rejects garbage', () => {
    for (const mode of MISSION_GOAL_MODE_VALUES) expect(isValidMissionGoalMode(mode)).toBe(true);
    expect(isValidMissionGoalMode('NOT_A_MODE')).toBe(false);
  });

  it('resolves every goal mode to a real AutopilotMode, never a fabricated string', () => {
    const validModes = ['FULL_AUTOPILOT', 'GUIDED_AUTOPILOT', 'TODAYS_MISSION', 'PORTFOLIO_GAP', 'SELLABLE_COLLECTION', 'EVERGREEN_COMMERCIAL', 'SEASONAL_OPPORTUNITY', 'CUSTOM_GOAL'];
    for (const mode of MISSION_GOAL_MODE_VALUES) {
      const resolved = resolveMissionGoalMode(mode);
      expect(validModes).toContain(resolved.mode);
    }
  });

  it('Expand Adobe/Shutterstock/Etsy each resolve to Guided Autopilot with the correct marketplace preset', () => {
    expect(resolveMissionGoalMode('EXPAND_ADOBE')).toEqual({ mode: 'GUIDED_AUTOPILOT', marketplace: 'Adobe Stock', productionGoal: 'auto' });
    expect(resolveMissionGoalMode('EXPAND_SHUTTERSTOCK')).toEqual({ mode: 'GUIDED_AUTOPILOT', marketplace: 'Shutterstock', productionGoal: 'auto' });
    expect(resolveMissionGoalMode('EXPAND_ETSY')).toEqual({ mode: 'GUIDED_AUTOPILOT', marketplace: 'Etsy', productionGoal: 'auto' });
  });

  it('AI Chooses Everything resolves to Full Autopilot; Use Today\'s Recommendation resolves to Today\'s Mission', () => {
    expect(resolveMissionGoalMode('AI_CHOOSES_EVERYTHING').mode).toBe('FULL_AUTOPILOT');
    expect(resolveMissionGoalMode('USE_TODAYS_RECOMMENDATION').mode).toBe('TODAYS_MISSION');
  });
});
