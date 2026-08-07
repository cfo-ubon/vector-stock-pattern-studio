import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate, additive build config for the Electron desktop renderer —
// does NOT replace `vite.config.ts` (that config's
// `base: '/vector-stock-pattern-studio/studio/'` / `outDir: '../studio'`
// must keep serving the existing GitHub Pages web deployment unchanged,
// per CLAUDE.md). This config instead:
//   - uses `base: './'` (relative paths) since Electron loads the built
//     `index.html` via `file://`, not from a web server subpath.
//   - outputs to `dist-desktop` (gitignored, rebuilt by
//     `npm run desktop:build`), never touching the committed `/studio`
//     web build.
// No `vite-plugin-pwa` here deliberately — a Service Worker is meaningless
// (and can conflict with `file://` loading) inside an already-fully-local
// Electron shell; that plugin exists only to solve the web build's
// "no server, no cache" problem (Mission 7.5B), which does not apply here.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-desktop',
    emptyOutDir: true,
  },
});
