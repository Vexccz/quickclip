import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        quickpaste: path.resolve(__dirname, 'src/renderer/quickpaste.html'),
        settings: path.resolve(__dirname, 'src/renderer/settings.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
