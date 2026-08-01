import type { PortfolioDiagnosis, PortfolioDiagnosisFinding, PortfolioDiagnosisVerdict } from './domain/types';
import { portfolioDiagnosisId } from './domain/id';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { DashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import { loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { loadQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import { loadAutonomousDesignRuns } from '../autopilot/storage/autonomousDesignRunStore';
import { loadDashboardSnapshot } from '../catalog/dashboard/portfolioDashboardService';
import { putPortfolioDiagnosis } from './storage/portfolioDiagnosisStore';
import { supportedCategoryIds } from '../autopilot/categoryInference';
import { runDecisionSync, recordDecision } from '../decisionOS/index';
import type { Decision } from '../decisionOS/domain/types';
import {
  categoryConcentrationContext,
  CATEGORY_CONCENTRATION_SOURCES,
  emptyCollectionsContext,
  EMPTY_COLLECTIONS_SOURCES,
  readyNotImportedContext,
  READY_NOT_IMPORTED_SOURCES,
  submissionPrepContext,
  SUBMISSION_PREP_SOURCES,
} from '../decisionOS/adapters/portfolioAdapter';
import { decisionTraceFrom } from './decisionTrace';

/** Build 031B Hardening — a finding plus the real Decision (if any) that
 * produced it, so `buildPortfolioDiagnosis` can persist every Decision-OS-
 * routed finding to the Decision Timeline without re-deriving it. */
interface FindingWithDecision {
  finding: PortfolioDiagnosisFinding;
  decision: Decision | null;
}

// Build 030 Part 2, Module 4 — Portfolio Doctor. Every finding below is a
// real join over real Build 026/029 data (Portfolio assets, QualitySnapshot,
// AutonomousDesignRun, the Dashboard Snapshot's own collectionAnalytics) —
// no new "is this oversupplied?" heuristic without a stated, user-adjustable
// threshold (`PortfolioDoctorPreferences.oversupplyShare`, per the spec's
// explicit "do not mark a category as oversupplied without a configurable
// or evidence-based rule" requirement).

export const DEFAULT_OVERSUPPLY_SHARE = 0.4;

export interface PortfolioDoctorPreferences {
  /** Share (0-1) of the Portfolio a single category must reach before it is
   * diagnosed UNBALANCED — user-configurable, defaults to 0.4 (40%). */
  oversupplyShare: number;
}

export function defaultPortfolioDoctorPreferences(): PortfolioDoctorPreferences {
  return { oversupplyShare: DEFAULT_OVERSUPPLY_SHARE };
}

export interface PortfolioDoctorInput {
  portfolioAssets: PortfolioAsset[];
  qualitySnapshots: QualitySnapshot[];
  autonomousRuns: AutonomousDesignRun[];
  dashboard: DashboardSnapshot;
  preferences: PortfolioDoctorPreferences;
  now: number;
}

function latestSnapshotByAsset(snapshots: QualitySnapshot[]): Map<string, QualitySnapshot> {
  const map = new Map<string, QualitySnapshot>();
  for (const s of [...snapshots].sort((a, b) => a.createdAt - b.createdAt)) map.set(s.assetId, s);
  return map;
}

/** Build 031B, Part 10 — the UNBALANCED-vs-HEALTHY threshold call is
 * delegated to the Decision OS's `portfolio.avoidOversaturation` policy
 * (`decisionOS/policies/portfolioPolicies.ts`) rather than the inline
 * `share >= preferences.oversupplyShare` check this function used to make
 * itself — the max-category/share math is still computed here (the
 * Decision OS never recomputes business data, only reasons about it), so
 * the finding's own wording and shape are unchanged. */
function categoryConcentrationFinding(assets: PortfolioAsset[], preferences: PortfolioDoctorPreferences, now: number): FindingWithDecision {
  if (assets.length === 0) {
    return {
      finding: {
        code: 'category-concentration',
        verdict: 'INSUFFICIENT_DATA',
        finding: 'No Portfolio assets exist yet — category balance cannot be evaluated.',
        evidence: 'Portfolio is empty.',
        affectedCount: 0,
        confidence: 'unknown',
        recommendedAction: 'Generate your first patterns to begin tracking category balance.',
        sendToAutopilotAction: null,
        decisionTrace: null,
      },
      decision: null,
    };
  }
  const counts = new Map<string, number>();
  for (const c of supportedCategoryIds()) counts.set(c, 0);
  for (const a of assets) if (a.presetId && counts.has(a.presetId)) counts.set(a.presetId, (counts.get(a.presetId) ?? 0) + 1);
  const [maxCategory, maxCount] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  const share = maxCount / assets.length;
  const decision = runDecisionSync(categoryConcentrationContext(maxCategory, maxCount, assets.length, preferences.oversupplyShare, now), CATEGORY_CONCENTRATION_SOURCES);
  const decisionTrace = decisionTraceFrom(decision);
  if (decision.recommendedAction === 'diversifyPortfolio') {
    return {
      finding: {
        code: 'category-concentration',
        verdict: 'UNBALANCED',
        finding: `"${maxCategory}" makes up ${Math.round(share * 100)}% of your Portfolio, at or above your configured ${Math.round(preferences.oversupplyShare * 100)}% oversupply threshold.`,
        evidence: `${maxCount} of ${assets.length} Portfolio assets are "${maxCategory}".`,
        affectedCount: maxCount,
        confidence: 'high',
        recommendedAction: 'Diversify into a less-covered category.',
        sendToAutopilotAction: { mode: 'PORTFOLIO_GAP', requestedCount: 10, productionGoal: 'portfolioExpansion' },
        decisionTrace,
      },
      decision,
    };
  }
  return {
    finding: {
      code: 'category-concentration',
      verdict: 'HEALTHY',
      finding: `No category reaches your configured ${Math.round(preferences.oversupplyShare * 100)}% oversupply threshold.`,
      evidence: `Largest category "${maxCategory}" is ${Math.round(share * 100)}% of the Portfolio.`,
      affectedCount: maxCount,
      confidence: 'high',
      recommendedAction: 'No action needed.',
      sendToAutopilotAction: null,
      decisionTrace,
    },
    decision,
  };
}

/** Build 031B Hardening — the empty-vs-non-empty verdict is delegated to
 * the Decision OS's `portfolio.preferCollectionDiversity` policy, which
 * fires on the identical `count > 0` condition this function used to check
 * itself, so behavior is unchanged. */
function emptyCollectionsFinding(dashboard: DashboardSnapshot, now: number): FindingWithDecision {
  const count = dashboard.collectionAnalytics.emptyCollections.length;
  const decision = runDecisionSync(emptyCollectionsContext(count, now), EMPTY_COLLECTIONS_SOURCES);
  const decisionTrace = decisionTraceFrom(decision);
  if (decision.recommendedAction !== 'fillEmptyCollections') {
    return { finding: { code: 'empty-collections', verdict: 'HEALTHY', finding: 'No empty collections found.', evidence: '0 collections with zero assigned patterns.', affectedCount: 0, confidence: 'high', recommendedAction: 'No action needed.', sendToAutopilotAction: null, decisionTrace }, decision };
  }
  return {
    finding: {
      code: 'empty-collections',
      verdict: 'NEEDS_ATTENTION',
      finding: `${count} collection(s) have no patterns assigned.`,
      evidence: `${count} empty collection(s).`,
      affectedCount: count,
      confidence: 'high',
      recommendedAction: 'Fill or archive empty collections.',
      sendToAutopilotAction: { mode: 'SELLABLE_COLLECTION', requestedCount: 10, productionGoal: 'collection' },
      decisionTrace,
    },
    decision,
  };
}

/** Build 031B Hardening — not one of the spec's 6 named Portfolio Doctor
 * Decision OS ownership items (oversaturation / category gap / duplication
 * concern / incomplete collection / ready-not-imported / not-packaged), and
 * its 30%-rate threshold has no matching policy (the closest policy,
 * `factory.repairBeforeGenerate`, fires on any nonzero count — a different,
 * non-equivalent threshold). Left as local business logic rather than
 * delegated under a policy that would silently change its behavior; see
 * `BUILD_031B_LOGIC_MIGRATION_AUDIT.md`. */
function reviewRejectFinding(assets: PortfolioAsset[], snapshots: QualitySnapshot[]): FindingWithDecision {
  const latest = latestSnapshotByAsset(snapshots);
  const assetIds = new Set(assets.map((a) => a.assetId));
  let review = 0;
  let reject = 0;
  let total = 0;
  for (const [assetId, snap] of latest) {
    if (!assetIds.has(assetId)) continue;
    total++;
    if (snap.decision === 'REVIEW') review++;
    if (snap.decision === 'REJECT') reject++;
  }
  if (total === 0) {
    return {
      finding: {
        code: 'review-reject-rate',
        verdict: 'INSUFFICIENT_DATA',
        finding: 'No quality-evaluated Portfolio assets exist yet.',
        evidence: 'No QualitySnapshot record references an existing Portfolio asset.',
        affectedCount: 0,
        confidence: 'unknown',
        recommendedAction: 'Generate and evaluate patterns to begin tracking quality outcomes.',
        sendToAutopilotAction: null,
        decisionTrace: null,
      },
      decision: null,
    };
  }
  const rate = (review + reject) / total;
  const verdict: PortfolioDiagnosisVerdict = rate > 0.3 ? 'NEEDS_ATTENTION' : 'HEALTHY';
  return {
    finding: {
      code: 'review-reject-rate',
      verdict,
      finding: `${Math.round(rate * 100)}% of quality-evaluated Portfolio assets are REVIEW or REJECT.`,
      evidence: `${review} REVIEW, ${reject} REJECT, out of ${total} evaluated.`,
      affectedCount: review + reject,
      confidence: 'high',
      recommendedAction: verdict === 'NEEDS_ATTENTION' ? 'Review REVIEW/REJECT items before producing more of the same category.' : 'No action needed.',
      sendToAutopilotAction: null,
      decisionTrace: null,
    },
    decision: null,
  };
}

/** Build 031B Hardening — delegated to `factory.completeExistingWorkFirst`,
 * which fires on the identical `readyNotImportedCount > 0` condition (the
 * adapter always supplies `resumableRunCount: 0` for this finding, so the
 * policy's other trigger never contributes here) this function used to
 * check itself. */
function readyNotImportedFinding(runs: AutonomousDesignRun[], now: number): FindingWithDecision {
  let count = 0;
  for (const run of runs) {
    for (const item of run.items) {
      if (item.decision === 'READY' && item.portfolioAssetId === null) count++;
    }
  }
  const decision = runDecisionSync(readyNotImportedContext(count, now), READY_NOT_IMPORTED_SOURCES);
  const decisionTrace = decisionTraceFrom(decision);
  if (decision.recommendedAction !== 'resumeExistingWork') {
    return { finding: { code: 'ready-not-imported', verdict: 'HEALTHY', finding: 'No generated READY items are waiting to be added to your Portfolio.', evidence: '0 un-imported READY items.', affectedCount: 0, confidence: 'high', recommendedAction: 'No action needed.', sendToAutopilotAction: null, decisionTrace }, decision };
  }
  return {
    finding: {
      code: 'ready-not-imported',
      verdict: 'NEEDS_ATTENTION',
      finding: `${count} generated pattern(s) passed quality review as READY but are not yet in your Portfolio.`,
      evidence: `${count} un-imported READY item(s) across your Autopilot runs.`,
      affectedCount: count,
      confidence: 'high',
      recommendedAction: 'Import READY items into your Portfolio from Autopilot History.',
      sendToAutopilotAction: null,
      decisionTrace,
    },
    decision,
  };
}

/** Build 031B Hardening — delegated to `portfolio.completeSubmissionPrep`,
 * which fires on the identical `count > 0` condition (assets still in
 * DRAFT/READY_FOR_REVIEW) this function used to check itself. */
function notPreparedForSubmissionFinding(assets: PortfolioAsset[], now: number): FindingWithDecision {
  if (assets.length === 0) {
    return {
      finding: { code: 'not-prepared-for-submission', verdict: 'INSUFFICIENT_DATA', finding: 'No Portfolio assets exist yet.', evidence: 'Portfolio is empty.', affectedCount: 0, confidence: 'unknown', recommendedAction: 'Generate your first patterns.', sendToAutopilotAction: null, decisionTrace: null },
      decision: null,
    };
  }
  const notPrepared = assets.filter((a) => a.workflowStatus === 'DRAFT' || a.workflowStatus === 'READY_FOR_REVIEW');
  const decision = runDecisionSync(submissionPrepContext(notPrepared.length, assets.length, now), SUBMISSION_PREP_SOURCES);
  const decisionTrace = decisionTraceFrom(decision);
  if (decision.recommendedAction !== 'completeSubmissionPrep') {
    return {
      finding: { code: 'not-prepared-for-submission', verdict: 'HEALTHY', finding: 'Every Portfolio asset has been prepared beyond the draft/review stage.', evidence: `0 of ${assets.length} assets are in DRAFT or READY_FOR_REVIEW.`, affectedCount: 0, confidence: 'high', recommendedAction: 'No action needed.', sendToAutopilotAction: null, decisionTrace },
      decision,
    };
  }
  return {
    finding: {
      code: 'not-prepared-for-submission',
      verdict: 'NEEDS_ATTENTION',
      finding: `${notPrepared.length} of ${assets.length} Portfolio asset(s) are not yet prepared for submission.`,
      evidence: `${notPrepared.length} assets are in DRAFT or READY_FOR_REVIEW.`,
      affectedCount: notPrepared.length,
      confidence: 'high',
      recommendedAction: 'Complete SEO/metadata and move these toward READY_TO_UPLOAD.',
      sendToAutopilotAction: null,
      decisionTrace,
    },
    decision,
  };
}

/** UNBALANCED always wins (most severe, real evidence of concentration).
 * Otherwise, if most findings could not be evaluated at all (e.g. an empty
 * Portfolio, where "0 empty collections" is trivially HEALTHY but tells
 * the user nothing useful), the honest overall read is INSUFFICIENT_DATA
 * rather than a misleadingly confident HEALTHY. */
function overallVerdictFrom(findings: PortfolioDiagnosisFinding[]): PortfolioDiagnosisVerdict {
  if (findings.some((f) => f.verdict === 'UNBALANCED')) return 'UNBALANCED';
  const insufficientCount = findings.filter((f) => f.verdict === 'INSUFFICIENT_DATA').length;
  if (insufficientCount * 2 >= findings.length) return 'INSUFFICIENT_DATA';
  if (findings.some((f) => f.verdict === 'NEEDS_ATTENTION')) return 'NEEDS_ATTENTION';
  return 'HEALTHY';
}

/** Build 031B Hardening (Section 7) — `async` so every Decision-OS-routed
 * finding's real Decision can be awaited into the Decision Timeline before
 * the diagnosis is returned, keeping every visible verdict traceable. */
export async function buildPortfolioDiagnosis(input: PortfolioDoctorInput): Promise<PortfolioDiagnosis> {
  const withDecisions = [
    categoryConcentrationFinding(input.portfolioAssets, input.preferences, input.now),
    emptyCollectionsFinding(input.dashboard, input.now),
    reviewRejectFinding(input.portfolioAssets, input.qualitySnapshots),
    readyNotImportedFinding(input.autonomousRuns, input.now),
    notPreparedForSubmissionFinding(input.portfolioAssets, input.now),
  ];
  await Promise.all(withDecisions.filter((w) => w.decision !== null).map((w) => recordDecision(w.decision as Decision)));
  const findings = withDecisions.map((w) => w.finding);
  return { id: portfolioDiagnosisId.generate(input.now), createdAt: input.now, overallVerdict: overallVerdictFrom(findings), findings, schemaVersion: 1 };
}

export async function generateAndSavePortfolioDiagnosis(preferences: PortfolioDoctorPreferences = defaultPortfolioDoctorPreferences(), now: number = Date.now()): Promise<PortfolioDiagnosis> {
  const [portfolioAssets, qualitySnapshots, autonomousRuns, dashboard] = await Promise.all([
    loadPortfolioAssets(),
    loadQualitySnapshots(),
    loadAutonomousDesignRuns(),
    loadDashboardSnapshot(),
  ]);
  const diagnosis = await buildPortfolioDiagnosis({ portfolioAssets, qualitySnapshots, autonomousRuns, dashboard, preferences, now });
  await putPortfolioDiagnosis(diagnosis);
  return diagnosis;
}
