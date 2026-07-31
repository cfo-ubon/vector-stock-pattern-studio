import { test, expect } from 'playwright/test';
import { trackConsoleErrors } from './utils';

// Build 027 Phase 5 — real Backup Manager + `.vspsb` export coverage,
// exercised at iPad viewport sizes. This is the PC<->iPad transfer format
// (see docs/DATA_TRANSFER_PC_IPAD.md); on the plain web/PWA target export
// goes through an anchor-download click (see `svgExporter.ts`'s
// `downloadBlobFileViaBrowser`, the fallback path `isDesktop()` skips),
// which Playwright can observe as a real browser download event.

test('creating a backup produces a real downloadable .vspsb file', async ({ page }) => {
  const console = trackConsoleErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: /Backup Manager/ }).click();
  await expect(page.getByText(/สร้างไฟล์สำรองข้อมูลทั้งหมด/)).toBeVisible();

  await page.getByRole('button', { name: /สร้างไฟล์สำรองใหม่/ }).click();
  await expect(page.getByText(/สร้างไฟล์สำรองสำเร็จ/)).toBeVisible({ timeout: 20000 });

  const downloadButton = page.getByRole('button', { name: /ดาวน์โหลดไฟล์/ });
  await expect(downloadButton).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  expect(download.suggestedFilename()).toMatch(/\.vspsb$/);

  expect(console.errors()).toEqual([]);
});

test('Restore tab accepts a .vspsb file via the file input (Safari-compatible, no File System Access API)', async ({ page }) => {
  // The responsive audit confirmed no `showOpenFilePicker`/
  // `showSaveFilePicker` calls exist anywhere in the app (that API is
  // unsupported on iPadOS Safari) — every file selection goes through a
  // plain `<input type="file">`, which this test exercises directly by
  // first exporting a real backup, then feeding that exact file back into
  // the Restore tab's file input.
  await page.goto('./');
  await page.getByRole('button', { name: /Backup Manager/ }).click();
  await page.getByRole('button', { name: /สร้างไฟล์สำรองใหม่/ }).click();
  await expect(page.getByText(/สร้างไฟล์สำรองสำเร็จ/)).toBeVisible({ timeout: 20000 });
  const downloadButton = page.getByRole('button', { name: /ดาวน์โหลดไฟล์/ });
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();

  await page.locator('.backup-tab-nav button').filter({ hasText: /กู้คืน/ }).click();
  const fileInput = page.locator('.backup-panel input[type="file"]');
  await fileInput.setInputFiles(filePath!);

  // Restoring shows a validation-verdict preview before committing —
  // confirms the file was read and parsed successfully via the plain
  // <input>, not silently ignored.
  await expect(page.locator('.backup-panel')).toContainText(/ผลตรวจสอบ: (PASS|WARNING|FAIL)/, { timeout: 10000 });
});
