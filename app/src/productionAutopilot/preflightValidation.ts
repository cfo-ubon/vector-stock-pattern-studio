import type { FactoryTask } from '../factory/domain/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { evaluateGenerationGate } from '../autopilot/generationGate';
import type { PreflightCheck, PreflightValidationResult } from './domain/types';

// Mission 4, Part 3 — Preflight Validation. "Never generate against
// Decision OS" is satisfied by literally reusing the real Decision OS
// gate (`autopilot/generationGate.ts`'s `evaluateGenerationGate`, Build
// 031B Hardening) — this file does not re-implement a second
// generate/don't-generate decision. Every other check here is a real,
// counted fact from the live Factory Queue — never an opinion.

/** `status` is `BLOCKED` only when a real BLOCKED task exists for this
 * check (something is genuinely stuck, not just waiting its turn),
 * `ATTENTION` when READY work exceeds the disclosed threshold, else
 * `OK` — never an invented judgment beyond these two real counts. */
function checkFor(name: string, readyCount: number, blockedCount: number, attentionThreshold: number, detail: string): PreflightCheck {
  const status = blockedCount > 0 ? 'BLOCKED' : readyCount >= attentionThreshold ? 'ATTENTION' : 'OK';
  return { name, status, count: readyCount + blockedCount, detail };
}

export function runPreflightValidation(tasks: FactoryTask[], portfolioAssets: PortfolioAsset[], qualitySnapshots: QualitySnapshot[], autonomousRuns: AutonomousDesignRun[], now: number = Date.now()): PreflightValidationResult {
  const readyBacklog = tasks.filter((t) => t.status === 'READY');
  const byTypeAndStatus = (type: FactoryTask['type'], status: FactoryTask['status']) => tasks.filter((t) => t.type === type && t.status === status).length;

  const checks: PreflightCheck[] = [
    checkFor('READY backlog', readyBacklog.length, 0, 10, `${readyBacklog.length} task(s) currently READY to run.`),
    checkFor('Unfinished Collections', byTypeAndStatus('collectionCompletion', 'READY'), byTypeAndStatus('collectionCompletion', 'BLOCKED'), 1, 'Collection Completion tasks outstanding.'),
    checkFor('Outstanding Repair', byTypeAndStatus('repair', 'READY'), byTypeAndStatus('repair', 'BLOCKED'), 1, 'Repair tasks outstanding.'),
    checkFor('Outstanding SEO', byTypeAndStatus('seo', 'READY'), byTypeAndStatus('seo', 'BLOCKED'), 1, 'SEO tasks outstanding.'),
    checkFor('Outstanding Packaging', byTypeAndStatus('package', 'READY'), byTypeAndStatus('package', 'BLOCKED'), 1, 'Packaging tasks outstanding.'),
    checkFor('Export Queue', byTypeAndStatus('exportValidation', 'READY'), byTypeAndStatus('exportValidation', 'BLOCKED'), 1, 'Export Validation tasks waiting.'),
  ];

  const gate = evaluateGenerationGate(portfolioAssets, qualitySnapshots, autonomousRuns, now);

  return {
    checks,
    shouldGenerate: gate.recommendGenerate,
    generateBlockedReason: gate.recommendGenerate ? null : gate.reason,
    decisionTrace: gate.decisionTrace,
    computedAt: now,
  };
}
