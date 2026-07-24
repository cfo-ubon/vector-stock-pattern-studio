import { describe, it, expect } from 'vitest';
import { classifyBackupCompatibility } from './migrationCompatibility';

describe('classifyBackupCompatibility', () => {
  it('classifies equal versions as "same"', () => {
    const result = classifyBackupCompatibility(7, 7);
    expect(result.compatibility).toBe('same');
  });

  it('classifies a backup from an older schema as "olderBackup"', () => {
    const result = classifyBackupCompatibility(4, 7);
    expect(result.compatibility).toBe('olderBackup');
    expect(result.message).toContain('older');
  });

  it('classifies a backup from a newer schema as "newerBackup"', () => {
    const result = classifyBackupCompatibility(9, 7);
    expect(result.compatibility).toBe('newerBackup');
    expect(result.message.toUpperCase()).toContain('NEWER');
  });

  it('always echoes back the exact input versions', () => {
    const result = classifyBackupCompatibility(3, 5);
    expect(result.backupDbVersion).toBe(3);
    expect(result.currentDbVersion).toBe(5);
  });
});
