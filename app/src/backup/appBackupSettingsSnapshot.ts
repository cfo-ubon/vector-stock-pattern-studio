// Application Backup System — localStorage settings snapshot/restore.
//
// Every settings/preset module in this repo (`storage/styleDnaStore.ts`,
// `workbench/workspaceSettings.ts`, `workbench/workbenchFavorites.ts`,
// `assets/library.ts`, `knowledge/history/index.ts`) stores its data as one
// plain-JSON value under one localStorage key — so a full snapshot/restore
// needs no per-module type imports, just the list of keys to carry
// (`APP_BACKUP_SETTINGS_KEYS`) and generic `JSON.parse`/`JSON.stringify`.
//
// A key that has never been written (fresh install, or a feature the user
// never touched) is simply absent from the snapshot — restore leaves
// localStorage untouched for that key rather than writing an empty/null
// value over it.

import { APP_BACKUP_SETTINGS_KEYS } from './appBackupFormat';

export interface AppBackupSettingsSnapshot {
  /** Raw JSON text as stored in localStorage, keyed by localStorage key —
   * kept as the original string (not re-parsed/re-serialized) so restore
   * writes back byte-identical content, and a value that happens not to be
   * valid JSON (shouldn't happen, but no module enforces it at write time)
   * still round-trips instead of throwing during backup. */
  values: Record<string, string>;
}

export function captureSettingsSnapshot(
  keys: readonly string[] = APP_BACKUP_SETTINGS_KEYS
): AppBackupSettingsSnapshot {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw !== null) values[key] = raw;
  }
  return { values };
}

/** Writes every key in the snapshot back to localStorage. Restore is
 * additive/overwrite-only per key — it never removes a localStorage key
 * that the snapshot doesn't mention, since that key might belong to a
 * feature added after this backup was taken. */
export function applySettingsSnapshot(snapshot: AppBackupSettingsSnapshot): void {
  for (const [key, raw] of Object.entries(snapshot.values)) {
    localStorage.setItem(key, raw);
  }
}

export function settingsSnapshotEntryName(key: string): string {
  return `settings/${encodeURIComponent(key)}.json`;
}

export function settingsKeyFromEntryName(entryName: string, prefix: string): string | null {
  if (!entryName.startsWith(prefix) || !entryName.endsWith('.json')) return null;
  const encoded = entryName.slice(prefix.length, entryName.length - '.json'.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
