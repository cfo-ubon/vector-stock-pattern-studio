import type { OrchestrationRun } from '../factoryOrchestrator/domain/types';

// Mission 6, Part 4 — Owner Action Center. Shows only real actions
// requiring owner attention right now — never a status item with
// nothing to do. Every item's count comes from real, already-computed
// state (the run's own status, the Review Workspace's real REVIEW count,
// the Export Readiness Dashboard's real "ready" bucket count) — no new
// decision logic, this module only filters and labels.

export const OWNER_ACTION_TYPE_VALUES = ['APPROVE_SESSION', 'APPROVE_OVERRIDE', 'REVIEW_IMAGES', 'EXPORT_PACKAGES'] as const;
export type OwnerActionType = (typeof OWNER_ACTION_TYPE_VALUES)[number];

export interface OwnerActionItem {
  type: OwnerActionType;
  label: string;
  detail: string;
  count: number;
}

export function buildOwnerActionCenter(run: OrchestrationRun | null, reviewWaitingCount: number, exportReadyCount: number): OwnerActionItem[] {
  const items: OwnerActionItem[] = [];

  if (run?.status === 'WAITING_OWNER_APPROVAL') {
    items.push({
      type: 'APPROVE_SESSION',
      label: "Approve today's production session",
      detail: "The factory has planned today's work and is waiting for your approval to start.",
      count: 1,
    });
  }

  if (run?.status === 'BLOCKED') {
    items.push({
      type: 'APPROVE_OVERRIDE',
      label: 'Review a blocked factory run',
      detail: run.blockedReason ?? 'The factory stopped and needs your decision.',
      count: 1,
    });
  }

  if (reviewWaitingCount > 0) {
    items.push({
      type: 'REVIEW_IMAGES',
      label: 'Review images',
      detail: `${reviewWaitingCount} pattern(s) need a quick look before they can ship.`,
      count: reviewWaitingCount,
    });
  }

  if (exportReadyCount > 0) {
    items.push({
      type: 'EXPORT_PACKAGES',
      label: 'Export packages',
      detail: `${exportReadyCount} package(s) are ready to export.`,
      count: exportReadyCount,
    });
  }

  return items;
}
