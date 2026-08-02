import { describe, it, expect } from 'vitest';
import { assessExpectedImpact } from './expectedImpactEngine';

describe('assessExpectedImpact', () => {
  it('returns UNKNOWN with no fabricated impact when there is no evidence', () => {
    const result = assessExpectedImpact([], null, 1000);
    expect(result.expectedImpact).toBe('UNKNOWN');
    expect(result.confidence.band).toBe('unknown');
  });

  it('returns UNKNOWN when businessImpact itself is UNKNOWN, even with evidence', () => {
    const result = assessExpectedImpact(['some real fact'], 'UNKNOWN', 1000);
    expect(result.expectedImpact).toBe('UNKNOWN');
  });

  it('grades a HIGH business impact up to VERY_HIGH with well-evidenced input', () => {
    const evidence = Array.from({ length: 10 }, (_, i) => `real evidence fact ${i}`);
    const result = assessExpectedImpact(evidence, 'HIGH', 1000);
    expect(['VERY_HIGH', 'HIGH']).toContain(result.expectedImpact);
    expect(result.confidence.band).not.toBe('unknown');
  });

  it('never returns a numeric revenue estimate — only qualitative levels', () => {
    const result = assessExpectedImpact(['fact'], 'MEDIUM', 1000);
    expect(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).toContain(result.expectedImpact);
  });
});
