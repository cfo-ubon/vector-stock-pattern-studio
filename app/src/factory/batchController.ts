import type { FactoryTask } from './domain/types';
import { createFactoryTask, generateFactoryBatchId } from './domain/factoryTask';
import type { GenerateParams } from '../engine/types';

// Build 031C, Part 4 — Batch Controller. Creates one Factory Batch of N
// Commercial Packages (10/30/50/100, or any positive count) behind ONE
// Factory Queue: a single `generate` task covering the whole batch (real
// generation must run sequentially with shared duplicate-tracking anyway
// — `batch/batchProductionService.ts`'s own documented constraint, which
// `taskExecutors.ts`'s generate handler reuses via `generateBatchToPortfolio`
// rather than reimplementing it), followed by per-asset qa/repair/seo/
// package/exportValidation task chains that `taskExecutors.ts` creates
// once real assets exist (Part 2's dependency graph is expressed as real
// task-id edges, not guessed in advance for assets that don't exist yet).
// The user only ever picks a count and clicks once — "the user never
// manages individual tasks."

export interface CreateFactoryBatchInput {
  count: number;
  params: GenerateParams;
  now?: number;
}

export interface FactoryBatchCreationResult {
  batchId: string;
  generateTask: FactoryTask;
}

/** The one task the Scheduler never auto-runs (Part 9 — "user approval
 * still required before generation"). Everything downstream of it is
 * created only after the user explicitly approves and runs it. */
export function createFactoryBatch(input: CreateFactoryBatchInput): FactoryBatchCreationResult {
  const now = input.now ?? Date.now();
  const batchId = generateFactoryBatchId(now);
  const generateTask = createFactoryTask({
    type: 'generate',
    reason: `Generate ${input.count} pattern(s) for this Commercial Package batch.`,
    priority: 100,
    batchId,
    estimatedWorkMinutes: Math.max(1, Math.round(input.count * 3)),
    now,
  });
  return { batchId, generateTask: { ...generateTask, errors: [] } };
}

/** Every task type a completed Generate task expands into for one real
 * asset, in the exact order the spec's own pipeline names them. Matches
 * `dependencyEngine.ts`'s `FACTORY_TASK_TYPE_DEPENDENCIES` table. */
export const BATCH_PER_ASSET_TASK_TYPES = ['qa', 'repair', 'seo', 'package', 'exportValidation'] as const;

export interface ExpandFactoryBatchInput {
  generateTask: FactoryTask;
  createdAssetIds: string[];
  targetMarketplace: string;
  now?: number;
}

/** Part 2/4 — called only after `generate` actually COMPLETED and produced
 * real asset ids (never in advance, per `dependencyEngine.ts`'s own
 * comment: the dependency graph is real task-id edges, not a guess about
 * assets that don't exist yet). For each real asset, builds the
 * qa -> {repair, seo} -> package -> exportValidation chain described by
 * `FACTORY_TASK_TYPE_DEPENDENCIES`, wired by real `dependsOnTaskIds`
 * (`repair` and `seo` both depend on `qa`; `package` on `seo`;
 * `exportValidation` on `package`) — the Dependency Engine resolves these
 * exactly like any other task, so a repair failure blocks that asset's
 * downstream chain without touching any other asset's. */
export function expandFactoryBatchForAssets(input: ExpandFactoryBatchInput): FactoryTask[] {
  const now = input.now ?? Date.now();
  const tasks: FactoryTask[] = [];

  for (const assetId of input.createdAssetIds) {
    const qa = createFactoryTask({
      type: 'qa',
      reason: `Confirm QA result for ${assetId} (batch ${input.generateTask.batchId ?? input.generateTask.id}).`,
      priority: input.generateTask.priority,
      batchId: input.generateTask.batchId,
      assetId,
      dependsOnTaskIds: [input.generateTask.id],
      now,
    });
    const repair = createFactoryTask({
      type: 'repair',
      reason: `Repair ${assetId} if QA did not pass.`,
      priority: input.generateTask.priority,
      batchId: input.generateTask.batchId,
      assetId,
      dependsOnTaskIds: [qa.id],
      now,
    });
    const seo = createFactoryTask({
      type: 'seo',
      reason: `Prepare SEO metadata for ${assetId}.`,
      priority: input.generateTask.priority,
      batchId: input.generateTask.batchId,
      assetId,
      targetMarketplace: input.targetMarketplace,
      dependsOnTaskIds: [qa.id],
      now,
    });
    const pkg = createFactoryTask({
      type: 'package',
      reason: `Build Commercial Package for ${assetId}.`,
      priority: input.generateTask.priority,
      batchId: input.generateTask.batchId,
      assetId,
      targetMarketplace: input.targetMarketplace,
      dependsOnTaskIds: [seo.id],
      now,
    });
    const exportValidation = createFactoryTask({
      type: 'exportValidation',
      reason: `Validate export readiness for ${assetId}.`,
      priority: input.generateTask.priority,
      batchId: input.generateTask.batchId,
      assetId,
      dependsOnTaskIds: [pkg.id],
      now,
    });
    tasks.push(qa, repair, seo, pkg, exportValidation);
  }

  return tasks;
}
