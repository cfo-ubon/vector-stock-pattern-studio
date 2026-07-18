import type { RecoveryDeps, RecoveryScenarioResult, RecoveryScenarioSpec, FailureInjectionPoint, IdbStoreTarget } from './recoveryEngine';
import { runRecoveryScenario } from './recoveryEngine';

// Portfolio Manager P2.5 Sprint 3 — durability + idempotency engine
// (brief Sections 5-6). Domain-agnostic, same layering as
// `recoveryEngine.ts`: it knows how to repeat a recovery scenario N times
// and how to compare a caller-supplied snapshot type across repeats — it
// has no knowledge of Collections itself. `scripts/validateRecovery.ts`
// wires in the real `collectionService.ts` operations and
// `ConsistencySnapshot`/`CollectionIntegrityReport`, exactly like
// `recoveryEngine.ts` is wired in.

export interface DurabilityDeps<TSnapshot, TIntegrityReport> extends RecoveryDeps<TSnapshot, TIntegrityReport> {
  /** True when the integrity report shows zero corruption (no orphaned
   * memberships, no stale cover references, no duplicate ids) — the
   * caller supplies this since `TIntegrityReport`'s shape is
   * domain-specific; this module only knows how to ask the question, not
   * how to answer it. */
  isClean: (report: TIntegrityReport) => boolean;
}

export interface DurabilityCycleResult<TSnapshot, TIntegrityReport> {
  cycleIndex: number;
  scenario: RecoveryScenarioResult<TSnapshot, TIntegrityReport>;
  /** The retry (recovery) step succeeded AND the post-recovery integrity
   * scan is clean — a single boolean a caller can reduce 100 cycles down
   * to without re-deriving the same two checks every time. */
  durableAndClean: boolean;
}

export interface DurabilityReport<TSnapshot, TIntegrityReport> {
  operationName: string;
  point: FailureInjectionPoint;
  store: IdbStoreTarget;
  cyclesRequested: number;
  cycles: DurabilityCycleResult<TSnapshot, TIntegrityReport>[];
  /** Every cycle's retry (recovery) step succeeded — a failed operation
   * never silently became a "successful-looking but wrong" outcome, and a
   * committed retry never regressed on a later cycle. */
  allDurable: boolean;
  /** Every cycle's post-recovery integrity scan was clean — no cycle
   * accumulated orphans/stale covers/corruption that a later cycle's scan
   * would have caught. */
  allClean: boolean;
  /** 0-based index of the first cycle that was not durable-and-clean, or
   * `null` if every cycle passed — lets a report point at exactly where a
   * long run first went wrong instead of just "somewhere in 100 cycles". */
  firstFailureCycle: number | null;
  finalSnapshot: TSnapshot;
  finalIntegrity: TIntegrityReport;
}

/** Runs the same recovery scenario `cycles` times in a row (Section 5:
 * "run 100 repeated recovery cycles"). `specFactory(cycleIndex)` builds a
 * fresh spec per cycle — most operations are naturally idempotent to
 * retry with the exact same arguments (e.g. `assignAssetsToCollections`
 * dedupes), but callers whose operation needs a distinct value per cycle
 * (e.g. `createCollection` needs a unique name each time to avoid a
 * legitimate `DuplicateCollectionNameError`) can vary the spec by index.
 * Never assumes success — every cycle's durability and cleanliness is
 * measured independently, and the run does not stop early on a failing
 * cycle so a full 100-cycle picture is always produced. */
export async function runDurabilityCycles<T, TSnapshot, TIntegrityReport>(
  specFactory: (cycleIndex: number) => RecoveryScenarioSpec<T>,
  deps: DurabilityDeps<TSnapshot, TIntegrityReport>,
  cycles: number = 100,
): Promise<DurabilityReport<TSnapshot, TIntegrityReport>> {
  if (cycles < 1) throw new Error('runDurabilityCycles: cycles must be >= 1');

  const results: DurabilityCycleResult<TSnapshot, TIntegrityReport>[] = [];
  let firstFailureCycle: number | null = null;

  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
    const spec = specFactory(cycleIndex);
    const scenario = await runRecoveryScenario(spec, deps);
    const durableAndClean = scenario.retryOutcome === 'succeeded' && deps.isClean(scenario.integrityAfterRecovery);
    if (!durableAndClean && firstFailureCycle === null) firstFailureCycle = cycleIndex;
    results.push({ cycleIndex, scenario, durableAndClean });
  }

  const last = results[results.length - 1].scenario;
  return {
    operationName: last.operationName,
    point: last.point,
    store: last.store,
    cyclesRequested: cycles,
    cycles: results,
    allDurable: results.every((c) => c.scenario.retryOutcome === 'succeeded'),
    allClean: results.every((c) => deps.isClean(c.scenario.integrityAfterRecovery)),
    firstFailureCycle,
    finalSnapshot: last.afterRecovery,
    finalIntegrity: last.integrityAfterRecovery,
  };
}

export interface IdempotencyCheckResult<TSnapshot> {
  repeats: number;
  /** True if every captured snapshot after the first is equal (per the
   * caller-supplied comparator) to the one before it — i.e. repeating the
   * recovery action produced no further state change at any step, not
   * just between the first and last. */
  stable: boolean;
  snapshots: TSnapshot[];
  /** Index into `snapshots` (>= 1) of the first repeat whose snapshot
   * diverged from the previous one, or `null` if fully stable. */
  firstDivergenceIndex: number | null;
}

/** Section 6: repeats a single recovery/retry action `repeats` times and
 * verifies the resulting state stops changing — no duplicate
 * collections/memberships/assets/cover references accumulate on the 2nd,
 * 3rd, ... Nth repeat. `equalsIgnoringVolatileFields` is supplied by the
 * caller because a raw snapshot typically carries a `capturedAt`-style
 * timestamp that legitimately differs between two real calls even when
 * every meaningful field is identical. */
export async function verifyIdempotentRecovery<TSnapshot>(
  recover: () => Promise<void>,
  captureSnapshot: () => Promise<TSnapshot>,
  equalsIgnoringVolatileFields: (a: TSnapshot, b: TSnapshot) => boolean,
  repeats: number = 5,
): Promise<IdempotencyCheckResult<TSnapshot>> {
  if (repeats < 1) throw new Error('verifyIdempotentRecovery: repeats must be >= 1');

  const snapshots: TSnapshot[] = [];
  for (let i = 0; i < repeats; i++) {
    await recover();
    snapshots.push(await captureSnapshot());
  }

  let firstDivergenceIndex: number | null = null;
  for (let i = 1; i < snapshots.length; i++) {
    if (!equalsIgnoringVolatileFields(snapshots[i - 1], snapshots[i])) {
      firstDivergenceIndex = i;
      break;
    }
  }

  return { repeats, stable: firstDivergenceIndex === null, snapshots, firstDivergenceIndex };
}
