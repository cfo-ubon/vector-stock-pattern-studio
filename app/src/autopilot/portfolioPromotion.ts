import type { AutonomousDesignRun } from './domain/autonomousDesignRun';
import { getPortfolioAsset, putPortfolioAsset } from '../catalog/storage/portfolioStore';
import type { WorkflowStatus } from '../catalog/domain/types';

// Build 029, Module 8 (the two named actions) + Module 10 (Portfolio
// traceability). Every generated item is already imported into the
// Portfolio catalog during generation (`generationOrchestrator.ts`,
// `workflowStatus: 'DRAFT'` — the same default every manual import gets).
// This module implements the spec's two promotion actions by reusing
// `PortfolioAsset.workflowStatus`'s EXISTING enum values — never a new
// status field, and never a silent delete of a REJECT item (Safety Rule
// #7): a REJECT decision is promoted to the real `'REJECTED'` workflow
// status, which keeps the asset (and its full lineage) in the catalog,
// visible and traceable.

const DECISION_TO_WORKFLOW_STATUS: Record<'READY' | 'REVIEW' | 'REJECT', WorkflowStatus> = {
  READY: 'READY_TO_UPLOAD',
  REVIEW: 'READY_FOR_REVIEW',
  REJECT: 'REJECTED',
};

export interface PromotionResult {
  promoted: string[];
  skipped: string[];
}

/** "นำ READY เข้า Portfolio" — promotes only READY items to
 * `READY_TO_UPLOAD`. REVIEW/REJECT items are left exactly as generation
 * left them (still `DRAFT`, still fully present in the catalog). */
export async function promoteReadyToPortfolio(run: AutonomousDesignRun): Promise<PromotionResult> {
  return promoteByDecision(run, ['READY']);
}

/** "นำทั้งหมดเข้า Portfolio พร้อมสถานะ" — promotes every generated item
 * (READY, REVIEW, and REJECT alike) to its honest matching workflow
 * status. No item is ever deleted or hidden. */
export async function promoteAllToPortfolioWithStatus(run: AutonomousDesignRun): Promise<PromotionResult> {
  return promoteByDecision(run, ['READY', 'REVIEW', 'REJECT']);
}

async function promoteByDecision(run: AutonomousDesignRun, decisions: Array<'READY' | 'REVIEW' | 'REJECT'>): Promise<PromotionResult> {
  const promoted: string[] = [];
  const skipped: string[] = [];
  for (const item of run.items) {
    if (!item.portfolioAssetId || !item.decision || !decisions.includes(item.decision)) {
      if (item.portfolioAssetId) skipped.push(item.portfolioAssetId);
      continue;
    }
    const asset = await getPortfolioAsset(item.portfolioAssetId);
    if (!asset) {
      skipped.push(item.portfolioAssetId);
      continue;
    }
    await putPortfolioAsset({ ...asset, workflowStatus: DECISION_TO_WORKFLOW_STATUS[item.decision], updatedAt: Date.now() });
    promoted.push(item.portfolioAssetId);
  }
  return { promoted, skipped };
}
