import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'web/index.html'),
        equipe: path.resolve(import.meta.dirname, 'web/equipe/index.html'),
        privacidade: path.resolve(import.meta.dirname, 'web/privacidade/index.html'),
        sair: path.resolve(import.meta.dirname, 'web/sair/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [import.meta.dirname] },
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
});
