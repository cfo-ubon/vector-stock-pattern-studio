import { describe, it, expect, vi } from 'vitest';
import { ok, fail, runOrchestrationStep, runOrchestrationStepWithRetry, runOrchestrationStepWithRollback, buildBlockedError } from './errorHandling';

const NOW = 1_700_000_000_000;

describe('ok/fail', () => {
  it('wraps a value / error in the expected shape', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(fail('BLOCKED', 'nope', 'test', NOW)).toEqual({ ok: false, error: { kind: 'BLOCKED', message: 'nope', source: 'test', occurredAt: NOW } });
  });
});

describe('runOrchestrationStep', () => {
  it('returns ok(value) when the step succeeds', () => {
    const result = runOrchestrationStep('test', () => 7, NOW);
    expect(result).toEqual({ ok: true, value: 7 });
  });

  it('catches a thrown error and reports the real message — never a generic string', () => {
    const result = runOrchestrationStep(
      'test',
      () => {
        throw new Error('specific real failure');
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('FAILED');
      expect(result.error.message).toBe('specific real failure');
      expect(result.error.source).toBe('test');
    }
  });

  it('handles a non-Error thrown value honestly via String()', () => {
    const step = (): number => {
      throw 'a string throw';
    };
    const result = runOrchestrationStep('test', step, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('a string throw');
  });
});

describe('runOrchestrationStepWithRetry', () => {
  it('retries only while isRetryable says so, and returns the eventual success', () => {
    let attempts = 0;
    const result = runOrchestrationStepWithRetry(
      'test',
      () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
        return 'done';
      },
      5,
      () => true,
      NOW,
    );
    expect(attempts).toBe(3);
    expect(result).toEqual({ ok: true, value: 'done' });
  });

  it('stops immediately on a non-retryable error', () => {
    let attempts = 0;
    const result = runOrchestrationStepWithRetry(
      'test',
      () => {
        attempts++;
        throw new Error('fatal');
      },
      5,
      () => false,
      NOW,
    );
    expect(attempts).toBe(1);
    expect(result.ok).toBe(false);
  });

  it('never exceeds maxAttempts', () => {
    let attempts = 0;
    runOrchestrationStepWithRetry(
      'test',
      () => {
        attempts++;
        throw new Error('always fails');
      },
      3,
      () => true,
      NOW,
    );
    expect(attempts).toBe(3);
  });
});

describe('runOrchestrationStepWithRollback', () => {
  it('invokes rollback with the real error on failure, not on success', () => {
    const rollback = vi.fn();
    runOrchestrationStepWithRollback('test', () => 'ok', rollback, NOW);
    expect(rollback).not.toHaveBeenCalled();

    const rollback2 = vi.fn();
    runOrchestrationStepWithRollback(
      'test',
      () => {
        throw new Error('mutation failed');
      },
      rollback2,
      NOW,
    );
    expect(rollback2).toHaveBeenCalledTimes(1);
    expect(rollback2.mock.calls[0][0].message).toBe('mutation failed');
  });
});

describe('buildBlockedError', () => {
  it('builds a real BLOCKED error with the given message/source', () => {
    const error = buildBlockedError('Gate refused.', 'commercialReadinessGate', NOW);
    expect(error).toEqual({ kind: 'BLOCKED', message: 'Gate refused.', source: 'commercialReadinessGate', occurredAt: NOW });
  });
});
