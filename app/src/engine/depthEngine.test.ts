import { describe, it, expect } from 'vitest';
import { applyDepthColorShift } from './depthEngine';

const COLORS = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438'];

describe('applyDepthColorShift (Build 010, Section 3: Multi-layer Depth Engine)', () => {
  it('is a strict no-op (same reference) when strength is 0', () => {
    expect(applyDepthColorShift(COLORS, 'filler', 0)).toBe(COLORS);
  });

  it('is a strict no-op (same reference) when strength is negative', () => {
    expect(applyDepthColorShift(COLORS, 'accent', -1)).toBe(COLORS);
  });

  it('is a strict no-op (same reference) for hero role', () => {
    expect(applyDepthColorShift(COLORS, 'hero', 1)).toBe(COLORS);
  });

  it('is a strict no-op (same reference) for secondary role', () => {
    expect(applyDepthColorShift(COLORS, 'secondary', 1)).toBe(COLORS);
  });

  it('is a strict no-op (same reference) for an undefined role', () => {
    expect(applyDepthColorShift(COLORS, undefined, 1)).toBe(COLORS);
  });

  it('is a strict no-op with fewer than 2 colors', () => {
    expect(applyDepthColorShift(['#ffffff'], 'filler', 1)).toEqual(['#ffffff']);
  });

  it('leaves the background color (index 0) untouched for filler/accent', () => {
    const result = applyDepthColorShift(COLORS, 'filler', 1);
    expect(result[0]).toBe(COLORS[0]);
  });

  it('blends filler colors toward the background at strength 1', () => {
    const result = applyDepthColorShift(COLORS, 'filler', 1);
    expect(result[1]).not.toBe(COLORS[1]);
    expect(result[2]).not.toBe(COLORS[2]);
    expect(result[3]).not.toBe(COLORS[3]);
  });

  it('accent recedes further than filler at the same strength', () => {
    const fillerResult = applyDepthColorShift(COLORS, 'filler', 1);
    const accentResult = applyDepthColorShift(COLORS, 'accent', 1);
    // Distance from original color should be greater for accent (its
    // recede factor is higher) -- measured via a simple hex-channel diff.
    const channelDiff = (hex: string, other: string) => {
      const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const [ar, ag, ab] = p(hex);
      const [br, bg, bb] = p(other);
      return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
    };
    const fillerDiff = channelDiff(fillerResult[1], COLORS[1]);
    const accentDiff = channelDiff(accentResult[1], COLORS[1]);
    expect(accentDiff).toBeGreaterThan(fillerDiff);
  });

  it('a smaller strength blends less than a larger one', () => {
    const weak = applyDepthColorShift(COLORS, 'accent', 0.2);
    const strong = applyDepthColorShift(COLORS, 'accent', 1);
    const channelDiff = (hex: string, other: string) => {
      const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const [ar, ag, ab] = p(hex);
      const [br, bg, bb] = p(other);
      return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
    };
    expect(channelDiff(weak[1], COLORS[1])).toBeLessThan(channelDiff(strong[1], COLORS[1]));
  });

  it('clamps strength above 1 the same as exactly 1', () => {
    const clamped = applyDepthColorShift(COLORS, 'filler', 5);
    const atOne = applyDepthColorShift(COLORS, 'filler', 1);
    expect(clamped).toEqual(atOne);
  });

  it('is deterministic and pure (does not mutate the input array)', () => {
    const snapshot = [...COLORS];
    applyDepthColorShift(COLORS, 'accent', 0.5);
    expect(COLORS).toEqual(snapshot);
  });
});
