import { describe, it, expect } from 'vitest';
import { resolveOfflineReadiness, describeOfflineReadiness } from './updatePrompt';

describe('resolveOfflineReadiness', () => {
  it('reports downloading when neither flag is set', () => {
    expect(resolveOfflineReadiness(false, false)).toBe('downloading');
  });

  it('reports ready when offline-ready and no update is pending', () => {
    expect(resolveOfflineReadiness(true, false)).toBe('ready');
  });

  it('reports update-available whenever needRefresh is true, even if offlineReady is also true', () => {
    expect(resolveOfflineReadiness(false, true)).toBe('update-available');
    expect(resolveOfflineReadiness(true, true)).toBe('update-available');
  });

  it('reports ready when a service worker already controls the page, even if offlineReady never fired this load', () => {
    expect(resolveOfflineReadiness(false, false, true)).toBe('ready');
  });

  it('still reports update-available when a controller exists but an update is pending', () => {
    expect(resolveOfflineReadiness(false, true, true)).toBe('update-available');
  });
});

describe('describeOfflineReadiness', () => {
  it('has a non-empty Thai label for every state', () => {
    for (const state of ['downloading', 'ready', 'update-available', 'unsupported'] as const) {
      expect(describeOfflineReadiness(state)).toBeTruthy();
    }
  });
});
