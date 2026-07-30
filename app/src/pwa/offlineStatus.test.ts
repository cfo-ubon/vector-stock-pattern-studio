import { describe, it, expect, vi } from 'vitest';
import { getConnectivityStatus, subscribeToConnectivity, hasActiveServiceWorkerController, CONNECTIVITY_LABEL_TH } from './offlineStatus';

describe('getConnectivityStatus', () => {
  it('reports online when navigator.onLine is true', () => {
    expect(getConnectivityStatus({ onLine: true })).toBe('online');
  });

  it('reports offline when navigator.onLine is false', () => {
    expect(getConnectivityStatus({ onLine: false })).toBe('offline');
  });
});

describe('subscribeToConnectivity', () => {
  it('registers online/offline listeners and forwards status changes', () => {
    const listeners: Record<string, () => void> = {};
    const target = {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn(),
    };
    const onChange = vi.fn();

    const unsubscribe = subscribeToConnectivity(onChange, target as unknown as Window);

    expect(target.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(target.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

    listeners.online();
    expect(onChange).toHaveBeenLastCalledWith('online');

    listeners.offline();
    expect(onChange).toHaveBeenLastCalledWith('offline');

    unsubscribe();
    expect(target.removeEventListener).toHaveBeenCalledTimes(2);
  });
});

describe('hasActiveServiceWorkerController', () => {
  it('returns false when navigator.serviceWorker is undefined', () => {
    expect(hasActiveServiceWorkerController({} as Navigator)).toBe(false);
  });

  it('returns false when no controller is set (first, not-yet-cached load)', () => {
    expect(hasActiveServiceWorkerController({ serviceWorker: { controller: null } } as unknown as Navigator)).toBe(false);
  });

  it('returns true when a controller already exists (reload of an already-installed PWA)', () => {
    expect(
      hasActiveServiceWorkerController({ serviceWorker: { controller: {} } } as unknown as Navigator),
    ).toBe(true);
  });
});

describe('CONNECTIVITY_LABEL_TH', () => {
  it('has a Thai label for every status', () => {
    expect(CONNECTIVITY_LABEL_TH.online).toBeTruthy();
    expect(CONNECTIVITY_LABEL_TH.offline).toBeTruthy();
  });
});
