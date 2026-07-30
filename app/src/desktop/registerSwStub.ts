// Build-time stand-in for vite-plugin-pwa's `virtual:pwa-register/react`
// module, used only by the desktop build (see `vite.config.desktop.ts`'s
// alias). That virtual module only exists when the `VitePWA` plugin is
// registered, and the desktop config deliberately omits it — an Electron
// build ships every asset inside the installer, so there is no
// "first-visit precache" step for a service worker to manage. Desktop
// content is always available offline by construction, so `offlineReady`
// is permanently `true` and there is never a `needRefresh` prompt (app
// updates arrive as a new installer, not a live service-worker swap).
export function useRegisterSW(_options?: {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}): {
  offlineReady: [boolean, (v: boolean) => void];
  needRefresh: [boolean, (v: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  return {
    offlineReady: [true, () => {}],
    needRefresh: [false, () => {}],
    updateServiceWorker: async () => {},
  };
}
