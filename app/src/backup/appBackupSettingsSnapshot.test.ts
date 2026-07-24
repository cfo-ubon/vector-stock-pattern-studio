import { describe, it, expect, beforeEach } from 'vitest';
import { captureSettingsSnapshot, applySettingsSnapshot, settingsSnapshotEntryName, settingsKeyFromEntryName } from './appBackupSettingsSnapshot';

beforeEach(() => {
  localStorage.clear();
});

describe('captureSettingsSnapshot', () => {
  it('captures every requested key that exists in localStorage', () => {
    localStorage.setItem('vsp-gallery-v1', '[]');
    localStorage.setItem('vsp-workbench-settings', '{"a":1}');
    const snapshot = captureSettingsSnapshot(['vsp-gallery-v1', 'vsp-workbench-settings']);
    expect(snapshot.values).toEqual({ 'vsp-gallery-v1': '[]', 'vsp-workbench-settings': '{"a":1}' });
  });

  it('omits keys that were never written, not writes them as null/empty', () => {
    localStorage.setItem('vsp-gallery-v1', '[]');
    const snapshot = captureSettingsSnapshot(['vsp-gallery-v1', 'vsp-never-written']);
    expect(Object.keys(snapshot.values)).toEqual(['vsp-gallery-v1']);
  });

  it('captures raw string content byte-identically, without re-parsing/re-serializing', () => {
    const weird = '  {"a":  1}  '; // deliberately non-canonical spacing
    localStorage.setItem('vsp-gallery-v1', weird);
    const snapshot = captureSettingsSnapshot(['vsp-gallery-v1']);
    expect(snapshot.values['vsp-gallery-v1']).toBe(weird);
  });
});

describe('applySettingsSnapshot', () => {
  it('writes every key in the snapshot back to localStorage', () => {
    applySettingsSnapshot({ values: { 'vsp-gallery-v1': '[1,2,3]', 'vsp-workbench-settings': '{}' } });
    expect(localStorage.getItem('vsp-gallery-v1')).toBe('[1,2,3]');
    expect(localStorage.getItem('vsp-workbench-settings')).toBe('{}');
  });

  it('does not remove existing localStorage keys the snapshot does not mention', () => {
    localStorage.setItem('vsp-unrelated-key', 'still here');
    applySettingsSnapshot({ values: { 'vsp-gallery-v1': '[]' } });
    expect(localStorage.getItem('vsp-unrelated-key')).toBe('still here');
  });

  it('overwrites an existing key with the snapshot value', () => {
    localStorage.setItem('vsp-gallery-v1', '[old]');
    applySettingsSnapshot({ values: { 'vsp-gallery-v1': '[new]' } });
    expect(localStorage.getItem('vsp-gallery-v1')).toBe('[new]');
  });
});

describe('settingsSnapshotEntryName / settingsKeyFromEntryName — round-trip', () => {
  it('round-trips a plain key', () => {
    const name = settingsSnapshotEntryName('vsp-gallery-v1');
    expect(name).toBe('settings/vsp-gallery-v1.json');
    expect(settingsKeyFromEntryName(name, 'settings/')).toBe('vsp-gallery-v1');
  });

  it('round-trips a key with unusual characters via encodeURIComponent', () => {
    const key = 'vsp-key with spaces/slash';
    const name = settingsSnapshotEntryName(key);
    expect(settingsKeyFromEntryName(name, 'settings/')).toBe(key);
  });

  it('returns null for a name that does not match the prefix', () => {
    expect(settingsKeyFromEntryName('assets/foo.json', 'settings/')).toBeNull();
  });

  it('returns null for a name that does not end in .json', () => {
    expect(settingsKeyFromEntryName('settings/foo.txt', 'settings/')).toBeNull();
  });
});
