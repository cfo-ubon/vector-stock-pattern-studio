import type { Page } from 'playwright/test';

/** Attach a console listener before any navigation and return a getter for
 * accumulated `console.error` messages — call `.errors()` at the end of a
 * test to assert none occurred. Filters out the one pre-existing,
 * unrelated `INEFFECTIVE_DYNAMIC_IMPORT` Vite build warning (logged via
 * `console.warn`, not `error`, so it wouldn't match anyway, but excluded
 * defensively in case a future Vite version reclassifies it). */
export function trackConsoleErrors(page: Page): { errors: () => string[] } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(String(err));
  });
  return { errors: () => errors };
}
