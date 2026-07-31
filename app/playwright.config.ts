import { defineConfig, devices } from 'playwright/test';
import fs from 'node:fs';

// Build 027 Phase 5 — end-to-end coverage for the responsive iPad UI audit.
// This sandbox's `playwright` npm package expects a Chromium revision that
// doesn't match what's pre-installed at /opt/pw-browsers (documented
// elsewhere in this repo's Electron smoke test) — so launchOptions points
// at that fixed install ONLY when it exists here; on a normal dev machine
// or CI runner with matched `npx playwright install` browsers, this stays
// unset and Playwright uses its own managed browser normally.
const sandboxChromium = '/opt/pw-browsers/chromium';
// This sandbox also runs as root, where Chromium's own OS-level sandbox
// refuses to start without --no-sandbox (same constraint documented for
// the Electron smoke test) — again gated to only apply here, never on a
// normal dev machine or CI runner.
const launchOptions = fs.existsSync(sandboxChromium) ? { executablePath: sandboxChromium, args: ['--no-sandbox'] } : {};

const PORT = 4173;
const BASE_PATH = '/vector-stock-pattern-studio/studio/';
const baseURL = `http://127.0.0.1:${PORT}${BASE_PATH}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  timeout: 30000,
  // Serves the real, already-built `/studio` (the same artifact GitHub
  // Pages deploys) via `vite preview`, not the dev server — this is the
  // build with the service worker actually registered, which the offline
  // spec needs. Run `npm run build` first if `/studio` is stale.
  webServer: {
    command: `npx vite preview --config vite.config.ts --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: {
    baseURL,
    launchOptions,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad Pro 11'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad Pro 11'], viewport: { width: 1024, height: 768 } },
    },
  ],
});
