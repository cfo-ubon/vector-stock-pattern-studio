import { createRng, rngInt } from '../../engine/rng';
import type { Rng } from '../../engine/types';
import { sampleMemory } from './memoryInstrumentation';
import type { MemorySample } from './memoryInstrumentation';

// Portfolio Manager P2.5 Sprint 2 — soak/stress runner (Sections 3-4).
// Generic over a caller-supplied map of named operations — this module
// has no knowledge of Collections itself; `scripts/validateCollections.ts`
// wires the real `collectionService.ts` calls in as `SoakOperationSpec`s.
// This keeps the runner reusable and keeps every actual mutation flowing
// through the same unmodified Stage 1 service layer Sprint 1 already
// used — no new mutation path is introduced here.

export type SoakOperationName =
  | 'searchCollections'
  | 'filterActive'
  | 'filterArchived'
  | 'openCollection'
  | 'switchCollection'
  | 'retrieveMembers'
  | 'bulkAssign'
  | 'bulkRemove'
  | 'integrityScan'
  | 'createCollection'
  | 'renameCollection'
  | 'archiveCollection'
  | 'unarchiveCollection'
  | 'deleteTempCollection'
  /** Bundles create+rename+archive+unarchive+delete into one atomic,
   * always-cleaned-up unit — these five steps are inherently sequential
   * (you cannot rename a collection before it exists), which does not
   * fit the runner's independent, randomly-orderable operation model.
   * See `scripts/validateCollectionsStress.ts` and
   * `docs/portfolio/P2_5_SOAK_REPORT.md` for the exact steps each cycle
   * performs and why. */
  | 'tempCollectionCycle';

export interface SoakContext {
  cycle: number;
  rng: Rng;
}

export interface SoakOperationSpec {
  name: SoakOperationName;
  /** Relative frequency in duration-driven soak mode (Section 3) —
   * ignored in exact-count stress mode (Section 4), which instead uses
   * `targetCounts` to build an exact deterministic sequence. */
  weight: number;
  run: (ctx: SoakContext) => Promise<unknown>;
}

export interface SoakOperationResult {
  operation: SoakOperationName;
  cycle: number;
  success: boolean;
  elapsedMs: number;
  timestamp: number;
  error: string | null;
  timedOut: boolean;
}

export interface SoakSample {
  atCycle: number;
  timestamp: number;
  memory: MemorySample;
  blobUrlOutstanding: number | null;
}

export interface SoakRunResult {
  seed: string;
  mode: 'stress' | 'soak';
  startedAt: number;
  endedAt: number;
  totalDurationMs: number;
  results: SoakOperationResult[];
  samples: SoakSample[];
  countsByOperation: Record<string, { success: number; failure: number; timeout: number }>;
  cancelled: boolean;
  cancelReason: string | null;
}

export interface SoakCancelSignal {
  cancelled: boolean;
  reason?: string;
}

async function withTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number): Promise<{ value?: T; timedOut: boolean; error?: unknown }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const value = await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('__soak_timeout__')), timeoutMs);
      Promise.resolve()
        .then(fn)
        .then(resolve, reject);
    });
    return { value, timedOut: false };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === '__soak_timeout__';
    return { timedOut: isTimeout, error: err };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emptyCounts(): Record<string, { success: number; failure: number; timeout: number }> {
  return {};
}

function bumpCount(counts: Record<string, { success: number; failure: number; timeout: number }>, op: string, kind: 'success' | 'failure' | 'timeout') {
  if (!counts[op]) counts[op] = { success: 0, failure: 0, timeout: 0 };
  counts[op][kind]++;
}

async function executeOne(
  spec: SoakOperationSpec,
  cycle: number,
  rng: Rng,
  operationTimeoutMs: number,
): Promise<SoakOperationResult> {
  const timestamp = Date.now();
  const start = performance.now();
  const { timedOut, error } = await withTimeout(() => spec.run({ cycle, rng }), operationTimeoutMs);
  const elapsedMs = performance.now() - start;
  const success = !timedOut && error === undefined;
  return {
    operation: spec.name,
    cycle,
    success,
    elapsedMs,
    timestamp,
    error: error !== undefined ? (error instanceof Error ? error.message : String(error)) : null,
    timedOut,
  };
}

export interface RunStressPlanOptions {
  seed: string;
  targetCounts: Partial<Record<SoakOperationName, number>>;
  operationTimeoutMs?: number;
  sampleEveryNOperations?: number;
  onSample?: (sample: SoakSample) => void;
  onProgress?: (completed: number, total: number) => void;
  signal?: SoakCancelSignal;
  blobUrlOutstandingProvider?: () => number | null;
}

/** Builds an exact, deterministically-shuffled sequence hitting every
 * requested target count precisely (Section 4's "required minimum
 * stress cycles" — exact numbers, not a probabilistic approximation),
 * then executes it in order. */
export async function runStressPlan(operations: SoakOperationSpec[], options: RunStressPlanOptions): Promise<SoakRunResult> {
  const rng = createRng(options.seed);
  const byName = new Map(operations.map((op) => [op.name, op]));
  const sequence: SoakOperationName[] = [];
  for (const [name, count] of Object.entries(options.targetCounts) as [SoakOperationName, number | undefined][]) {
    if (!count || !byName.has(name)) continue;
    for (let i = 0; i < count; i++) sequence.push(name);
  }
  // Deterministic Fisher-Yates shuffle of the exact sequence.
  for (let i = sequence.length - 1; i > 0; i--) {
    const j = rngInt(rng, 0, i);
    const tmp = sequence[i];
    sequence[i] = sequence[j];
    sequence[j] = tmp;
  }

  const results: SoakOperationResult[] = [];
  const samples: SoakSample[] = [];
  const countsByOperation = emptyCounts();
  const operationTimeoutMs = options.operationTimeoutMs ?? 30000;
  const sampleEvery = options.sampleEveryNOperations ?? Math.max(1, Math.floor(sequence.length / 20));
  const startedAt = Date.now();
  let cancelled = false;
  let cancelReason: string | null = null;

  for (let i = 0; i < sequence.length; i++) {
    if (options.signal?.cancelled) {
      cancelled = true;
      cancelReason = options.signal.reason ?? 'cancelled';
      break;
    }
    const spec = byName.get(sequence[i])!;
    const result = await executeOne(spec, i, rng, operationTimeoutMs);
    results.push(result);
    bumpCount(countsByOperation, result.operation, result.timedOut ? 'timeout' : result.success ? 'success' : 'failure');
    options.onProgress?.(i + 1, sequence.length);

    if ((i + 1) % sampleEvery === 0 || i === sequence.length - 1) {
      const sample: SoakSample = {
        atCycle: i,
        timestamp: Date.now(),
        memory: sampleMemory(),
        blobUrlOutstanding: options.blobUrlOutstandingProvider ? options.blobUrlOutstandingProvider() : null,
      };
      samples.push(sample);
      options.onSample?.(sample);
    }
  }

  const endedAt = Date.now();
  return {
    seed: options.seed,
    mode: 'stress',
    startedAt,
    endedAt,
    totalDurationMs: endedAt - startedAt,
    results,
    samples,
    countsByOperation,
    cancelled,
    cancelReason,
  };
}

export interface RunSoakOptions {
  seed: string;
  durationMs: number;
  operationTimeoutMs?: number;
  sampleIntervalMs?: number;
  onSample?: (sample: SoakSample) => void;
  onProgress?: (elapsedMs: number, durationMs: number, cycle: number) => void;
  signal?: SoakCancelSignal;
  blobUrlOutstandingProvider?: () => number | null;
}

/** Weighted round-robin over `operations`, run continuously until
 * `durationMs` elapses (checked between operations, never killing one
 * mid-flight) or the caller cancels via `signal`. Deterministic given
 * the same seed and operation set — the *order* operations execute in
 * is fully determined by the seeded rng, even though the total number
 * of cycles depends on real elapsed wall-clock time. */
export async function runSoak(operations: SoakOperationSpec[], options: RunSoakOptions): Promise<SoakRunResult> {
  const rng = createRng(options.seed);
  const totalWeight = operations.reduce((a, b) => a + b.weight, 0);
  const operationTimeoutMs = options.operationTimeoutMs ?? 30000;
  const sampleIntervalMs = options.sampleIntervalMs ?? Math.max(1000, Math.floor(options.durationMs / 50));

  const results: SoakOperationResult[] = [];
  const samples: SoakSample[] = [];
  const countsByOperation = emptyCounts();
  const startedAt = Date.now();
  let lastSampleAt = startedAt;
  let cancelled = false;
  let cancelReason: string | null = null;
  let cycle = 0;

  function pickOperation(): SoakOperationSpec {
    let r = rng() * totalWeight;
    for (const op of operations) {
      r -= op.weight;
      if (r <= 0) return op;
    }
    return operations[operations.length - 1];
  }

  while (Date.now() - startedAt < options.durationMs) {
    if (options.signal?.cancelled) {
      cancelled = true;
      cancelReason = options.signal.reason ?? 'cancelled';
      break;
    }
    const spec = pickOperation();
    const result = await executeOne(spec, cycle, rng, operationTimeoutMs);
    results.push(result);
    bumpCount(countsByOperation, result.operation, result.timedOut ? 'timeout' : result.success ? 'success' : 'failure');
    options.onProgress?.(Date.now() - startedAt, options.durationMs, cycle);

    const now = Date.now();
    if (now - lastSampleAt >= sampleIntervalMs) {
      const sample: SoakSample = {
        atCycle: cycle,
        timestamp: now,
        memory: sampleMemory(),
        blobUrlOutstanding: options.blobUrlOutstandingProvider ? options.blobUrlOutstandingProvider() : null,
      };
      samples.push(sample);
      options.onSample?.(sample);
      lastSampleAt = now;
    }
    cycle++;
  }

  const endedAt = Date.now();
  // Always take one final sample so `analyzeMemoryTrend`'s "final window"
  // reflects the true end state, even if the interval hadn't elapsed yet.
  const finalSample: SoakSample = {
    atCycle: cycle,
    timestamp: endedAt,
    memory: sampleMemory(),
    blobUrlOutstanding: options.blobUrlOutstandingProvider ? options.blobUrlOutstandingProvider() : null,
  };
  samples.push(finalSample);
  options.onSample?.(finalSample);

  return {
    seed: options.seed,
    mode: 'soak',
    startedAt,
    endedAt,
    totalDurationMs: endedAt - startedAt,
    results,
    samples,
    countsByOperation,
    cancelled,
    cancelReason,
  };
}

/** Extracts, in chronological order, the elapsed-time series for one
 * operation name — the direct input `latencyDrift.computeLatencyDrift`
 * expects. */
export function latencySeriesFor(result: SoakRunResult, operation: SoakOperationName): number[] {
  return result.results.filter((r) => r.operation === operation && r.success).map((r) => r.elapsedMs);
}
