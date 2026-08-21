import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

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
    proxy: {
      '/api': { target: 'http://127.0.0.1:7747', changeOrigin: false },
      '/hooks': { target: 'http://127.0.0.1:7747' },
      '/captures': { target: 'http://127.0.0.1:7747' },
      '/thumbs': { target: 'http://127.0.0.1:7747' },
      '/ws': { target: 'ws://127.0.0.1:7747', ws: true },
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
