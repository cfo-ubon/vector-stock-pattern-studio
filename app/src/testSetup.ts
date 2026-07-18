import '@testing-library/jest-dom/vitest';
// jsdom has no IndexedDB implementation — Portfolio Manager P1's storage
// layer (`storage/db.ts`'s new `portfolioAssets`/`portfolioFiles` stores)
// is IndexedDB-only (see `catalog/storage/portfolioStore.ts`'s header
// comment for why it deliberately has no localStorage fallback), so its
// tests need a real IndexedDB implementation to run against. This
// dev-only polyfill registers `indexedDB`/`IDBKeyRange` etc. as globals;
// no other existing test touches `storage/db.ts` or any `storage/*Store`
// module, so this has no effect on any pre-existing test.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Note (Portfolio Manager P1 storage tests): jsdom's own `Blob`/`File`
// implementation is not recognized by Node's built-in `structuredClone`
// (which `fake-indexeddb` uses internally to simulate IndexedDB's real
// structured-clone semantics) — a Blob built with jsdom's constructor
// round-trips through a fake-indexeddb `put`/`get` as an empty,
// prototype-less object. Real browsers don't have this problem. Rather
// than replacing the *global* `Blob`/`File` here (tried once — it broke
// every pre-existing jsdom-`FileReader`-based test elsewhere, e.g.
// `ImportExportBar.test.tsx`'s `fireEvent.change(input, { target: { files } })`
// flow, which depends on jsdom's own File class), the catalog test files
// that need a real Blob roundtrip through fake-indexeddb import Node's
// `Blob`/`File` from `node:buffer` locally instead (see
// `catalog/storage/portfolioStore.test.ts` etc.) — scoped to exactly the
// tests that need it, leaving every other test's jsdom globals untouched.

// Vitest is not run with `test.globals: true` (every test file explicitly
// imports describe/it/expect from 'vitest', matching this repo's existing
// convention), so @testing-library/react's usual auto-cleanup-via-global-
// afterEach doesn't register itself — do it explicitly here instead, once,
// for every component test file.
afterEach(() => {
  cleanup();
});
