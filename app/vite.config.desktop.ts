import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate, additive build config for the Electron desktop build — does
// NOT replace `vite.config.ts` (that config's `base: '/vector-stock-
// pattern-studio/studio/'` / `outDir: '../studio'` must keep serving the
// existing GitHub Pages web deployment unchanged) and deliberately has no
// PWA plugin — a desktop build ships every file inside the installer
// itself, so there is no "first online visit to populate a cache" step
// the way the web PWA has; a service worker would be pure overhead here.
//
// This config:
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
  resolve: {
    alias: {
      // `OfflineStatusBar.tsx` imports vite-plugin-pwa's virtual module,
      // which only exists when the `VitePWA` plugin is registered (it
      // isn't here — see the file header). Alias it to a desktop-specific
      // stub so the shared component tree builds without a PWA plugin.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/desktop/registerSwStub.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: 'dist-desktop',
    emptyOutDir: true,
  },
});
