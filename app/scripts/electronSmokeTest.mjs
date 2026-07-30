// Build 027 Phase 4 — Linux-side Electron smoke test. Launches the real
// packaged main/preload/renderer via Playwright's Electron driver (not just
// a "did the process exit" check), verifies the window actually rendered
// the app shell, exercises the exposed `window.vsp` bridge, and confirms
// no console errors were logged. Run after `npm run desktop:build`.
import { _electron as electron } from 'playwright';
import path from 'node:path';

const appPath = process.cwd();

async function main() {
  const consoleErrors = [];
  const app = await electron.launch({
    args: [appPath, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const win = await app.firstWindow();
  win.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  win.on('pageerror', (err) => consoleErrors.push(String(err)));

  await win.waitForSelector('.app-shell', { timeout: 15000 });
  const title = await win.title();
  const hasOfflineBar = await win.$('.offline-status-bar');
  const hasBridge = await win.evaluate(() => {
    const bridge = window.vsp;
    return {
      exists: !!bridge,
      hasSaveBinaryFile: typeof bridge?.saveBinaryFile === 'function',
      hasOpenBinaryFile: typeof bridge?.openBinaryFile === 'function',
      hasGetVersion: typeof bridge?.getVersion === 'function',
    };
  });
  const version = hasBridge.hasGetVersion ? await win.evaluate(() => window.vsp.getVersion()) : null;

  console.log('window title:', title);
  console.log('app-shell rendered:', true);
  console.log('offline-status-bar rendered:', !!hasOfflineBar);
  console.log('window.vsp bridge:', JSON.stringify(hasBridge));
  console.log('app version via bridge:', version);
  console.log('console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log(consoleErrors.join('\n'));
  }

  await app.close();

  if (consoleErrors.length > 0) {
    console.error('SMOKE TEST FAILED: console errors present');
    process.exit(1);
  }
  if (!hasBridge.exists || !hasBridge.hasSaveBinaryFile || !hasBridge.hasOpenBinaryFile) {
    console.error('SMOKE TEST FAILED: window.vsp bridge missing expected methods');
    process.exit(1);
  }
  console.log('SMOKE TEST PASSED');
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
