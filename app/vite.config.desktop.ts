import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate, additive build config for the Electron desktop build — does
// NOT replace `vite.config.ts` (that config's `base: '/vector-stock-
// pattern-studio/studio/'` / `outDir: '../studio'` must keep serving the
// existing GitHub Pages web deployment unchanged, per
// DESKTOP_MIGRATION_AUDIT.md Section 2). This config instead:
//   - uses `base: './'` (relative paths) since Electron loads the built
//     `index.html` via `file://`, not from a web server subpath — an
//     absolute `/vector-stock-pattern-studio/studio/...` base would 404
//     every asset when opened from disk.
//   - outputs to `dist-desktop` (gitignored, rebuilt by
//     `npm run desktop:build`), never touching the committed `/studio`
//     web build.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-desktop',
    emptyOutDir: true,
  },
});
