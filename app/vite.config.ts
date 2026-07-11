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
  },
})
