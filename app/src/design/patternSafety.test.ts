import { describe, it, expect } from 'vitest';
import { hasSeamBreakRisk } from './patternSafety';
import { evaluateDesign } from './designEvaluation';
import { defaultParams } from '../engine/defaults';

describe('hasSeamBreakRisk', () => {
  it('is false for a real, normally-generated evaluation with no cornerDeadZone problem detected', () => {
    // A real evaluation from the real engine -- not asserting a specific
    // score, only that when the real detector finds no cornerDeadZone
    // problem, this predicate reports no risk (never a false positive).
    const evaluation = evaluateDesign({ ...defaultParams(), seed: 'safety-clean-seed' });
    expect(evaluation.problems.some((p) => p.id === 'cornerDeadZone')).toBe(false);
    expect(hasSeamBreakRisk(evaluation)).toBe(false);
  });

  it('is true when a cornerDeadZone problem is present in the evaluation', () => {
    const base = evaluateDesign({ ...defaultParams(), seed: 'safety-fixture-seed' });
    const withCornerRisk = {
      ...base,
      problems: [...base.problems, { id: 'cornerDeadZone', label: 'the tile-corner junction is noticeably empty or crowded when repeated', points: 8, severity: 'low' as const }],
    };
    expect(hasSeamBreakRisk(withCornerRisk)).toBe(true);
  });

  it('is unaffected by other, unrelated problems being present', () => {
    const base = evaluateDesign({ ...defaultParams(), seed: 'safety-other-seed' });
    const withOtherProblem = {
      ...base,
      problems: [...base.problems, { id: 'quadrantImbalance', label: 'quadrant imbalance is severe', points: 8, severity: 'low' as const }],
    };
    expect(hasSeamBreakRisk(withOtherProblem)).toBe(false);
  });
});
