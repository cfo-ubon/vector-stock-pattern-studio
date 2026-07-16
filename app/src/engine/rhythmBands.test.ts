import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createRhythmBands, rhythmSpacingMultiplier } from './rhythmBands';

describe('createRhythmBands', () => {
  it('is deterministic for the same seed', () => {
    const a = createRhythmBands(createRng('rhythm-1'));
    const b = createRhythmBands(createRng('rhythm-1'));
    expect(a).toEqual(b);
  });

  it('picks an integer frequency between 1 and 3', () => {
    for (let i = 0; i < 30; i++) {
      const bands = createRhythmBands(createRng(`rhythm-freq-${i}`));
      expect(Number.isInteger(bands.frequency)).toBe(true);
      expect(bands.frequency).toBeGreaterThanOrEqual(1);
      expect(bands.frequency).toBeLessThanOrEqual(3);
    }
  });

  it('picks an amplitude between 0.3 and 0.5', () => {
    for (let i = 0; i < 30; i++) {
      const bands = createRhythmBands(createRng(`rhythm-amp-${i}`));
      expect(bands.amplitude).toBeGreaterThanOrEqual(0.3);
      expect(bands.amplitude).toBeLessThanOrEqual(0.5);
    }
  });

  it('picks one of the three known axes', () => {
    for (let i = 0; i < 30; i++) {
      const bands = createRhythmBands(createRng(`rhythm-axis-${i}`));
      expect(['horizontal', 'vertical', 'diagonal']).toContain(bands.axis);
    }
  });
});

describe('rhythmSpacingMultiplier', () => {
  const tileSize = 1000;

  it('stays within [1 - amplitude, 1 + amplitude]', () => {
    for (let i = 0; i < 10; i++) {
      const bands = createRhythmBands(createRng(`rhythm-bounds-${i}`));
      for (let x = 0; x <= tileSize; x += 50) {
        for (let y = 0; y <= tileSize; y += 50) {
          const m = rhythmSpacingMultiplier(bands, x, y, tileSize);
          expect(m).toBeGreaterThanOrEqual(1 - bands.amplitude - 1e-9);
          expect(m).toBeLessThanOrEqual(1 + bands.amplitude + 1e-9);
        }
      }
    }
  });

  it('wraps seamlessly at the tile seam for every axis', () => {
    for (const axis of ['horizontal', 'vertical', 'diagonal'] as const) {
      const bands = { axis, frequency: 2, phase: 1.234, amplitude: 0.4 };
      for (let y = 0; y <= tileSize; y += 100) {
        const left = rhythmSpacingMultiplier(bands, 0, y, tileSize);
        const right = rhythmSpacingMultiplier(bands, tileSize, y, tileSize);
        expect(right).toBeCloseTo(left, 9);
      }
      for (let x = 0; x <= tileSize; x += 100) {
        const top = rhythmSpacingMultiplier(bands, x, 0, tileSize);
        const bottom = rhythmSpacingMultiplier(bands, x, tileSize, tileSize);
        expect(bottom).toBeCloseTo(top, 9);
      }
    }
  });

  it('produces both denser-than-1 and looser-than-1 regions across the tile', () => {
    const bands = createRhythmBands(createRng('rhythm-variation'));
    let sawDense = false;
    let sawLoose = false;
    for (let x = 0; x <= tileSize; x += 20) {
      for (let y = 0; y <= tileSize; y += 20) {
        const m = rhythmSpacingMultiplier(bands, x, y, tileSize);
        if (m < 0.9) sawDense = true;
        if (m > 1.1) sawLoose = true;
      }
    }
    expect(sawDense).toBe(true);
    expect(sawLoose).toBe(true);
  });
});
