import { describe, it, expect } from 'vitest';
import { createCreativeBrief, isValidCreativeBrief, transitionCreativeBriefStatus, InvalidCreativeBriefInputError } from './creativeBrief';

describe('createCreativeBrief', () => {
  it('creates a well-shaped brief starting in DRAFT status', () => {
    const brief = createCreativeBrief({ collectionName: 'Spring Cottage Garden', theme: 'Botanical', now: 1000 });
    expect(brief.status).toBe('DRAFT');
    expect(brief.collectionSize).toBe(20);
    expect(brief.confidence).toBe('unknown');
    expect(isValidCreativeBrief(brief)).toBe(true);
  });

  it('rejects an empty collectionName', () => {
    expect(() => createCreativeBrief({ collectionName: '', theme: 'Botanical' })).toThrow(InvalidCreativeBriefInputError);
  });

  it('carries fieldRationale through unchanged', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Y', fieldRationale: { heroStyle: 'because Z' } });
    expect(brief.fieldRationale.heroStyle).toBe('because Z');
  });
});

describe('transitionCreativeBriefStatus', () => {
  it('moves a brief to APPROVED', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Y' });
    const approved = transitionCreativeBriefStatus(brief, 'APPROVED');
    expect(approved.status).toBe('APPROVED');
    expect(approved.id).toBe(brief.id);
  });

  it('rejects an unknown status', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Y' });
    expect(() => transitionCreativeBriefStatus(brief, 'NOT_A_STATUS' as never)).toThrow(InvalidCreativeBriefInputError);
  });
});
