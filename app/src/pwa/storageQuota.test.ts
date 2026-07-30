import { describe, it, expect, vi } from 'vitest';
import {
  estimateStorageUsage,
  requestPersistentStorage,
  isStoragePersisted,
  classifyStorageRisk,
  formatBytes,
  isQuotaExceededError,
  STORAGE_WARNING_RATIO,
  STORAGE_CRITICAL_RATIO,
} from './storageQuota';

function fakeStorageManager(overrides: Partial<StorageManager> = {}): StorageManager {
  return {
    estimate: vi.fn(async () => ({ usage: 0, quota: 0 })),
    persist: vi.fn(async () => false),
    persisted: vi.fn(async () => false),
    ...overrides,
  } as unknown as StorageManager;
}

describe('estimateStorageUsage', () => {
  it('returns null when navigator.storage is unavailable', async () => {
    expect(await estimateStorageUsage(undefined)).toBeNull();
  });

  it('returns null when quota is zero (avoids divide-by-zero)', async () => {
    const storage = fakeStorageManager({ estimate: vi.fn(async () => ({ usage: 0, quota: 0 })) });
    expect(await estimateStorageUsage(storage)).toBeNull();
  });

  it('computes usageRatio from usage/quota', async () => {
    const storage = fakeStorageManager({ estimate: vi.fn(async () => ({ usage: 50, quota: 200 })) });
    expect(await estimateStorageUsage(storage)).toEqual({ usageBytes: 50, quotaBytes: 200, usageRatio: 0.25 });
  });
});

describe('requestPersistentStorage / isStoragePersisted', () => {
  it('returns false when storage manager is unavailable', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
    expect(await isStoragePersisted(undefined)).toBe(false);
  });

  it('forwards the real persist()/persisted() result', async () => {
    const storage = fakeStorageManager({ persist: vi.fn(async () => true), persisted: vi.fn(async () => true) });
    expect(await requestPersistentStorage(storage)).toBe(true);
    expect(await isStoragePersisted(storage)).toBe(true);
  });
});

describe('classifyStorageRisk', () => {
  it('classifies below warning threshold as ok', () => {
    expect(classifyStorageRisk(STORAGE_WARNING_RATIO - 0.01)).toBe('ok');
  });

  it('classifies between warning and critical as warning', () => {
    expect(classifyStorageRisk(STORAGE_WARNING_RATIO)).toBe('warning');
    expect(classifyStorageRisk(STORAGE_CRITICAL_RATIO - 0.01)).toBe('warning');
  });

  it('classifies at/above critical threshold as critical', () => {
    expect(classifyStorageRisk(STORAGE_CRITICAL_RATIO)).toBe('critical');
    expect(classifyStorageRisk(1)).toBe('critical');
  });
});

describe('formatBytes', () => {
  it('formats bytes below 1024 as-is', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats larger sizes with the correct unit', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB');
  });
});

describe('isQuotaExceededError', () => {
  it('recognizes a DOMException-shaped QuotaExceededError', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
  });

  it('rejects unrelated errors and non-objects', () => {
    expect(isQuotaExceededError(new Error('nope'))).toBe(false);
    expect(isQuotaExceededError('QuotaExceededError')).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});
