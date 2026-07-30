// Build 027 Phase 2 — pure connectivity helpers, kept free of the
// `virtual:pwa-register` module so they're trivially unit-testable
// without a real service worker or build-time plugin.

export type ConnectivityStatus = 'online' | 'offline';

export function getConnectivityStatus(nav: Pick<Navigator, 'onLine'> = navigator): ConnectivityStatus {
  return nav.onLine ? 'online' : 'offline';
}

export function subscribeToConnectivity(
  onChange: (status: ConnectivityStatus) => void,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  const handleOnline = () => onChange('online');
  const handleOffline = () => onChange('offline');
  target.addEventListener('online', handleOnline);
  target.addEventListener('offline', handleOffline);
  return () => {
    target.removeEventListener('online', handleOnline);
    target.removeEventListener('offline', handleOffline);
  };
}

export const CONNECTIVITY_LABEL_TH: Record<ConnectivityStatus, string> = {
  online: 'ออนไลน์',
  offline: 'ออฟไลน์',
};

/** True when a service worker is already controlling this page load —
 * i.e. the app was already installed offline-ready from a previous
 * visit, as opposed to this being the very first, not-yet-cached load. */
export function hasActiveServiceWorkerController(
  nav: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): boolean {
  return Boolean(nav?.serviceWorker?.controller);
}
