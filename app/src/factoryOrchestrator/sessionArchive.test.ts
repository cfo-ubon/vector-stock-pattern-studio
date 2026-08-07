import { describe, it, expect } from 'vitest';
import { buildProductionSessionArchive, generateProductionSessionArchiveId, isValidProductionSessionArchive } from './sessionArchive';
import { createOrchestrationRun, attachOrchestrationRunBatch } from './orchestrationRun';
import { buildFactoryExecutionContext } from './executionContext';
import { createProductionSession } from '../productionAutopilot/productionSession';
import { runPreflightValidation } from '../productionAutopilot/preflightValidation';
import { planProductionSession } from '../productionAutopilot/productionSessionPlanner';
import { recordOwnerDecision } from '../productionAutopilot/ownerDecision';
import type { FactoryTimelineEntry } from '../factory/domain/types';
import type { DecisionTimelineEntry } from '../decisionOS/domain/types';
import type { FactoryEvolutionEntry } from '../factoryImprovement/domain/types';

const NOW = 1_700_000_000_000;

function timelineEntry(overrides: Partial<FactoryTimelineEntry>): FactoryTimelineEntry {
  return {
    id: `FTL-${Math.random()}`,
    taskId: 'FTASK-1',
    taskType: 'qa',
    batchId: null,
    event: 'FINISHED',
    note: 'ok',
    durationMs: 1000,
    decisionId: null,
    policyIds: [],
    evidenceIds: [],
    confidenceScore: null,
    confidenceBand: null,
    at: 1000,
    ...overrides,
  };
}

describe('generateProductionSessionArchiveId', () => {
  it('generates a stable, matchable id format', () => {
    expect(generateProductionSessionArchiveId(NOW)).toMatch(/^FARCH-\d{8}-[0-9A-Z]{6}$/);
  });
});

describe('buildProductionSessionArchive', () => {
  it('scopes execution timeline to the real run batchId only', () => {
    let run = createOrchestrationRun(NOW);
    run = attachOrchestrationRunBatch(run, 'B1', NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], null, NOW);
    const timeline = [timelineEntry({ batchId: 'B1' }), timelineEntry({ batchId: 'B2' })];

    const archive = buildProductionSessionArchive(run, context, timeline, [], [], [], NOW + 100);
    expect(archive.executionTimeline).toHaveLength(1);
    expect(archive.executionTimeline[0].batchId).toBe('B1');
    expect(archive.runId).toBe(run.id);
    expect(archive.finalStatus).toBe(run.status);
  });

  it('returns an honest empty executionTimeline when the run has no batch', () => {
    const run = createOrchestrationRun(NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], null, NOW);
    const archive = buildProductionSessionArchive(run, context, [timelineEntry({ batchId: 'B1' })], [], [], [], NOW);
    expect(archive.executionTimeline).toEqual([]);
  });

  it('scopes decision timeline to the session\'s own real decision id(s)', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    const run = createOrchestrationRun(NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], session, NOW);

    const mine: DecisionTimelineEntry = { id: 'DTL-1', decisionId: session.decisionTrace.decisionId, domain: 'factory', requestedAction: null, recommendedAction: null, businessImpact: 'HIGH', confidenceScore: 80, confidenceBand: 'high', policyIds: [], evidenceIds: [], blockedReasons: [], warnings: [], explanation: [], createdAt: NOW };
    const other: DecisionTimelineEntry = { ...mine, id: 'DTL-2', decisionId: 'DEC-UNRELATED' };

    const archive = buildProductionSessionArchive(run, context, [], [mine, other], [], [], NOW + 100);
    expect(archive.decisionTimeline).toEqual([mine]);
  });

  it('scopes owner decisions to the real session id', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    const run = createOrchestrationRun(NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], session, NOW);

    const mine = recordOwnerDecision('APPROVE_SESSION', session.id, 1000, NOW);
    const other = recordOwnerDecision('APPROVE_SESSION', 'FSESS-OTHER', 1000, NOW);

    const archive = buildProductionSessionArchive(run, context, [], [], [], [mine, other], NOW + 100);
    expect(archive.ownerDecisions).toEqual([mine]);
  });

  it('carries the real factoryKpis/businessOutcome off the execution context — never recomputed', () => {
    const run = createOrchestrationRun(NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], null, NOW);
    const archive = buildProductionSessionArchive(run, context, [], [], [], [], NOW);
    expect(archive.factoryKpis).toBe(context.factoryKpis);
    expect(archive.businessOutcome).toBe(context.businessOutcome);
  });

  it('scopes improvement history to real evolution timeline refs', () => {
    const run = createOrchestrationRun(NOW);
    const context = { ...buildFactoryExecutionContext(run.id, [], [], [], [], null, NOW), improvementReferences: ['FBACK-1'] };
    const mine: FactoryEvolutionEntry = { id: 'FEVT-1', type: 'BACKLOG_TASK_CREATED', refId: 'FBACK-1', summary: 'x', at: NOW };
    const other: FactoryEvolutionEntry = { id: 'FEVT-2', type: 'BACKLOG_TASK_CREATED', refId: 'FBACK-2', summary: 'y', at: NOW };
    const archive = buildProductionSessionArchive(run, context, [], [], [mine, other], [], NOW);
    expect(archive.improvementHistory).toEqual([mine]);
  });
});

describe('isValidProductionSessionArchive', () => {
  it('validates a real archive and rejects a malformed value', () => {
    const run = createOrchestrationRun(NOW);
    const context = buildFactoryExecutionContext(run.id, [], [], [], [], null, NOW);
    const archive = buildProductionSessionArchive(run, context, [], [], [], [], NOW);
    expect(isValidProductionSessionArchive(archive)).toBe(true);
    expect(isValidProductionSessionArchive({})).toBe(false);
    expect(isValidProductionSessionArchive(null)).toBe(false);
  });
});
