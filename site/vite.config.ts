/**
 * The public landing page, built on its own.
 *
 * ── Why this is a second build rather than a route ──────────────────────────
 *
 * Because "the app without the buttons" is not a thing you can ship. The app's
 * bundle carries the wizard, the workspace, the file editor, the daemon client
 * and a websocket that would spend its life failing to connect to a machine
 * that is not there. Serving that to a visitor and hiding the controls would
 * leave every one of those screens one URL away, and the socket would still
 * dial.
 *
 * So this entry pulls in exactly one component and its own host, from the same
 * source files the app uses. No copy of the landing page exists — a second copy
 * would be right on the day it was made and wrong within a week.
 *
 * ── Why it has no dependencies of its own ───────────────────────────────────
 *
 * Everything it imports is already a dependency of `@superbuilds/ui` and hoists
 * to the workspace root. A `site/node_modules` with its own React in it is the
 * shortest path to two Reacts in one page, which fails in ways that look like
 * a bug in your code.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ui = resolve(here, '..', 'ui', 'src');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // The same two aliases the app uses, pointed at the same folders, so a file
    // that moves in `ui/src` moves for both builds at once.
    alias: {
      '@': ui,
      '@scenes': resolve(here, '..', 'design-library', 'scenes'),
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.SITE_PORT ?? 5190),
    // Vite refuses to serve files outside the project root without this, and
    // the whole point of the build is that the source lives one folder up.
    fs: { allow: [resolve(here, '..')] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // The scene behind the page is by far the heaviest thing here and it is
        // lazy-loaded, so keeping it in its own file is what lets the words
        // arrive before the geometry does.
        manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], react: ['react', 'react-dom'] },
      },
    },
  },
});
