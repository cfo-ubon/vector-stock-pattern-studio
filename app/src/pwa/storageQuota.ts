// Build 027 Phase 3 — storage quota estimation and persistence requests.
// Kept as thin, mockable wrappers around the StorageManager API so the
// warning-threshold logic itself is pure and unit-testable without a
// real browser storage quota.

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  usageRatio: number;
}

/** Safari/iPadOS in particular can omit `navigator.storage` entirely in
 * older versions or restricted contexts, so every caller must treat
 * `null` as "unknown," not as "zero usage." */
export async function estimateStorageUsage(
  storage: StorageManager | undefined = navigator.storage,
): Promise<StorageEstimateInfo | null> {
  if (!storage || typeof storage.estimate !== 'function') return null;
  const { usage, quota } = await storage.estimate();
  if (usage === undefined || quota === undefined || quota === 0) return null;
  return { usageBytes: usage, quotaBytes: quota, usageRatio: usage / quota };
}

export async function requestPersistentStorage(
  storage: StorageManager | undefined = navigator.storage,
): Promise<boolean> {
  if (!storage || typeof storage.persist !== 'function') return false;
  return storage.persist();
}

export async function isStoragePersisted(
  storage: StorageManager | undefined = navigator.storage,
): Promise<boolean> {
  if (!storage || typeof storage.persisted !== 'function') return false;
  return storage.persisted();
}

// Warn the user well before the browser starts evicting data — iPadOS
// Safari's eviction behavior under storage pressure is not something this
// app can rely on being graceful, so the warning must trigger with real
// margin left.
export const STORAGE_WARNING_RATIO = 0.8;
export const STORAGE_CRITICAL_RATIO = 0.95;

export type StorageRiskLevel = 'ok' | 'warning' | 'critical';

export function classifyStorageRisk(usageRatio: number): StorageRiskLevel {
  if (usageRatio >= STORAGE_CRITICAL_RATIO) return 'critical';
  if (usageRatio >= STORAGE_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

// QuotaExceededError can surface as either a DOMException with this name,
// or (in some IndexedDB implementations) as a plain error carrying the
// same name property — check by name only, never by instanceof, so both
// shapes are handled identically.
export function isQuotaExceededError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'QuotaExceededError'
  );
}
