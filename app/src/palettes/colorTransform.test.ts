import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, adjustLightness, adjustSaturation, rotateHue, setLightness, setHue } from './colorTransform';

describe('hexToHsl / hslToHex round-trip', () => {
  it('round-trips a set of real palette colors within 1% per channel', () => {
    const samples = ['#FFF6EC', '#FF3366', '#264D73', '#101820', '#7A2048', '#00C2A8'];
    for (const hex of samples) {
      const hsl = hexToHsl(hex);
      const back = hslToHex(hsl);
      const back2 = hexToHsl(back);
      expect(Math.abs(back2.h - hsl.h)).toBeLessThanOrEqual(2);
      expect(Math.abs(back2.s - hsl.s)).toBeLessThanOrEqual(2);
      expect(Math.abs(back2.l - hsl.l)).toBeLessThanOrEqual(2);
    }
  });

  it('pure white is 0% saturation, 100% lightness', () => {
    const hsl = hexToHsl('#FFFFFF');
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(100);
  });

  it('pure black is 0% saturation, 0% lightness', () => {
    const hsl = hexToHsl('#000000');
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it('pure red is hue 0, full saturation, 50% lightness', () => {
    const hsl = hexToHsl('#FF0000');
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });
});

describe('adjustLightness', () => {
  it('increases lightness by the given percent', () => {
    const base = hexToHsl('#808080');
    const lighter = hexToHsl(adjustLightness('#808080', 20));
    expect(lighter.l).toBeGreaterThan(base.l);
  });

  it('clamps at 100% lightness rather than overflowing', () => {
    const result = adjustLightness('#FFFFFF', 50);
    expect(hexToHsl(result).l).toBe(100);
  });

  it('clamps at 0% lightness rather than going negative', () => {
    const result = adjustLightness('#000000', -50);
    expect(hexToHsl(result).l).toBe(0);
  });
});

describe('adjustSaturation', () => {
  it('decreases saturation toward gray', () => {
    const base = hexToHsl('#FF3366');
    const muted = hexToHsl(adjustSaturation('#FF3366', -40));
    expect(muted.s).toBeLessThan(base.s);
  });

  it('clamps at 0% saturation', () => {
    const result = adjustSaturation('#FF3366', -1000);
    expect(hexToHsl(result).s).toBe(0);
  });
});

describe('rotateHue', () => {
  it('shifts hue by the given degrees, wrapping at 360', () => {
    const base = hexToHsl('#FF0000'); // hue 0
    const rotated = hexToHsl(rotateHue('#FF0000', 350));
    expect(rotated.h).toBe((base.h + 350) % 360);
  });

  it('a full 360-degree rotation is equivalent to no rotation', () => {
    expect(rotateHue('#3366CC', 360)).toBe(rotateHue('#3366CC', 0));
  });
});

describe('setLightness / setHue', () => {
  it('setLightness overrides regardless of the starting value', () => {
    expect(hexToHsl(setLightness('#101820', 80)).l).toBe(80);
    expect(hexToHsl(setLightness('#F0F0F0', 80)).l).toBe(80);
  });

  it('setHue overrides regardless of the starting hue, preserving saturation/lightness', () => {
    const original = hexToHsl('#FF3366');
    const result = hexToHsl(setHue('#FF3366', 200));
    expect(result.h).toBe(200);
    expect(Math.abs(result.s - original.s)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.l - original.l)).toBeLessThanOrEqual(1);
  });
});
