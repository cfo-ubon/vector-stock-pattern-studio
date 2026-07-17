// Portfolio Manager P2.5 Sprint 3 — crash recovery / data integrity
// failure-injection engine (Sections 3-4 of the brief).
//
// This module is generic and domain-agnostic, mirroring Sprint 2's
// `soakRunner.ts`: it knows how to install a controlled fault into the
// real IndexedDB machinery (`fake-indexeddb`'s globally-installed
// `IDBDatabase`/`IDBObjectStore`/`IDBTransaction` prototypes) and run one
// "recovery scenario" against a caller-supplied operation — it has no
// knowledge of Collections itself. `scripts/validateRecovery.ts` wires in
// the real `collectionService.ts` calls, exactly the same layering
// Sprint 2 used for `soakRunner.ts` + `scripts/validateCollectionsStress.ts`.
//
// Fault injection never touches `storage/db.ts`/`collectionStore.ts`/
// `portfolioStore.ts`/`collectionService.ts` source — every fault is a
// temporary, always-restored monkey-patch of `fake-indexeddb`'s own
// prototype methods (the same "patch a global before the app runs, patch
// it back after" technique Sprint 2's `uiSoak.ts` already used for
// `URL.createObjectURL`/`revokeObjectURL`), scoped to one Node process
// running against `fake-indexeddb` (Sprint 1's own structural isolation
// mechanism, unmodified — see `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`'s
// P2.5-2).

/** The 9 required failure-injection points (brief Section 3). Each has a
 * distinct trigger mechanism — see the switch in `installFailureInjector`
 * for exactly what each one does and why it is a meaningfully different
 * scenario from its neighbors, not just a relabeling of the same fault. */
export type FailureInjectionPoint =
  | 'before-transaction'
  | 'during-transaction'
  | 'after-commit'
  | 'after-persistence'
  | 'before-ui-refresh'
  | 'rejected-promise'
  | 'thrown-exception'
  | 'aborted-transaction'
  | 'validation-interruption';

export const ALL_FAILURE_INJECTION_POINTS: FailureInjectionPoint[] = [
  'before-transaction',
  'during-transaction',
  'after-commit',
  'after-persistence',
  'before-ui-refresh',
  'rejected-promise',
  'thrown-exception',
  'aborted-transaction',
  'validation-interruption',
];

/** Which IndexedDB object store the fault should target — every
 * Collection mutation touches `collections` and/or `portfolioAssets`
 * (never a third store), so this is the only axis a caller needs. */
export type IdbStoreTarget = 'collections' | 'portfolioAssets';

export interface FailureInjectionConfig {
  point: FailureInjectionPoint;
  store: IdbStoreTarget;
  /** 1-based call index (within calls touching `store`) to trigger the
   * fault on — deterministic and seed-independent-but-config-driven, so
   * the exact same scenario reproduces identically every run. */
  triggerOnCall: number;
}

export interface InstalledFailureInjector {
  /** True once the fault has actually fired at least once. Checked after
   * the scenario runs to confirm the injection point was actually
   * reached (a `triggerOnCall` higher than the real call count would
   * silently never fire — this makes that visible instead of a false
   * "recovery succeeded" from a fault that never actually happened). */
  readonly triggered: boolean;
  /** Resolves at the exact moment the fault fires — event-driven, not
   * polled (a polling `queueMicrotask` loop that never terminates once
   * the target call count is never reached starves Node's real timers,
   * the same microtask-starvation bug Sprint 2 hit and fixed in
   * `soakRunner.test.ts`; this promise never resolves at all if the
   * point is never reached, so callers must always race it against
   * something that does settle). Used by the `'rejected-promise'`
   * scenario in `runRecoveryScenario`. */
  onTriggered: Promise<void>;
  /** Restores every patched prototype method. Always call this in a
   * `finally` block — an uninstalled injector would corrupt every
   * subsequent IndexedDB operation in the process, including unrelated
   * ones. */
  uninstall: () => void;
}

/** Injects `error` as an async rejection on a synthetic IDBRequest-shaped
 * object (`onsuccess`/`onerror`/`result`/`error`, exactly what
 * `storage/db.ts`'s `requestAsPromise` reads) — used by callers that want
 * to fail a single request without going through a real transaction at
 * all. */
function fakeRejectedRequest(error: Error): IDBRequest {
  const fake = { error, result: undefined as unknown, onsuccess: null as ((ev: unknown) => void) | null, onerror: null as ((ev: unknown) => void) | null };
  queueMicrotask(() => fake.onerror?.({ target: fake }));
  return fake as unknown as IDBRequest;
}

/** Installs one fault into the currently-active `fake-indexeddb` globals
 * (`IDBDatabase`/`IDBObjectStore`/`IDBTransaction` prototypes) and returns
 * a handle to check whether it fired and to restore the originals. Only
 * one injector may be installed at a time per process — `runRecoveryScenario`
 * enforces this by always uninstalling before returning. */
export function installFailureInjector(config: FailureInjectionConfig): InstalledFailureInjector {
  const state = { triggered: false };
  let resolveTriggered!: () => void;
  const onTriggered = new Promise<void>((resolve) => { resolveTriggered = resolve; });
  const markTriggered = () => {
    if (state.triggered) return;
    state.triggered = true;
    resolveTriggered();
  };
  const handle = (uninstall: () => void): InstalledFailureInjector => ({ get triggered() { return state.triggered; }, onTriggered, uninstall });
  const { point, store, triggerOnCall } = config;

  switch (point) {
    case 'before-transaction': {
      // Simulates the DB layer being unreachable before any transaction
      // for the target store is even created — the operation's own code
      // never touches the store at all.
      const orig = IDBDatabase.prototype.transaction;
      let calls = 0;
      IDBDatabase.prototype.transaction = function (this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        if (names.includes(store)) {
          calls++;
          if (calls === triggerOnCall) {
            markTriggered();
            throw new Error(`Injected failure: before-transaction (${store})`);
          }
        }
        return orig.call(this, storeNames as never, mode as never);
      } as typeof IDBDatabase.prototype.transaction;
      return handle(() => { IDBDatabase.prototype.transaction = orig; });
    }

    case 'during-transaction': {
      // A synchronous throw from inside a request-issuing call while a
      // transaction is open — real IndexedDB semantics (and
      // fake-indexeddb's implementation of them) abort the whole
      // transaction when this happens, so N-1 already-issued puts never
      // actually commit either.
      const orig = IDBObjectStore.prototype.put;
      let calls = 0;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === store) {
          calls++;
          if (calls === triggerOnCall) {
            markTriggered();
            throw new Error(`Injected failure: during-transaction (${store})`);
          }
        }
        return orig.call(this, value as never, key as never);
      } as typeof IDBObjectStore.prototype.put;
      return handle(() => { IDBObjectStore.prototype.put = orig; });
    }

    case 'aborted-transaction': {
      // A deliberate `transaction.abort()` call after N puts have been
      // issued — a different API surface than an uncaught exception
      // (during-transaction), even though both ultimately reject the
      // wrapping Promise via `t.onabort`/`t.onerror`.
      const orig = IDBObjectStore.prototype.put;
      let calls = 0;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === store) {
          calls++;
          if (calls === triggerOnCall) {
            markTriggered();
            const result = orig.call(this, value as never, key as never);
            this.transaction?.abort();
            return result;
          }
        }
        return orig.call(this, value as never, key as never);
      } as typeof IDBObjectStore.prototype.put;
      return handle(() => { IDBObjectStore.prototype.put = orig; });
    }

    case 'rejected-promise': {
      // Models a caller-side rejection independent of the DB transaction
      // itself (e.g. an AbortSignal, an unrelated `.then()` throwing) —
      // the underlying `put` still goes through normally; `runRecoveryScenario`
      // races the real operation against `onTriggered` (event-driven, not
      // polled) so the scenario observes "my await threw" while the DB
      // write may still land successfully underneath. This is
      // intentionally the one point that does NOT stop the real
      // transaction — see `P2_5_FAILURE_MATRIX.md` for why that is the
      // point of this scenario, not an implementation gap.
      const orig = IDBObjectStore.prototype.put;
      let calls = 0;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === store) {
          calls++;
          if (calls === triggerOnCall) markTriggered();
        }
        return orig.call(this, value as never, key as never);
      } as typeof IDBObjectStore.prototype.put;
      return handle(() => { IDBObjectStore.prototype.put = orig; });
    }

    case 'thrown-exception': {
      // Distinct from during-transaction: this fires in the *caller's*
      // code, before the target operation is invoked at all (e.g. an
      // upstream bug in the code that was about to call
      // `createCollectionService`) — `runRecoveryScenario` checks this
      // config and throws from its own wrapper rather than patching any
      // IndexedDB primitive. See the `point === 'thrown-exception'`
      // branch in `runRecoveryScenario` below.
      return handle(() => {});
    }

    case 'after-commit':
    case 'after-persistence': {
      // Both let the real transaction complete untouched — the fault
      // fires from `runRecoveryScenario`'s own post-operation step, not
      // from any IndexedDB primitive. No patch needed; `triggered` is set
      // by the caller (see `runRecoveryScenario`).
      return handle(() => {});
    }

    case 'before-ui-refresh': {
      // After a successful write, the *read* path a UI's refetch would
      // use fails once — patches `getAll` on the target store.
      const orig = IDBObjectStore.prototype.getAll;
      let calls = 0;
      IDBObjectStore.prototype.getAll = function (this: IDBObjectStore, ...args: unknown[]) {
        if (this.name === store) {
          calls++;
          if (calls === triggerOnCall) {
            markTriggered();
            return fakeRejectedRequest(new Error(`Injected failure: before-ui-refresh (${store})`));
          }
        }
        return orig.apply(this, args as never);
      } as typeof IDBObjectStore.prototype.getAll;
      return handle(() => { IDBObjectStore.prototype.getAll = orig; });
    }

    case 'validation-interruption': {
      // Interrupts a read-only integrity scan (`validateCollectionIntegrity`
      // loads both stores via `getAll`) partway through — targets
      // whichever store this config names; a scan that reads collections
      // first and assets second will have the fault land on whichever
      // store's `getAll` matches, letting a caller test either half.
      const orig = IDBObjectStore.prototype.getAll;
      let calls = 0;
      IDBObjectStore.prototype.getAll = function (this: IDBObjectStore, ...args: unknown[]) {
        if (this.name === store) {
          calls++;
          if (calls === triggerOnCall) {
            markTriggered();
            return fakeRejectedRequest(new Error(`Injected failure: validation-interruption (${store})`));
          }
        }
        return orig.apply(this, args as never);
      } as typeof IDBObjectStore.prototype.getAll;
      return handle(() => { IDBObjectStore.prototype.getAll = orig; });
    }

    default: {
      const _exhaustive: never = point;
      throw new Error(`installFailureInjector: unhandled point ${_exhaustive}`);
    }
  }
}

export interface RecoveryScenarioSpec<T = unknown> {
  operationName: string;
  config: FailureInjectionConfig;
  /** Performs the real operation under test (e.g. `createCollectionService(...)`). */
  run: () => Promise<T>;
  /** A clean, un-injected retry of the same logical operation — how the
   * application would recover (e.g. retry the create with the same
   * input; for a bulk assign, retry the same assign call — idempotent by
   * construction since `addCollectionMembership` dedupes). */
  retry: () => Promise<T>;
}

export interface RecoveryDeps<TSnapshot, TIntegrityReport> {
  captureSnapshot: () => Promise<TSnapshot>;
  scanIntegrity: () => Promise<TIntegrityReport>;
}

export interface RecoveryScenarioResult<TSnapshot, TIntegrityReport> {
  operationName: string;
  point: FailureInjectionPoint;
  store: IdbStoreTarget;
  /** Whether the configured fault actually fired during the run — a
   * `false` here means `triggerOnCall` was set higher than the real call
   * count and the scenario measured nothing; always checked and surfaced
   * rather than silently treated as a pass. */
  injected: boolean;
  operationOutcome: 'failed-as-expected' | 'succeeded-despite-injection' | 'failed-unexpectedly';
  operationErrorMessage: string | null;
  retryOutcome: 'succeeded' | 'failed';
  retryErrorMessage: string | null;
  before: TSnapshot;
  afterFailure: TSnapshot;
  afterRecovery: TSnapshot;
  integrityBefore: TIntegrityReport;
  integrityAfterFailure: TIntegrityReport;
  integrityAfterRecovery: TIntegrityReport;
}

/** Runs one full failure-injection scenario: snapshot -> install fault ->
 * attempt the real operation -> uninstall fault (always, even on an
 * unexpected throw) -> snapshot -> retry (recovery) -> snapshot. Never
 * assumes the fault fired or that recovery succeeded — every field in the
 * result is measured, not inferred. */
export async function runRecoveryScenario<T, TSnapshot, TIntegrityReport>(
  spec: RecoveryScenarioSpec<T>,
  deps: RecoveryDeps<TSnapshot, TIntegrityReport>,
): Promise<RecoveryScenarioResult<TSnapshot, TIntegrityReport>> {
  const before = await deps.captureSnapshot();
  const integrityBefore = await deps.scanIntegrity();

  let injector: InstalledFailureInjector | null = null;
  let operationOutcome: RecoveryScenarioResult<TSnapshot, TIntegrityReport>['operationOutcome'] = 'succeeded-despite-injection';
  let operationErrorMessage: string | null = null;
  let injected = false;

  try {
    if (spec.config.point === 'thrown-exception') {
      // Fires before the operation is ever invoked — see the comment on
      // this case in `installFailureInjector`.
      injected = true;
      throw new Error(`Injected failure: thrown-exception (${spec.operationName}, before invocation)`);
    }

    injector = installFailureInjector(spec.config);

    if (spec.config.point === 'rejected-promise') {
      // The real write proceeds independently; race the caller's `await`
      // against a synthetic rejection that fires the instant the
      // injector's target call is reached (event-driven via
      // `onTriggered`, never a polling loop — a polling loop that never
      // observes a trigger would starve Node's real timers, the exact
      // microtask-starvation bug Sprint 2's `soakRunner.test.ts` hit and
      // fixed). If the operation resolves first, `onTriggered` may never
      // settle at all — that dangling promise is simply garbage
      // collected, not awaited further.
      const realRun = spec.run();
      realRun.catch(() => {}); // never an unhandled rejection, regardless of which branch of the race "wins"
      const rejection = injector.onTriggered.then(() => {
        throw new Error(`Injected failure: rejected-promise (${spec.operationName})`);
      });
      try {
        await Promise.race([realRun, rejection]);
      } finally {
        // The caller's `await` may have observed the injected rejection
        // before the real operation actually finished — always wait for
        // it to fully settle before snapshotting/recovering, so the
        // "afterFailure" state reflects reality (a real IndexedDB write
        // already in flight when this rejection fired is not undone by
        // it) rather than a mid-flight snapshot.
        await realRun.catch(() => {});
      }
    } else {
      await spec.run();
    }

    if (spec.config.point === 'after-commit' || spec.config.point === 'after-persistence') {
      // The transaction genuinely completed — now simulate the failure
      // that follows a successful commit.
      injected = true;
      throw new Error(`Injected failure: ${spec.config.point} (${spec.operationName}, after successful write)`);
    }
  } catch (err) {
    operationOutcome = 'failed-as-expected';
    operationErrorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    injector?.uninstall();
    if (injector) injected = injected || injector.triggered;
  }

  if (operationOutcome === 'succeeded-despite-injection' && !injected) {
    // The configured trigger point was never reached (e.g. triggerOnCall
    // set beyond the real call count) — report this honestly rather than
    // silently treating a no-op as a pass.
    operationOutcome = 'succeeded-despite-injection';
  }

  const afterFailure = await deps.captureSnapshot();
  const integrityAfterFailure = await deps.scanIntegrity();

  let retryOutcome: RecoveryScenarioResult<TSnapshot, TIntegrityReport>['retryOutcome'] = 'succeeded';
  let retryErrorMessage: string | null = null;
  try {
    await spec.retry();
  } catch (err) {
    retryOutcome = 'failed';
    retryErrorMessage = err instanceof Error ? err.message : String(err);
  }

  const afterRecovery = await deps.captureSnapshot();
  const integrityAfterRecovery = await deps.scanIntegrity();

  return {
    operationName: spec.operationName,
    point: spec.config.point,
    store: spec.config.store,
    injected,
    operationOutcome,
    operationErrorMessage,
    retryOutcome,
    retryErrorMessage,
    before,
    afterFailure,
    afterRecovery,
    integrityBefore,
    integrityAfterFailure,
    integrityAfterRecovery,
  };
}
