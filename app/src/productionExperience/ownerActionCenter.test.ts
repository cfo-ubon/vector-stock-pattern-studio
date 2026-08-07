import { describe, it, expect } from 'vitest';
import { buildOwnerActionCenter } from './ownerActionCenter';
import { createOrchestrationRun, transitionOrchestrationRun } from '../factoryOrchestrator/orchestrationRun';

const NOW = 1_700_000_000_000;

describe('buildOwnerActionCenter', () => {
  it('hides everything when there is nothing requiring attention', () => {
    expect(buildOwnerActionCenter(null, 0, 0)).toEqual([]);
  });

  it('shows Approve Session only when the run is waiting for owner approval', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    const items = buildOwnerActionCenter(run, 0, 0);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('APPROVE_SESSION');
  });

  it('shows Approve Override with the real blocked reason when the run is BLOCKED', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'BLOCKED', NOW + 3, 'Repair backlog stuck.');
    const items = buildOwnerActionCenter(run, 0, 0);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('APPROVE_OVERRIDE');
    expect(items[0].detail).toBe('Repair backlog stuck.');
  });

  it('shows Review Images with the real count, never when count is zero', () => {
    expect(buildOwnerActionCenter(null, 4, 0)).toEqual([{ type: 'REVIEW_IMAGES', label: 'Review images', detail: '4 pattern(s) need a quick look before they can ship.', count: 4 }]);
    expect(buildOwnerActionCenter(null, 0, 0)).toEqual([]);
  });

  it('shows Export Packages with the real count, never when count is zero', () => {
    expect(buildOwnerActionCenter(null, 0, 2)).toEqual([{ type: 'EXPORT_PACKAGES', label: 'Export packages', detail: '2 package(s) are ready to export.', count: 2 }]);
  });

  it('shows all applicable items at once, never duplicating', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    const items = buildOwnerActionCenter(run, 3, 1);
    expect(items.map((i) => i.type)).toEqual(['APPROVE_SESSION', 'REVIEW_IMAGES', 'EXPORT_PACKAGES']);
  });
});
