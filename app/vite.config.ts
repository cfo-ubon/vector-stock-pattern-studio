import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
export default defineConfig({
  plugins: [react()],
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
