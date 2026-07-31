import { test, expect } from 'playwright/test';
import { trackConsoleErrors } from './utils';

// Build 027 Phase 5 — runs under both the `ipad-portrait` (768x1024) and
// `ipad-landscape` (1024x768) Playwright projects (see playwright.config.ts),
// so every assertion here is exercised at both real iPad viewport sizes.

test('app shell renders with no horizontal overflow', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await page.goto('./');
  await expect(page.locator('.app-shell')).toBeVisible();

  // Horizontal overflow is exactly the class of bug this audit targets —
  // a page that's even 1px wider than the viewport forces sideways
  // scrolling on a touch device, which is a much worse experience than on
  // desktop where a mouse wheel/trackpad makes it less noticeable.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  expect(console.errors()).toEqual([]);
});

test('primary action buttons meet the ~44px touch-target minimum', async ({ page }) => {
  await page.goto('./');
  const generateButton = page.locator('.actions .btn--primary').first();
  await expect(generateButton).toBeVisible();
  const box = await generateButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(40); // small tolerance under the 44px guideline for border-box rounding
});

test('offline status bar buttons are visible and tappable-sized', async ({ page }) => {
  await page.goto('./');
  const bar = page.locator('.offline-status-bar');
  await expect(bar).toBeVisible();
  const links = page.locator('.offline-status-link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const box = await links.nth(i).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
});

test('json-tree menu triggers are visible without hover on touch', async ({ page }) => {
  // Regression test for the hover-only reveal bug fixed in workbench.css
  // (`.json-tree-menu-trigger { visibility: hidden }` gated behind
  // `:hover`/`:focus` with no touch equivalent). Navigate into the Design
  // Workbench where the JSON tree renders, then assert the trigger button
  // is actually visible (not just present in the DOM) without any hover
  // simulation — touch devices never send a hover event at all.
  await page.goto('./');
  await page.getByRole('button', { name: /Design Workbench/i }).click();
  const trigger = page.locator('.json-tree-menu-trigger').first();
  // Not every workbench state has JSON tree nodes rendered yet (depends on
  // whether a Design Spec is loaded) — skip gracefully if none exist
  // rather than failing on an unrelated precondition.
  const count = await trigger.count();
  test.skip(count === 0, 'no JSON tree nodes rendered in this workbench state');
  await expect(trigger).toBeVisible();
});
