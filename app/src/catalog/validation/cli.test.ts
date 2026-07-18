import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollection } from '../domain/collection';
import { putCollectionRecord, loadCollections, clearCollectionsStore } from '../storage/collectionStore';

// Portfolio Manager P2.5 Sprint 1, Section 11's "CLI/integration" test
// category. These spawn the real CLI (`scripts/validateCollections.ts`)
// as a genuine child process via `tsx` — the same way a developer would
// run `npm run validate:collections:*` — rather than importing the
// script's internals, since the point is to prove the *command* works
// end to end, including its own separate `fake-indexeddb` install.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(APP_ROOT, 'validation-results', 'collections');

function runCli(mode: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', 'scripts/validateCollections.ts', mode], { cwd: APP_ROOT, encoding: 'utf-8', timeout: 60000 });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number | null };
    return { stdout: e.stdout ?? '', status: e.status ?? 1 };
  }
}

beforeAll(async () => {
  await clearCollectionsStore();
});

afterAll(async () => {
  await clearCollectionsStore();
});

describe('validate:collections CLI — real subprocess', () => {
  it(
    'the default validation command succeeds (exit 0) and writes both JSON and Markdown reports',
    () => {
      const { stdout, status } = runCli('integrity'); // fastest full-flow-shaped mode for a CI-friendly test
      expect(status).toBe(0);
      expect(stdout).toContain('Reports written to');
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'integrity.json'))).toBe(true);
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'integrity.md'))).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'integrity.json'), 'utf-8'));
      expect(parsed.gitCommit).toBeTruthy();
    },
    60000,
  );

  it(
    'an unknown mode (bad configuration) exits non-zero without writing reports for that run',
    () => {
      const before = fs.existsSync(path.join(OUTPUT_DIR, 'nonsense-mode.json'));
      const { status } = runCli('nonsense-mode');
      expect(status).not.toBe(0);
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'nonsense-mode.json'))).toBe(before); // never created
    },
    30000,
  );

  it(
    "the CLI's validation database is fully isolated from this test process's own IndexedDB instance",
    async () => {
      const marker = createCollection({ name: 'CLI isolation marker — must survive the child process run' });
      await putCollectionRecord(marker);
      expect(await loadCollections()).toHaveLength(1);

      // The CLI child process resets/reseeds its *own* fake-indexeddb
      // instance (a separate Node process => a separate in-memory store)
      // — if it were somehow sharing this process's store, the marker
      // above would be wiped out by the CLI's own `resetValidationDatabase`.
      const { status } = runCli('integrity');
      expect(status).toBe(0);

      const afterCollections = await loadCollections();
      expect(afterCollections).toHaveLength(1);
      expect(afterCollections[0].id).toBe(marker.id);
    },
    60000,
  );
});
