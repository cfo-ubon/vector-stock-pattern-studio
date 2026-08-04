import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
//
// This repo's GitHub Pages is configured to deploy the `main` branch as-is
// (no build step on GitHub's side), so the production build is checked
// into `../studio/` at the repo root and served as a project-page subpath
// alongside the original static site at the repo root. base/outDir must
// match that published path exactly or asset URLs will 404.
//
// Mission 7.5B (Offline Boot Certification): root cause of "cold offline
// launch fails" was that this branch shipped zero service worker / PWA
// registration at all (confirmed by grep — no `vite-plugin-pwa` dependency,
// no manifest, no `navigator.serviceWorker.register` call anywhere). The
// app's actual data layer (IndexedDB, used throughout `src/catalog`,
// `src/factory`, `src/backup`, etc.) already works fully offline once
// running — the only gap was the static app shell (this build's own
// HTML/CSS/JS) never being cached for a network-less reload. `generateSW`
// is the smallest fix: it precaches every build output file (Workbox's
// default `globPatterns` already covers js/css/html — this app ships no
// external fonts or icons, confirmed by grep, so nothing else needs
// listing) and registers itself automatically, with no new UI, no new
// business logic, and no change to how the app already behaves online.
//
// `test` (vitest) runs every test file under jsdom so component tests
// (React Testing Library) and plain logic tests share one config — jsdom's
// overhead is negligible for the pure-logic suites.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Cache-first navigation fallback so a cold, offline load of any
        // deep path under this app's base still resolves to the cached
        // shell instead of a network-dependent 404.
        navigateFallback: '/vector-stock-pattern-studio/studio/index.html',
      },
      manifest: {
        name: 'Vector Stock Pattern Studio',
        short_name: 'VSP Studio',
        start_url: '/vector-stock-pattern-studio/studio/',
        scope: '/vector-stock-pattern-studio/studio/',
        display: 'standalone',
        background_color: '#0f1117',
        theme_color: '#5b8dee',
      },
    }),
  ],
  base: '/vector-stock-pattern-studio/studio/',
  build: {
    outDir: '../studio',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
    // `dist-electron`/`dist-desktop` are gitignored build output from the
    // Electron desktop shell (`tsconfig.electron.json`/`vite.config.desktop.ts`)
    // — vitest's default include glob is broad enough to also pick up
    // compiled `.test.js` duplicates that land there, which fail outright
    // (CommonJS output can't `require('vitest')`) and needlessly compete
    // for CPU with the real suite. Excluded explicitly rather than relying
    // on `tsconfig.electron.json` alone to keep test files out of that
    // build, since either one drifting would silently reintroduce this.
    exclude: [...configDefaults.exclude, 'dist-electron/**', 'dist-desktop/**'],
    // Project Phoenix V2's Cluster Composition Engine places more motifs
    // per tile than the old independent-scatter layouts did (by design —
    // richer clusters instead of isolated points, see
    // engine/clusterEngine.ts), and the Quality Inspector computes 5 more
    // real metrics per candidate — both genuinely increase per-tile
    // generation cost. A handful of tests that build several full
    // collections or multi-round candidate pools in one `it()` were
    // already close to vitest's 5000ms default before this milestone (see
    // their own per-test 15000ms overrides); this raises the *default* so
    // future tests in the same category don't need one added by hand too.
    testTimeout: 15000,
  },
})
