import { describe, it, expect } from 'vitest';
import { layoutEvaluationClass, LAYOUT_EVALUATION_CLASS_LABELS } from './layoutEvaluation';
import { REGULAR_LATTICE_LAYOUTS } from './hierarchy';
import type { LayoutId } from './types';

const ALL_LAYOUTS: LayoutId[] = [
  'grid', 'brick', 'radial', 'scatter', 'halfDrop', 'heroFlow', 'heroScatter',
  'sCurve', 'bouquet', 'airy', 'toss', 'densePremium', 'gridMinimal', 'stripe',
];

describe('layoutEvaluationClass', () => {
  it('classifies every REGULAR_LATTICE_LAYOUTS member as lattice', () => {
    for (const id of REGULAR_LATTICE_LAYOUTS) {
      expect(layoutEvaluationClass(id as LayoutId)).toBe('lattice');
    }
  });

  it('classifies every non-lattice LayoutId as organic', () => {
    for (const id of ALL_LAYOUTS) {
      if (REGULAR_LATTICE_LAYOUTS.has(id)) continue;
      expect(layoutEvaluationClass(id)).toBe('organic');
    }
  });

  it('covers every real LayoutId with exactly one of the two classes', () => {
    for (const id of ALL_LAYOUTS) {
      expect(['lattice', 'organic']).toContain(layoutEvaluationClass(id));
    }
  });

  it('has a label for every class', () => {
    expect(LAYOUT_EVALUATION_CLASS_LABELS.lattice).toBeTruthy();
    expect(LAYOUT_EVALUATION_CLASS_LABELS.organic).toBeTruthy();
  });
});
