import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3011
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});