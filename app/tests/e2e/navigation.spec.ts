import { test, expect } from 'playwright/test';
import { trackConsoleErrors } from './utils';

// Build 027 Phase 5 — navigation + dialog coverage. Runs under both
// ipad-portrait and ipad-landscape projects. Every view switch here is
// driven by a plain onClick handler (confirmed during the responsive
// audit — no hover-only nav dropdowns exist in this app), so this also
// doubles as a touch-navigation smoke test.

test('can navigate to every full-page view and back with no console errors', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await page.goto('./');
  await expect(page.locator('.app-shell')).toBeVisible();

  const views: Array<{ open: RegExp; heading: RegExp }> = [
    { open: /Portfolio Manager/, heading: /Portfolio/ },
    { open: /Backup Manager/, heading: /Backup Manager|สร้างไฟล์สำรอง/ },
  ];

  for (const view of views) {
    await page.getByRole('button', { name: view.open }).click();
    await expect(page.getByText(view.heading).first()).toBeVisible();
    await page.getByRole('button', { name: /กลับ|Close|Back/ }).first().click();
    await expect(page.locator('.app-shell .app-header')).toBeVisible();
  }

  expect(console.errors()).toEqual([]);
});

test('Backup Manager tab navigation switches panels without reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Backup Manager/ }).click();
  await expect(page.getByText(/สร้างไฟล์สำรองข้อมูลทั้งหมด/)).toBeVisible();

  const tabs = page.locator('.backup-tab-nav button');
  const tabCount = await tabs.count();
  expect(tabCount).toBeGreaterThan(1);
  for (let i = 0; i < tabCount; i += 1) {
    await tabs.nth(i).click();
    await expect(page.locator('.backup-panel')).toBeVisible();
  }
});
