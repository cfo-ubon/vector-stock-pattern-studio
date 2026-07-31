import { describe, it, expect } from 'vitest';
import { AUTOPILOT_MODE_VALUES, AUTOPILOT_MODE_LABEL_TH, AUTOPILOT_MODE_LABEL_EN, GUIDED_MODES, OFFLINE_SAFE_MODES, isValidAutopilotMode } from './autopilotMode';

describe('AutopilotMode', () => {
  it('has exactly the 8 spec-required modes', () => {
    expect(AUTOPILOT_MODE_VALUES).toHaveLength(8);
  });

  it('has a real Thai and English label for every mode — none fabricated at render time', () => {
    for (const mode of AUTOPILOT_MODE_VALUES) {
      expect(AUTOPILOT_MODE_LABEL_TH[mode]).toBeTruthy();
      expect(AUTOPILOT_MODE_LABEL_EN[mode]).toBeTruthy();
    }
  });

  it('isValidAutopilotMode accepts every real mode and rejects garbage', () => {
    for (const mode of AUTOPILOT_MODE_VALUES) expect(isValidAutopilotMode(mode)).toBe(true);
    expect(isValidAutopilotMode('NOT_A_MODE')).toBe(false);
    expect(isValidAutopilotMode(null)).toBe(false);
  });

  it('GUIDED_MODES and OFFLINE_SAFE_MODES only contain real modes', () => {
    for (const mode of GUIDED_MODES) expect(AUTOPILOT_MODE_VALUES).toContain(mode);
    for (const mode of OFFLINE_SAFE_MODES) expect(AUTOPILOT_MODE_VALUES).toContain(mode);
  });
});
