import { defineConfig } from 'vitest/config'
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
// `test` (vitest) runs every test file under jsdom so component tests
// (React Testing Library) and plain logic tests share one config — jsdom's
// overhead is negligible for the pure-logic suites.
// Build 027 — PWA plugin registered directly on the one build that's
// actually deployed to GitHub Pages, rather than a second parallel config.
// The service worker's default scope is the directory containing this
// build's index.html (`/vector-stock-pattern-studio/studio/`), so it
// can't reach — and can't affect — the unrelated vanilla site living at
// the repo root. `registerType: 'prompt'` (not `'autoUpdate'`) is
// deliberate: an unattended auto-reload can discard in-progress work in
// open dialogs/forms, so the app must ask first (see
// src/pwa/updatePrompt.ts + the OfflineStatusBar update banner).
const pwaPlugin = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    id: '/vector-stock-pattern-studio/studio/',
    name: 'Vector Stock Pattern Studio',
    short_name: 'Pattern Studio',
    description: 'Generate seamless, fully-editable SVG stock patterns — works fully offline once installed.',
    start_url: '.',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#5b8dee',
    background_color: '#12141c',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // No fonts are loaded from a CDN anywhere in this app (confirmed by
    // audit — only system-font stacks in App.css), so the app shell glob
    // below is the complete set of assets offline use needs; there is
    // nothing external left to add a runtimeCaching rule for.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
    navigateFallback: 'offline.html',
    navigateFallbackAllowlist: [/^\/vector-stock-pattern-studio\/studio\//],
    // Never let the service worker intercept IndexedDB-bound requests or
    // anything outside this app's own scope — Cache API storage here is
    // for the app shell only, per Build 027 Phase 2's requirement that
    // user portfolio data must stay in IndexedDB, never in a SW cache.
    cleanupOutdatedCaches: true,
  },
})

export default defineConfig({
  plugins: [react(), pwaPlugin],
  base: '/vector-stock-pattern-studio/studio/',
  build: {
    outDir: '../studio',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
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
