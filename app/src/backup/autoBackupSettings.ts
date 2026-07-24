// Application Backup System — Auto Backup trigger settings + cadence.
//
// Storage follows the same `readJson`/`writeJson`-shaped localStorage
// convention every other settings module in this repo uses
// (`storage/styleDnaStore.ts`, `workbench/workspaceSettings.ts`, etc.),
// under its own key (`vsp-auto-backup-settings-v1`) — which is itself
// included in `APP_BACKUP_SETTINGS_KEYS`, so a user's auto-backup
// preferences travel with a full application backup like every other
// setting.
//
// "Before restore" and "before migration" triggers from the brief are
// NOT configurable here — `appBackupRestore.ts` unconditionally takes a
// Safety Backup before every restore (the brief's own "always create a
// Safety Backup first" rule), so there is nothing to toggle for that
// case. This module only covers the genuinely optional, periodic
// triggers: on launch, on exit, and on a daily/weekly/monthly cadence.

export type AutoBackupFrequency = 'off' | 'everyLaunch' | 'daily' | 'weekly' | 'monthly';
export type AutoBackupRetention = 5 | 10 | 20 | 'unlimited';

export interface AutoBackupSettings {
  frequency: AutoBackupFrequency;
  backupOnExit: boolean;
  retention: AutoBackupRetention;
  lastAutoBackupAt: number | null;
}

export const AUTO_BACKUP_SETTINGS_KEY = 'vsp-auto-backup-settings-v1';

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  frequency: 'off',
  backupOnExit: false,
  retention: 10,
  lastAutoBackupAt: null,
};

function isValidFrequency(value: unknown): value is AutoBackupFrequency {
  return value === 'off' || value === 'everyLaunch' || value === 'daily' || value === 'weekly' || value === 'monthly';
}

function isValidRetention(value: unknown): value is AutoBackupRetention {
  return value === 5 || value === 10 || value === 20 || value === 'unlimited';
}

export function loadAutoBackupSettings(): AutoBackupSettings {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AutoBackupSettings>;
    return {
      frequency: isValidFrequency(parsed.frequency) ? parsed.frequency : DEFAULT_AUTO_BACKUP_SETTINGS.frequency,
      backupOnExit: typeof parsed.backupOnExit === 'boolean' ? parsed.backupOnExit : DEFAULT_AUTO_BACKUP_SETTINGS.backupOnExit,
      retention: isValidRetention(parsed.retention) ? parsed.retention : DEFAULT_AUTO_BACKUP_SETTINGS.retention,
      lastAutoBackupAt: typeof parsed.lastAutoBackupAt === 'number' ? parsed.lastAutoBackupAt : null,
    };
  } catch {
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
  }
}

export function saveAutoBackupSettings(settings: AutoBackupSettings): void {
  try {
    localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage quota exceeded — nothing else to do, matches
    // `storage/db.ts`'s `lsStore` fallback convention.
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FREQUENCY_INTERVAL_MS: Partial<Record<AutoBackupFrequency, number>> = {
  daily: DAY_MS,
  weekly: DAY_MS * 7,
  monthly: DAY_MS * 30,
};

/** Pure cadence check — no I/O, no Date.now() default so callers/tests
 * can pass a fixed `now` and get a deterministic answer. `everyLaunch`
 * is always due when checked (the caller is expected to only check this
 * once per actual app launch, not on every render). */
export function isAutoBackupDue(settings: AutoBackupSettings, now: number): boolean {
  if (settings.frequency === 'off') return false;
  if (settings.frequency === 'everyLaunch') return true;
  if (settings.lastAutoBackupAt === null) return true;
  const interval = FREQUENCY_INTERVAL_MS[settings.frequency];
  if (interval === undefined) return false;
  return now - settings.lastAutoBackupAt >= interval;
}

/** `null` means unlimited (no pruning). */
export function retentionLimit(retention: AutoBackupRetention): number | null {
  return retention === 'unlimited' ? null : retention;
}
