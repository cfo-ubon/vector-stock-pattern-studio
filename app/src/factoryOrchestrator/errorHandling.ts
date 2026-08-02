import type { OrchestrationError, OrchestrationErrorKind, OrchestrationResult } from './domain/types';

// Mission 5, Part 7 — Unified Error Handling. Every subsystem call the
// orchestrator makes goes through `runOrchestrationStep`, so a thrown
// exception from Decision OS/Factory Controller/Factory Intelligence/
// Continuous Improvement/Production Autopilot is always caught and
// turned into a typed `OrchestrationError` — never silently swallowed,
// never left to crash the whole `StartFactory()` call.

export function ok<T>(value: T): OrchestrationResult<T> {
  return { ok: true, value };
}

export function fail<T>(kind: OrchestrationErrorKind, message: string, source: string, now: number = Date.now()): OrchestrationResult<T> {
  return { ok: false, error: { kind, message, source, occurredAt: now } };
}

/** Runs `step`, catching any thrown error and reporting it as a typed
 * `FAILED` result carrying the real thrown message — never a generic
 * "something went wrong." Synchronous by design (every orchestrator
 * engine call it wraps — `runPreflightValidation`, `startFactoryWorkflow`,
 * `computeFactoryHealth`, etc. — is itself synchronous); storage I/O is
 * awaited by the caller before/after this wrapper runs, not inside it. */
export function runOrchestrationStep<T>(source: string, step: () => T, now: number = Date.now()): OrchestrationResult<T> {
  try {
    return ok(step());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail('FAILED', message, source, now);
  }
}

/** Part 7's "retry" support — retries a step up to `maxAttempts` times,
 * only for errors the caller marks retryable via `isRetryable`; the
 * first non-retryable failure (or the final attempt) is returned as-is.
 * Never retries silently forever — `maxAttempts` is always finite and
 * explicit. */
export function runOrchestrationStepWithRetry<T>(source: string, step: () => T, maxAttempts: number, isRetryable: (error: OrchestrationError) => boolean, now: number = Date.now()): OrchestrationResult<T> {
  let lastResult: OrchestrationResult<T> = fail('FAILED', 'No attempt made.', source, now);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = runOrchestrationStep(source, step, now);
    if (lastResult.ok) return lastResult;
    if (!isRetryable(lastResult.error)) return lastResult;
  }
  return lastResult;
}

/** Part 7's "rollback" support — wraps a mutating step; on failure,
 * `rollback` is invoked with the real error before the failure result is
 * returned, so a caller can restore prior state (e.g. revert an
 * `OrchestrationRun` to its previous status) instead of leaving the run
 * silently corrupted. */
export function runOrchestrationStepWithRollback<T>(source: string, step: () => T, rollback: (error: OrchestrationError) => void, now: number = Date.now()): OrchestrationResult<T> {
  const result = runOrchestrationStep(source, step, now);
  if (!result.ok) rollback(result.error);
  return result;
}

export function buildBlockedError(message: string, source: string, now: number = Date.now()): OrchestrationError {
  return { kind: 'BLOCKED', message, source, occurredAt: now };
}
