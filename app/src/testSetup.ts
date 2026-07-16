import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest is not run with `test.globals: true` (every test file explicitly
// imports describe/it/expect from 'vitest', matching this repo's existing
// convention), so @testing-library/react's usual auto-cleanup-via-global-
// afterEach doesn't register itself — do it explicitly here instead, once,
// for every component test file.
afterEach(() => {
  cleanup();
});
