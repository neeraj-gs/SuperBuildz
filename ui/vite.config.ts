import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/*
  Both ports come from the environment, and `scripts/dev.mjs` is what puts them
  there — it probes for a free interface port and hands the same number to Vite
  and to the daemon. Started on its own (`npm run dev:ui`) this falls back to
  the customary pair, and Vite is left free to walk forward if 5180 is busy,
  because the daemon no longer cares which port the interface is on.
*/
const DAEMON = Number(process.env.SUPERBUILDS_PORT ?? 7747);
const UI = Number(process.env.SUPERBUILDS_UI_PORT ?? 5180);
const daemonHttp = `http://127.0.0.1:${DAEMON}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
      // The scenes are shared with every generated site; the wizard previews the real thing.
      '@scenes': resolve(here, '..', 'design-library', 'scenes'),
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  server: {
    host: '127.0.0.1',
    port: UI,
    // Only pinned when the parent chose the port and told the daemon about it.
    // On its own, moving is better than refusing to start.
    strictPort: !!process.env.SUPERBUILDS_UI_PORT,
    proxy: {
      '/api': { target: daemonHttp, changeOrigin: false },
      '/hooks': { target: daemonHttp },
      '/captures': { target: daemonHttp },
      '/thumbs': { target: daemonHttp },
      '/ws': { target: `ws://127.0.0.1:${DAEMON}`, ws: true },
    },
    fs: { allow: [resolve(here, '..')] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
