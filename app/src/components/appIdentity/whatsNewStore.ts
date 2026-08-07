// AI-SBOS Mission, Part 3 — What's New. Plain localStorage keys, same
// convention `App.tsx`'s own `GALLERY_STORAGE_KEY` already uses — this is
// a small UI preference (has the owner seen this version's highlights, did
// they opt out of ever seeing this dialog), not domain data, so it doesn't
// need the IndexedDB catalog stores the rest of the app's real business
// records use. Every read/write is wrapped defensively: localStorage can
// throw in private-browsing/storage-restricted contexts, and the correct
// fallback is simply "show the dialog again next time," never a crash.

const LAST_SEEN_VERSION_KEY = 'aisbos.whatsNew.lastSeenVersion';
const DONT_SHOW_AGAIN_KEY = 'aisbos.whatsNew.dontShowAgain';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the dialog will simply show again next
    // session, which is an honest, harmless fallback, not a bug to hide.
  }
}

export function isDontShowAgainEnabled(): boolean {
  return safeGet(DONT_SHOW_AGAIN_KEY) === 'true';
}

export function setDontShowAgain(enabled: boolean): void {
  safeSet(DONT_SHOW_AGAIN_KEY, String(enabled));
}

export function markVersionSeen(version: string): void {
  safeSet(LAST_SEEN_VERSION_KEY, version);
}

/** True exactly once per real version bump the owner hasn't already
 * dismissed (via "เข้าใจแล้ว"/close) or globally opted out of via "Don't
 * show again" — never shows twice for the same version in the same
 * browser profile. */
export function shouldShowWhatsNew(currentVersion: string): boolean {
  if (isDontShowAgainEnabled()) return false;
  return safeGet(LAST_SEEN_VERSION_KEY) !== currentVersion;
}
