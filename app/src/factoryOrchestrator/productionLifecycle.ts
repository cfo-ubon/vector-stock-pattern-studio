import type { PreflightValidationResult, ProductionCompletionReview, ProductionSession } from '../productionAutopilot/domain/types';
import { transitionProductionSession } from '../productionAutopilot/productionSession';
import { transitionOrchestrationRun, attachOrchestrationRunSession, attachOrchestrationRunArchive } from './orchestrationRun';
import { checkCommercialReadinessGate } from './commercialReadinessGate';
import { runOrchestrationStep, fail } from './errorHandling';
import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { OrchestrationRun, OrchestrationResult } from './domain/types';

// Mission 5, Part 5 — Production Lifecycle. Ten real actions over the
// Part 2 state machine + the underlying `ProductionSession` (unchanged
// since Mission 4). Every function returns an `OrchestrationResult` (Part
// 7) — a thrown `InvalidOrchestrationTransitionError`/
// `InvalidProductionSessionTransitionError` is always caught and reported
// as a typed error, never left to crash the caller. Every transition
// appends a real history entry on the record it changes — "every phase
// must be recorded" (Part 5's own closing line).

export interface RunAndSession {
  run: OrchestrationRun;
  session: ProductionSession;
}

export function prepareFactoryRun(run: OrchestrationRun, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep('prepareFactoryRun', () => transitionOrchestrationRun(run, 'PREPARING', now), now);
}

/** Validate — runs Part 3's real Preflight result through the state
 * machine: PREPARING -> PREFLIGHT, then either -> BLOCKED (a real
 * BLOCKED check exists) or -> PLANNING. */
export function validateFactoryRun(run: OrchestrationRun, preflight: PreflightValidationResult, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep(
    'validateFactoryRun',
    () => {
      const inPreflight = transitionOrchestrationRun(run, 'PREFLIGHT', now);
      const blockedCheck = preflight.checks.find((c) => c.status === 'BLOCKED');
      if (blockedCheck) return transitionOrchestrationRun(inPreflight, 'BLOCKED', now, blockedCheck.detail);
      return transitionOrchestrationRun(inPreflight, 'PLANNING', now);
    },
    now,
  );
}

/** Plan — attaches the real `ProductionSession` created from Production
 * Autopilot's plan, and moves the run to WAITING_OWNER_APPROVAL. */
export function planFactoryRun(run: OrchestrationRun, sessionId: string, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep(
    'planFactoryRun',
    () => {
      const withSession = attachOrchestrationRunSession(run, sessionId, now);
      return transitionOrchestrationRun(withSession, 'WAITING_OWNER_APPROVAL', now);
    },
    now,
  );
}

/** Approve — the owner's real approval of the plan. Transitions the
 * `ProductionSession` PLANNED -> APPROVED; the `OrchestrationRun` itself
 * stays WAITING_OWNER_APPROVAL until Execute actually starts the work
 * (Part 11's Owner Interaction "waiting time" is measured across exactly
 * this Approve-to-Execute gap). */
export function approveFactoryRun(run: OrchestrationRun, session: ProductionSession, now: number = Date.now()): OrchestrationResult<RunAndSession> {
  return runOrchestrationStep('approveFactoryRun', () => ({ run, session: transitionProductionSession(session, 'APPROVED', now) }), now);
}

/** Execute — the run actually starts. `ProductionSession` APPROVED ->
 * RUNNING and `OrchestrationRun` WAITING_OWNER_APPROVAL -> RUNNING
 * transition together, in one call, so the two records never disagree
 * about whether execution has started. */
export function executeFactoryRun(run: OrchestrationRun, session: ProductionSession, now: number = Date.now()): OrchestrationResult<RunAndSession> {
  return runOrchestrationStep(
    'executeFactoryRun',
    () => ({
      run: transitionOrchestrationRun(run, 'RUNNING', now),
      session: transitionProductionSession(session, 'RUNNING', now),
    }),
    now,
  );
}

export function pauseFactoryRun(run: OrchestrationRun, reason: string, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep('pauseFactoryRun', () => transitionOrchestrationRun(run, 'PAUSED', now, reason), now);
}

export function resumeFactoryRun(run: OrchestrationRun, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep('resumeFactoryRun', () => transitionOrchestrationRun(run, 'RUNNING', now), now);
}

export function cancelFactoryRun(run: OrchestrationRun, session: ProductionSession | null, reason: string, now: number = Date.now()): OrchestrationResult<{ run: OrchestrationRun; session: ProductionSession | null }> {
  return runOrchestrationStep(
    'cancelFactoryRun',
    () => ({
      run: transitionOrchestrationRun(run, 'CANCELLED', now, reason),
      session: session ? transitionProductionSession(session, 'CANCELLED', now, reason) : null,
    }),
    now,
  );
}

/** Complete — Part 10's Commercial Readiness Gate: refuses completion
 * unless Decision OS, Factory Controller, and Factory Intelligence all
 * agree. Returns a `BLOCKED` result (not a thrown error — this is an
 * expected, correctly-behaving refusal) when they don't. */
export function completeFactoryRun(run: OrchestrationRun, session: ProductionSession, outcome: ProductionCompletionReview, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): OrchestrationResult<RunAndSession> {
  const gate = checkCommercialReadinessGate(run.batchId, tasks, timeline, session.decisionTrace, now);
  if (!gate.allAgree) {
    return fail('BLOCKED', `Commercial Readiness Gate refused completion: ${gate.reasons.join('; ')}`, 'completeFactoryRun', now);
  }
  return runOrchestrationStep(
    'completeFactoryRun',
    () => ({
      run: transitionOrchestrationRun(run, 'COMPLETED', now),
      session: (() => {
        const withOutcome = { ...session, outcome };
        return transitionProductionSession(withOutcome, 'COMPLETED', now);
      })(),
    }),
    now,
  );
}

/** Archive — attaches the real archive record id built by
 * `sessionArchive.ts`'s `buildProductionSessionArchive`. Does not change
 * `run.status` — COMPLETED/CANCELLED are already terminal per Part 2's
 * state list; archiving is orthogonal metadata on a terminal run, not a
 * 12th state. */
export function archiveFactoryRun(run: OrchestrationRun, archiveId: string, now: number = Date.now()): OrchestrationResult<OrchestrationRun> {
  return runOrchestrationStep('archiveFactoryRun', () => attachOrchestrationRunArchive(run, archiveId, now), now);
}
