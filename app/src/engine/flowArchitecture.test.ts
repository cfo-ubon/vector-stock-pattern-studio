import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createSineFlowPath, sineFlowPosition, sineFlowTangentDeg } from './flowArchitecture';

describe('createSineFlowPath', () => {
  it('is deterministic for the same seed', () => {
    const a = createSineFlowPath(createRng('flow-1'), 1200, [0.12, 0.2]);
    const b = createSineFlowPath(createRng('flow-1'), 1200, [0.12, 0.2]);
    expect(a).toEqual(b);
  });

  it('keeps amplitude within tileSize * ampRange', () => {
    const path = createSineFlowPath(createRng('flow-2'), 1000, [0.1, 0.3]);
    expect(path.amplitude).toBeGreaterThanOrEqual(100);
    expect(path.amplitude).toBeLessThanOrEqual(300);
  });

  it('defaults freq to 1 whole cycle per tile width', () => {
    const path = createSineFlowPath(createRng('flow-3'), 1000, [0.1, 0.2]);
    expect(path.freq).toBe(1);
  });
});

describe('sineFlowPosition', () => {
  it('is periodic across the tile width (t=0 matches t=1 for a whole-number freq)', () => {
    const path = createSineFlowPath(createRng('flow-4'), 1000, [0.1, 0.2]);
    expect(sineFlowPosition(path, 0)).toBeCloseTo(sineFlowPosition(path, 1), 10);
  });

  it('oscillates around centerY within +/- amplitude', () => {
    const path = createSineFlowPath(createRng('flow-5'), 1000, [0.1, 0.2]);
    for (let t = 0; t <= 1; t += 0.05) {
      const y = sineFlowPosition(path, t);
      expect(y).toBeGreaterThanOrEqual(path.centerY - path.amplitude - 1e-9);
      expect(y).toBeLessThanOrEqual(path.centerY + path.amplitude + 1e-9);
    }
  });
});

describe('sineFlowTangentDeg', () => {
  it('is periodic across the tile width', () => {
    const path = createSineFlowPath(createRng('flow-6'), 1000, [0.1, 0.2]);
    expect(sineFlowTangentDeg(path, 0)).toBeCloseTo(sineFlowTangentDeg(path, 1), 10);
  });

  it('is flattest (near 0deg) where the wave crosses its center going up/down fastest is not implied; instead verify a known zero-phase case', () => {
    // With phase=0, at t=0 the wave is at its steepest point (cos(0)=1),
    // so the tangent should be a real, non-zero angle there.
    const path = { tileSize: 1000, centerY: 500, amplitude: 150, freq: 1, phase: 0 };
    const deg = sineFlowTangentDeg(path, 0);
    expect(deg).not.toBe(0);
    expect(Number.isFinite(deg)).toBe(true);
  });
});
