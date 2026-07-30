// Build 027 Phase 2 — pure state description for the service-worker
// update flow. The actual registration lives in
// components/pwa/OfflineStatusBar.tsx via vite-plugin-pwa's
// `useRegisterSW` hook (a virtual module only resolvable inside a Vite
// build/dev context); this module holds only the state shape and its
// Thai labels so the update-prompt *logic* is unit-testable without one.

export type OfflineReadiness =
  | 'downloading' // first-visit precache still in progress
  | 'ready' // app shell fully cached, safe to go offline
  | 'update-available' // a new build is cached and waiting for confirmation
  | 'unsupported'; // service workers unavailable in this context

export function describeOfflineReadiness(state: OfflineReadiness): string {
  switch (state) {
    case 'downloading':
      return 'กำลังดาวน์โหลดไฟล์สำหรับใช้งานออฟไลน์...';
    case 'ready':
      return 'พร้อมใช้งานออฟไลน์แล้ว';
    case 'update-available':
      return 'มีอัปเดตใหม่พร้อมติดตั้ง';
    case 'unsupported':
      return 'เบราว์เซอร์นี้ไม่รองรับการใช้งานออฟไลน์';
  }
}

/** Never collapse "update-available" into "ready" — that would let a
 * pending update silently apply itself on next reload without the
 * confirmation Phase 2 requires. Both offlineReady and needRefresh can
 * legitimately be true at once (offline-ready from the *previous*
 * install, needRefresh for the newly waiting one); needRefresh must win
 * so the update banner still appears.
 *
 * `hasActiveController` covers a real gap in vite-plugin-pwa's own flags,
 * found by testing an actual offline reload rather than trusting the
 * hook's states in isolation: `offlineReady` only flips true at the
 * moment THIS registration's precache finishes, so a plain reload of an
 * already-installed PWA (SW already controlling the page from a prior
 * visit, precache already complete) reports neither flag and would
 * wrongly show "still downloading" even though the reload that just
 * succeeded offline proves otherwise. */
export function resolveOfflineReadiness(
  offlineReady: boolean,
  needRefresh: boolean,
  hasActiveController = false,
): OfflineReadiness {
  if (needRefresh) return 'update-available';
  if (offlineReady || hasActiveController) return 'ready';
  return 'downloading';
}
