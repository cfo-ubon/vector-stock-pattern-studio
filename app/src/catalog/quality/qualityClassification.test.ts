import { describe, it, expect } from 'vitest';
import { classifyQuality } from './qualityClassification';

// Every case here is cross-checked against `build025Portfolio100.ts`'s
// own inline `classify()` — same inputs must produce the same outputs,
// since this module is an extraction, not a reinterpretation.

describe('classifyQuality', () => {
  it('REJECTs when commercialV2 < 40 regardless of other fields', () => {
    expect(classifyQuality({ commercialV2: 39, fragmented: false, deadSpace: false, beautyScore: 90 })).toBe('REJECT');
  });

  it('REJECTs when both fragmented and deadSpace are true, even with a passable score', () => {
    expect(classifyQuality({ commercialV2: 80, fragmented: true, deadSpace: true, beautyScore: 90 })).toBe('REJECT');
  });

  it('REVIEWs when commercialV2 is between 40 and 70', () => {
    expect(classifyQuality({ commercialV2: 55, fragmented: false, deadSpace: false, beautyScore: 90 })).toBe('REVIEW');
  });

  it('REVIEWs when fragmented alone is true (score otherwise high)', () => {
    expect(classifyQuality({ commercialV2: 85, fragmented: true, deadSpace: false, beautyScore: 90 })).toBe('REVIEW');
  });

  it('REVIEWs when deadSpace alone is true (score otherwise high)', () => {
    expect(classifyQuality({ commercialV2: 85, fragmented: false, deadSpace: true, beautyScore: 90 })).toBe('REVIEW');
  });

  it('REVIEWs when beautyScore < 55 even with a high commercial score', () => {
    expect(classifyQuality({ commercialV2: 85, fragmented: false, deadSpace: false, beautyScore: 54 })).toBe('REVIEW');
  });

  it('READYs when commercialV2 >= 70, no fragmentation/deadSpace, and beautyScore >= 55', () => {
    expect(classifyQuality({ commercialV2: 80.72, fragmented: false, deadSpace: false, beautyScore: 55 })).toBe('READY');
  });

  it('matches the exact boundary values (commercialV2=70, beautyScore=55)', () => {
    expect(classifyQuality({ commercialV2: 70, fragmented: false, deadSpace: false, beautyScore: 55 })).toBe('READY');
    expect(classifyQuality({ commercialV2: 69.99, fragmented: false, deadSpace: false, beautyScore: 55 })).toBe('REVIEW');
  });

  it('matches the exact boundary at commercialV2=40 (still REVIEW, not REJECT nor READY, since 40 < 70)', () => {
    expect(classifyQuality({ commercialV2: 40, fragmented: false, deadSpace: false, beautyScore: 55 })).toBe('REVIEW');
    expect(classifyQuality({ commercialV2: 39.99, fragmented: false, deadSpace: false, beautyScore: 55 })).toBe('REJECT');
  });
});
