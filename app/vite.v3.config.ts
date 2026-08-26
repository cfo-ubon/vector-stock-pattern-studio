import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// AI-SBOS v3 — independent build config for the "Keyword-to-Vector
// Seamless Factory" product generation. Lives in the SAME `app/` source
// tree as v2 (so v3's own code can import v2's real engine/commercial/
// decisionOS/factory modules directly — see AI_SBOS_V3_ARCHITECTURE_AUDIT.md,
// "no duplicate business logic") but builds to its OWN output directory
// and OWN base path, exactly like v1's dedicated build config, so v3 is a
// genuinely independent, separately-deployed product generation.
//
// A separate `root` (`v3-entry/`) rather than a `rollupOptions.input`
// override keeps this file simple and matches the standard Vite
// multi-app-in-one-repo pattern: `v3-entry/index.html` is v3's own entry
// HTML, referencing `../src/v3/main.tsx` (v3's own React root, NOT v2's
// `App.tsx`).
const rootDir = fileURLToPath(new URL('.', import.meta.url));

function readCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  root: `${rootDir}v3-entry`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        navigateFallback: '/vector-stock-pattern-studio/studio/v3/index.html',
      },
      manifest: {
        name: 'AI-SBOS v3',
        short_name: 'AI-SBOS v3',
        description: 'AI-SBOS v3 — Keyword-to-Vector Seamless Factory',
        start_url: '/vector-stock-pattern-studio/studio/v3/',
        scope: '/vector-stock-pattern-studio/studio/v3/',
        display: 'standalone',
        background_color: '#14161c',
        theme_color: '#7c5bee',
      },
    }),
  ],
  base: '/vector-stock-pattern-studio/studio/v3/',
  define: {
    __COMMIT_HASH__: JSON.stringify(readCommitHash()),
  },
  build: {
    outDir: `${rootDir}../studio/v3`,
    emptyOutDir: true,
  },
});
