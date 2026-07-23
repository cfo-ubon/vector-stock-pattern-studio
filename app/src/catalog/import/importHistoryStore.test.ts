import { describe, it, expect, beforeEach } from 'vitest';
import { createImportHistoryRecord, loadImportHistory, putImportHistoryRecord, clearImportHistory, isValidImportHistoryRecord } from './importHistoryStore';
import type { HistoricalImportReport } from './historicalPortfolioImport';

beforeEach(async () => {
  await clearImportHistory();
});

function makeReport(overrides: Partial<HistoricalImportReport> = {}): HistoricalImportReport {
  return {
    importedAt: Date.now(),
    buildLabelsSeen: ['portfolio_phase_1'],
    assetsImported: 1,
    assetsSkippedAsDuplicate: 0,
    assetsErrored: 0,
    manifestEntriesFound: 1,
    skippedFiles: [],
    missingReferences: [],
    malformedManifestFiles: [],
    ...overrides,
  };
}

describe('createImportHistoryRecord', () => {
  it('wraps a report with an id and schema version', () => {
    const report = makeReport({ importedAt: 1000 });
    const record = createImportHistoryRecord(report);
    expect(record.importedAt).toBe(1000);
    expect(record.report).toEqual(report);
    expect(record.schemaVersion).toBe(1);
  });
});

describe('importHistoryStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadImportHistory()).toEqual([]);
  });

  it('persists and retrieves records, newest first', async () => {
    const older = createImportHistoryRecord(makeReport({ importedAt: 1000 }), 1000);
    const newer = createImportHistoryRecord(makeReport({ importedAt: 2000 }), 2000);
    await putImportHistoryRecord(older);
    await putImportHistoryRecord(newer);
    const all = await loadImportHistory();
    expect(all.map((r) => r.importId)).toEqual([newer.importId, older.importId]);
  });

  it('clearImportHistory empties the store', async () => {
    await putImportHistoryRecord(createImportHistoryRecord(makeReport()));
    await clearImportHistory();
    expect(await loadImportHistory()).toEqual([]);
  });
});

describe('isValidImportHistoryRecord', () => {
  it('validates a real record and rejects a malformed one', () => {
    expect(isValidImportHistoryRecord(createImportHistoryRecord(makeReport()))).toBe(true);
    expect(isValidImportHistoryRecord({})).toBe(false);
    expect(isValidImportHistoryRecord(null)).toBe(false);
  });
});
