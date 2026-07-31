import { describe, it, expect } from 'vitest';
import { emptyAutopilotConstraints, detectConstraintConflicts } from './constraints';

describe('detectConstraintConflicts', () => {
  it('reports no conflicts for empty constraints', () => {
    expect(detectConstraintConflicts(emptyAutopilotConstraints(), ['botanical', 'geometric'])).toEqual([]);
  });

  it('detects excluding every available category, and proposes removing the last exclusion', () => {
    const constraints = { ...emptyAutopilotConstraints(), excludeCategoryIds: ['botanical', 'geometric'] };
    const conflicts = detectConstraintConflicts(constraints, ['botanical', 'geometric']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe('excludeCategoryIds');
    expect(conflicts[0].suggestedResolution).toContain('geometric');
  });

  it('does not flag a conflict when at least one category remains', () => {
    const constraints = { ...emptyAutopilotConstraints(), excludeCategoryIds: ['botanical'] };
    expect(detectConstraintConflicts(constraints, ['botanical', 'geometric'])).toEqual([]);
  });

  it('detects the same palette family set as both preferred and avoided', () => {
    const constraints = { ...emptyAutopilotConstraints(), preferredPaletteFamily: 'pastel', avoidedPaletteFamily: 'pastel' };
    const conflicts = detectConstraintConflicts(constraints, ['botanical']);
    expect(conflicts.some((c) => c.field === 'preferredPaletteFamily')).toBe(true);
  });

  it('detects a non-positive maxQuantity', () => {
    const constraints = { ...emptyAutopilotConstraints(), maxQuantity: 0 };
    const conflicts = detectConstraintConflicts(constraints, ['botanical']);
    expect(conflicts.some((c) => c.field === 'maxQuantity')).toBe(true);
  });
});
