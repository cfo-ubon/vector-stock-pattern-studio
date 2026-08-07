import type { PortfolioAsset } from '../catalog/domain/types';
import type { CreativeBrief } from '../design-director/domain/creativeBrief';
import type { CollectionPlan } from '../design-director/domain/collectionPlan';
import { getCollectionPlanItems, markCollectionPlanItemStatus } from '../design-director/domain/collectionPlan';
import { putCollectionPlan } from '../design-director/storage/collectionPlanStore';
import type { MarketOpportunity } from '../marketing/domain/marketOpportunity';
import { buildGeneratorHandoffApplication, applyMappedFieldsToParams } from '../design-director/handoff/applyGeneratorHandoff';
import { defaultParams } from '../engine/defaults';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { importFileGroup, type ImportOutcome } from '../catalog/import/importPipeline';
import type { FileGroup } from '../catalog/import/basenameGrouping';
import { putPortfolioAsset } from '../catalog/storage/portfolioStore';
import { createQualitySnapshot, putQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { transitionAutonomousDesignRun, type AutonomousDesignRun, type AutonomousRunItemState } from './domain/autonomousDesignRun';
import { buildAutonomousGeneratorHandoff } from './roleGeneratorHandoff';
import { generateWithBoundedRepair } from './qualityEvaluation';

// Build 029, Module 6, steps 6-12 — One-Click Generation. Sequential
// (never parallel — the same reason `batch/batchProductionService.ts`'s
// own loop is sequential: each item's duplicate check must see every asset
// already imported earlier in this same run), reusing every real,
// verified primitive already in the codebase: `buildGeneratorHandoffApplication`
// + `applyMappedFieldsToParams` (Build 028B/028C's own handoff-to-
// GenerateParams mapping — never a second, parallel mapping), the same
// `buildSingleTileSvg`/`importFileGroup` File-group construction
// `batchProductionService.ts` uses (so a batch item and an autopilot item
// get identical duplicate-detection/persistence, never a second policy),
// and `qualityEvaluation.ts`'s bounded repair. Progress is persisted after
// EVERY item (`persistRun`), never only at the end — a reload mid-run can
// resume from `run.resumeFromIndex` (Module 6's "continue safely after
// application reload"), and the AbortSignal is checked only at the TOP of
// each loop iteration (Build 028B Hardening's proven approach) — an
// in-flight item always finishes and is counted, satisfying "never discard
// completed patterns if a later pattern fails."

export type GenerationStage = 'generating' | 'evaluating' | 'importing';

export interface GenerationProgressEvent {
  run: AutonomousDesignRun;
  itemLabel: string;
  stage: GenerationStage;
  itemIndex: number;
  totalItems: number;
}

export interface RunAutonomousGenerationInput {
  run: AutonomousDesignRun;
  brief: CreativeBrief;
  plan: CollectionPlan;
  opportunity: MarketOpportunity | null;
  existingAssets: PortfolioAsset[];
  /** Cancel — checked at the top of each loop iteration only (proven Build
   * 028B Hardening approach). Transitions the run to CANCELLED and sets
   * `cancelledAt`; never leaves a half-written item. */
  signal?: AbortSignal;
  /** Pause — a softer stop than cancel: transitions to PAUSED (not
   * CANCELLED), preserving `resumeFromIndex` so a later call with a fresh
   * `signal` continues exactly where this one left off. */
  shouldPause?: () => boolean;
  /** Called after every item completes (success or error) so progress is
   * durably saved before the next item starts — never only at the end. */
  persistRun: (run: AutonomousDesignRun) => Promise<void>;
  onProgress?: (event: GenerationProgressEvent) => void;
}

/** Runs (or resumes) generation for every remaining Collection Plan Item.
 * Returns the final run state — COMPLETED, PAUSED, or CANCELLED. Never
 * throws for a single item's failure (duplicate/import error) — that item
 * is recorded with a real `error` and the run continues to the next item;
 * only a truly unrecoverable condition (e.g. no frozen Design Plan) throws. */
export async function runAutonomousGeneration(input: RunAutonomousGenerationInput): Promise<AutonomousDesignRun> {
  const { brief, plan, opportunity, signal, shouldPause, persistRun, onProgress } = input;
  let run = input.run;
  if (!run.designPlan) throw new Error('Cannot generate for a run with no frozen Design Plan.');
  if (run.status !== 'GENERATING') throw new Error(`Cannot generate for a run in status ${run.status} — must be GENERATING.`);
  const designPlan = run.designPlan;

  const items = getCollectionPlanItems(plan);
  const knownAssets = [...input.existingAssets];

  for (let i = run.resumeFromIndex; i < items.length; i++) {
    if (signal?.aborted) {
      run = transitionAutonomousDesignRun({ ...run, cancelledAt: Date.now() }, 'CANCELLED', Date.now(), `Cancelled after ${run.completedCount}/${run.requestedCount} patterns.`);
      await persistRun(run);
      return run;
    }
    if (shouldPause?.()) {
      run = transitionAutonomousDesignRun(run, 'PAUSED', Date.now(), `Paused after ${run.completedCount}/${run.requestedCount} patterns.`);
      await persistRun(run);
      return run;
    }

    const item = items[i];
    onProgress?.({ run, itemLabel: item.label, stage: 'generating', itemIndex: i, totalItems: items.length });

    const handoff = buildAutonomousGeneratorHandoff(brief.id, plan.id, item, designPlan);
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, opportunity);
    const lineage = { ...application.lineage, autonomousDesignRunId: run.id };
    const seed = `${handoff.seedStrategy}-${i}`;
    const baseParams = { ...applyMappedFieldsToParams(defaultParams(), application.mappedFields, lineage), seed };

    onProgress?.({ run, itemLabel: item.label, stage: 'evaluating', itemIndex: i, totalItems: items.length });
    const { tileData, evaluation, attempts } = generateWithBoundedRepair(baseParams, (attempt) => `${seed}-repair${attempt}`);

    onProgress?.({ run, itemLabel: item.label, stage: 'importing', itemIndex: i, totalItems: items.length });
    const svgText = buildSingleTileSvg(tileData);
    const baseName = buildExportFilename(buildFilenameParts(tileData.params), tileData.params.seed).replace(/\.svg$/i, '');
    const svgFile = new File([svgText], `${baseName}.svg`, { type: 'image/svg+xml' });
    const jsonFile = new File([JSON.stringify(tileData.params)], `${baseName}.json`, { type: 'application/json' });
    const group: FileGroup<File> = { basename: baseName, files: [svgFile, jsonFile] };
    const outcome: ImportOutcome = await importFileGroup(group, knownAssets, {
      generatorVersion: handoff.generatorVersion,
      displayName: `${buildFilenameParts(tileData.params).slice(0, 2).join(' ')} pattern`,
    });

    const itemState = await recordItemOutcome(outcome, evaluation, item.id, handoff.id, handoff.generatorVersion, attempts, knownAssets);

    if (outcome.status === 'imported') {
      await putCollectionPlan(markCollectionPlanItemStatus(plan, item.id, 'generated'));
    }

    run = {
      ...run,
      items: [...run.items, itemState],
      completedCount: run.completedCount + 1,
      readyCount: run.readyCount + (itemState.decision === 'READY' ? 1 : 0),
      reviewCount: run.reviewCount + (itemState.decision === 'REVIEW' ? 1 : 0),
      rejectCount: run.rejectCount + (itemState.decision === 'REJECT' ? 1 : 0),
      resumeFromIndex: i + 1,
      updatedAt: Date.now(),
      errors: itemState.error ? [...run.errors, itemState.error] : run.errors,
    };
    await persistRun(run);
  }

  run = transitionAutonomousDesignRun(run, 'COMPLETED', Date.now(), `${run.completedCount}/${run.requestedCount} patterns generated — ${run.readyCount} READY, ${run.reviewCount} REVIEW, ${run.rejectCount} REJECT.`);
  await persistRun(run);
  return run;
}

async function recordItemOutcome(
  outcome: ImportOutcome,
  evaluation: ReturnType<typeof generateWithBoundedRepair>['evaluation'],
  collectionItemId: string,
  generatorHandoffId: string,
  generatorVersion: string,
  attempts: number,
  knownAssets: PortfolioAsset[],
): Promise<AutonomousRunItemState> {
  if (outcome.status !== 'imported') {
    const message = outcome.status === 'error' ? outcome.message : `Duplicate detected (${outcome.status}) — not imported.`;
    return { collectionItemId, generatorHandoffId, portfolioAssetId: null, qualitySnapshotId: null, decision: null, repairAttempts: attempts, error: message, completedAt: Date.now() };
  }

  knownAssets.push(outcome.asset);
  const snapshot = createQualitySnapshot({
    assetId: outcome.asset.assetId,
    beautyScore: evaluation.beautyReview.beautyScore,
    commercialScore: evaluation.commercialScore,
    thumbnailScore: evaluation.thumbnailScore,
    fragmented: evaluation.fragmented,
    deadSpace: evaluation.deadSpace,
    decision: evaluation.decision,
    generatorVersion,
  });
  await putQualitySnapshot(snapshot);
  await putPortfolioAsset({ ...outcome.asset, qualitySnapshotId: snapshot.snapshotId });

  return {
    collectionItemId,
    generatorHandoffId,
    portfolioAssetId: outcome.asset.assetId,
    qualitySnapshotId: snapshot.snapshotId,
    decision: evaluation.decision,
    repairAttempts: attempts,
    error: null,
    completedAt: Date.now(),
  };
}
