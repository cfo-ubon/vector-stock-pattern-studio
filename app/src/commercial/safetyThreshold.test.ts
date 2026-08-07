import { describe, it, expect, beforeEach } from 'vitest';
import { loadSafetyThresholdConfig, saveSafetyThresholdConfig, canExportPackage } from './safetyThreshold';
import { DEFAULT_READINESS_THRESHOLD } from './domain/types';
import type { CommercialReadinessReport } from './domain/types';

function report(score: number): CommercialReadinessReport {
  return { assetId: 'a1', computedAt: 0, checks: [], score, band: score >= 95 ? 'READY' : 'NEEDS_WORK', failingChecks: [], warningChecks: [] };
}

describe('safety threshold', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the spec\'s 95% threshold when nothing is saved', () => {
    expect(loadSafetyThresholdConfig()).toEqual({ minReadinessScore: DEFAULT_READINESS_THRESHOLD });
  });

  it('persists and reloads a custom threshold', () => {
    saveSafetyThresholdConfig({ minReadinessScore: 80 });
    expect(loadSafetyThresholdConfig()).toEqual({ minReadinessScore: 80 });
  });

  it('never allows export below threshold without an explicit override', () => {
    const permission = canExportPackage(report(70), { minReadinessScore: 95 });
    expect(permission.allowed).toBe(false);
    expect(permission.requiresOverride).toBe(true);
  });

  it('allows export below threshold only with allowOverride=true, and still flags the override', () => {
    const permission = canExportPackage(report(70), { minReadinessScore: 95 }, true);
    expect(permission.allowed).toBe(true);
    expect(permission.requiresOverride).toBe(true);
  });

  it('allows export at or above threshold with no override needed', () => {
    const permission = canExportPackage(report(95), { minReadinessScore: 95 });
    expect(permission.allowed).toBe(true);
    expect(permission.requiresOverride).toBe(false);
  });
});
