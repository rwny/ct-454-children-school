import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures assets are loaded with relative paths for Electron
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
