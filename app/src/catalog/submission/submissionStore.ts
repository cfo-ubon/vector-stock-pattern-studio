import { isValidSubmissionRecord, normalizeSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';

// Build 015 — isolated Submission Center storage. The brief explicitly
// asks to avoid an IndexedDB schema change ("No IndexedDB schema changes
// unless absolutely required... create isolated submission storage" if
// persistence is needed) — a `localStorage`-backed store, one dedicated
// `STORAGE_KEY`, JSON serialize/parse, matches the same convention
// `workbench/workspaceSettings.ts` and P3's own
// `catalog/backup/backupHistoryStore.ts` already established for exactly
// this situation. This store never touches `storage/db.ts`'s IndexedDB
// connection, `DB_VERSION`, or any Collection-module object store — it
// is genuinely isolated, not just conceptually isolated.

const STORAGE_KEY = 'vsp-submission-center-records';

interface SubmissionStoreFile {
  schemaVersion: number;
  records: SubmissionRecord[];
}

const STORE_SCHEMA_VERSION = 1;

function readStoreFile(): SubmissionStoreFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: STORE_SCHEMA_VERSION, records: [] };
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as Partial<SubmissionStoreFile> | null;
    const records = Array.isArray(obj?.records)
      ? obj.records.filter(isValidSubmissionRecord).map(normalizeSubmissionRecord)
      : [];
    return { schemaVersion: STORE_SCHEMA_VERSION, records };
  } catch {
    return { schemaVersion: STORE_SCHEMA_VERSION, records: [] };
  }
}

export class SubmissionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionStorageError';
  }
}

function writeStoreFile(file: SubmissionStoreFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch (err) {
    throw new SubmissionStorageError(`Failed to persist submission records: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function loadSubmissions(): SubmissionRecord[] {
  return readStoreFile().records;
}

export function getSubmission(submissionId: string): SubmissionRecord | undefined {
  return readStoreFile().records.find((r) => r.submissionId === submissionId);
}

export function countSubmissions(): number {
  return readStoreFile().records.length;
}

/** Insert-or-replace by `submissionId` — the one write primitive every
 * other mutation in this module goes through, so "persist a record" has
 * exactly one implementation to get right. */
export function putSubmission(record: SubmissionRecord): void {
  const file = readStoreFile();
  const index = file.records.findIndex((r) => r.submissionId === record.submissionId);
  const records = index === -1 ? [...file.records, record] : file.records.map((r, i) => (i === index ? record : r));
  writeStoreFile({ schemaVersion: STORE_SCHEMA_VERSION, records });
}

export function putSubmissionsBulk(records: SubmissionRecord[]): void {
  const file = readStoreFile();
  const byId = new Map(file.records.map((r) => [r.submissionId, r]));
  for (const record of records) byId.set(record.submissionId, record);
  writeStoreFile({ schemaVersion: STORE_SCHEMA_VERSION, records: [...byId.values()] });
}

export function deleteSubmission(submissionId: string): void {
  const file = readStoreFile();
  writeStoreFile({ schemaVersion: STORE_SCHEMA_VERSION, records: file.records.filter((r) => r.submissionId !== submissionId) });
}

export function clearSubmissionStore(): void {
  writeStoreFile({ schemaVersion: STORE_SCHEMA_VERSION, records: [] });
}
