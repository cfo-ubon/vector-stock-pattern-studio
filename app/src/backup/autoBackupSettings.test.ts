import { describe, it, expect, beforeEach } from 'vitest';
import { loadAutoBackupSettings, saveAutoBackupSettings, isAutoBackupDue, retentionLimit, DEFAULT_AUTO_BACKUP_SETTINGS, AUTO_BACKUP_SETTINGS_KEY } from './autoBackupSettings';
import type { AutoBackupSettings } from './autoBackupSettings';

beforeEach(() => {
  localStorage.clear();
});

describe('loadAutoBackupSettings / saveAutoBackupSettings', () => {
  it('returns the defaults when nothing has been saved yet', () => {
    expect(loadAutoBackupSettings()).toEqual(DEFAULT_AUTO_BACKUP_SETTINGS);
  });

  it('round-trips a saved settings object', () => {
    const settings: AutoBackupSettings = { frequency: 'daily', backupOnExit: true, retention: 20, lastAutoBackupAt: 12345 };
    saveAutoBackupSettings(settings);
    expect(loadAutoBackupSettings()).toEqual(settings);
  });

  it('falls back to defaults for individual fields that are missing or invalid, rather than throwing', () => {
    localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify({ frequency: 'not-a-real-frequency', retention: 999 }));
    const loaded = loadAutoBackupSettings();
    expect(loaded.frequency).toBe('off');
    expect(loaded.retention).toBe(10);
  });

  it('does not throw on malformed JSON, falls back to defaults', () => {
    localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, '{not json');
    expect(loadAutoBackupSettings()).toEqual(DEFAULT_AUTO_BACKUP_SETTINGS);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('isAutoBackupDue', () => {
  it('is never due when frequency is off', () => {
    expect(isAutoBackupDue({ frequency: 'off', backupOnExit: false, retention: 10, lastAutoBackupAt: 0 }, Date.now())).toBe(false);
  });

  it('is always due for everyLaunch regardless of lastAutoBackupAt', () => {
    expect(isAutoBackupDue({ frequency: 'everyLaunch', backupOnExit: false, retention: 10, lastAutoBackupAt: Date.now() }, Date.now())).toBe(true);
  });

  it('is due if never backed up before, for a periodic frequency', () => {
    expect(isAutoBackupDue({ frequency: 'daily', backupOnExit: false, retention: 10, lastAutoBackupAt: null }, Date.now())).toBe(true);
  });

  it('daily: not due before 24 hours have elapsed', () => {
    const now = 1_700_000_000_000;
    const settings: AutoBackupSettings = { frequency: 'daily', backupOnExit: false, retention: 10, lastAutoBackupAt: now - DAY_MS + 1000 };
    expect(isAutoBackupDue(settings, now)).toBe(false);
  });

  it('daily: due once 24 hours have elapsed', () => {
    const now = 1_700_000_000_000;
    const settings: AutoBackupSettings = { frequency: 'daily', backupOnExit: false, retention: 10, lastAutoBackupAt: now - DAY_MS };
    expect(isAutoBackupDue(settings, now)).toBe(true);
  });

  it('weekly: not due after only 3 days', () => {
    const now = 1_700_000_000_000;
    const settings: AutoBackupSettings = { frequency: 'weekly', backupOnExit: false, retention: 10, lastAutoBackupAt: now - DAY_MS * 3 };
    expect(isAutoBackupDue(settings, now)).toBe(false);
  });

  it('monthly: due after 30 days', () => {
    const now = 1_700_000_000_000;
    const settings: AutoBackupSettings = { frequency: 'monthly', backupOnExit: false, retention: 10, lastAutoBackupAt: now - DAY_MS * 30 };
    expect(isAutoBackupDue(settings, now)).toBe(true);
  });
});

describe('retentionLimit', () => {
  it('returns the numeric limit for 5/10/20', () => {
    expect(retentionLimit(5)).toBe(5);
    expect(retentionLimit(10)).toBe(10);
    expect(retentionLimit(20)).toBe(20);
  });

  it('returns null (unlimited) for "unlimited"', () => {
    expect(retentionLimit('unlimited')).toBeNull();
  });
});
