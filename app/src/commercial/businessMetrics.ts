import type { CommercialPackageHistoryEntry, CommercialReadinessReport, BusinessMetricsSnapshot } from './domain/types';

// Build 031A, Phase 8 — Business Metrics. Every figure here is derived
// from the real, already-persisted `CommercialPackageHistoryEntry[]`
// (Phase 2's append-only build log) and the current batch of
// `CommercialReadinessReport[]` — nothing is estimated except
// `ownerTimeSavedMinutesToday`, which is explicitly documented as an
// estimate against a fixed, disclosed per-package baseline (never
// presented as a measured fact), matching the spec's "Use only verified
// data" instruction.

/** Minutes a contributor would typically spend hand-assembling one
 * marketplace package (gathering files, writing metadata, checking
 * duplicates) — a documented assumption, not a measurement. Shown in the
 * UI alongside this constant so it's never mistaken for tracked data. */
export const MANUAL_MINUTES_PER_PACKAGE_BASELINE = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeBusinessMetrics(history: CommercialPackageHistoryEntry[], reports: CommercialReadinessReport[], now: number = Date.now()): BusinessMetricsSnapshot {
  const dayStart = startOfDay(now);
  const weekStart = now - WEEK_MS;

  const today = history.filter((e) => e.createdAt >= dayStart);
  const thisWeek = history.filter((e) => e.createdAt >= weekStart);

  const hoursElapsedToday = Math.max((now - dayStart) / (60 * 60 * 1000), 1 / 60);
  const packagesPerHour = today.length > 0 ? Math.round((today.length / hoursElapsedToday) * 10) / 10 : null;

  const readinessScores = reports.map((r) => r.score);
  const commercialReadinessAverage = readinessScores.length > 0 ? Math.round(readinessScores.reduce((s, v) => s + v, 0) / readinessScores.length) : null;

  const readyToday = today.filter((e) => e.status === 'BUILT').length;
  const readyThisWeek = thisWeek.filter((e) => e.status === 'BUILT').length;

  const ownerTimeSavedMinutesToday = today.length * MANUAL_MINUTES_PER_PACKAGE_BASELINE;

  const automationPercent = today.length > 0 ? Math.round((today.filter((e) => e.status === 'BUILT').length / today.length) * 100) : null;

  return {
    computedAt: now,
    commercialThroughputToday: today.length,
    packagesPerHour,
    commercialReadinessAverage,
    // Not tracked yet — no per-package "started" timestamp exists anywhere
    // in the pipeline to measure a real completion duration against.
    averageCompletionTimeMs: null,
    readyToday,
    readyThisWeek,
    ownerTimeSavedMinutesToday,
    automationPercent,
  };
}
