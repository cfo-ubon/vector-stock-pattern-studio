import type { CommercialReadinessReport, SafetyThresholdConfig } from './domain/types';
import { DEFAULT_READINESS_THRESHOLD } from './domain/types';

// Build 031A, Phase 9 — Safety threshold. A tiny, isolated
// localStorage-backed setting (mirroring `App.tsx`'s own
// `GALLERY_STORAGE_KEY` pattern — a small user preference doesn't need a
// full IndexedDB store) that gates the Package Builder / Export Workspace:
// a package below the configured Commercial Readiness threshold can only
// be built with an explicit override, never silently.

const THRESHOLD_STORAGE_KEY = 'vsp-commercial-readiness-threshold-v1';

export function loadSafetyThresholdConfig(): SafetyThresholdConfig {
  try {
    const raw = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    if (!raw) return { minReadinessScore: DEFAULT_READINESS_THRESHOLD };
    const parsed = JSON.parse(raw) as Partial<SafetyThresholdConfig>;
    const value = typeof parsed.minReadinessScore === 'number' ? parsed.minReadinessScore : DEFAULT_READINESS_THRESHOLD;
    return { minReadinessScore: Math.min(100, Math.max(0, value)) };
  } catch {
    return { minReadinessScore: DEFAULT_READINESS_THRESHOLD };
  }
}

export function saveSafetyThresholdConfig(config: SafetyThresholdConfig): void {
  const clamped = Math.min(100, Math.max(0, config.minReadinessScore));
  localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify({ minReadinessScore: clamped }));
}

export interface ExportPermission {
  allowed: boolean;
  requiresOverride: boolean;
  reason: string;
}

/** Never exports below the configured threshold — `allowOverride: true`
 * is the one and only escape hatch (spec Phase 9: "Allow override with
 * warning"), and even then this function only reports permission; the
 * caller is responsible for surfacing the warning and requiring an
 * explicit user action before proceeding. */
export function canExportPackage(report: CommercialReadinessReport, config: SafetyThresholdConfig, allowOverride = false): ExportPermission {
  if (report.score >= config.minReadinessScore) {
    return { allowed: true, requiresOverride: false, reason: `Commercial Readiness ${report.score}% meets the ${config.minReadinessScore}% threshold.` };
  }
  if (allowOverride) {
    return {
      allowed: true,
      requiresOverride: true,
      reason: `Commercial Readiness ${report.score}% is below the ${config.minReadinessScore}% threshold — exporting anyway via explicit override.`,
    };
  }
  return {
    allowed: false,
    requiresOverride: true,
    reason: `Commercial Readiness ${report.score}% is below the ${config.minReadinessScore}% threshold. Blocked — override required to export.`,
  };
}
