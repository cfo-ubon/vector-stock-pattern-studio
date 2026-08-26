// AI-SBOS v3 — What's New storage, namespaced by version line
// (`aisbos.v3.*`). localStorage is scoped by origin, not by path, so v1/
// v2/v3 (same origin, different /studio/vN/ paths) would otherwise share
// an unnamespaced key and could incorrectly suppress each other's release
// notice — confirmed by direct testing in the Multi-Version Release
// mission. Same defensive-read/write convention as v2's own
// `whatsNewStore.ts` (never throws; degrades to "show again").

const LAST_SEEN_VERSION_KEY = 'aisbos.v3.whatsNew.lastSeenVersion';
const DONT_SHOW_AGAIN_KEY = 'aisbos.v3.whatsNew.dontShowAgain';

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
    // Storage unavailable — show again next session, an honest fallback.
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

export function shouldShowWhatsNew(currentVersion: string): boolean {
  if (isDontShowAgainEnabled()) return false;
  return safeGet(LAST_SEEN_VERSION_KEY) !== currentVersion;
}
