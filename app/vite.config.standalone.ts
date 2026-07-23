import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Standalone single-file offline build — for users without an Electron
// installer. Inlines all JS/CSS into one index.html (no separate module
// files), so the app runs by double-clicking the HTML file directly via
// `file://`, in any browser, with zero server and zero installation.
// Gitignored output (`dist-standalone`), never touches the committed
// `/studio` web build or the Electron `dist-desktop` build.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
