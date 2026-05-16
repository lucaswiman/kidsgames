import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tower-defense/',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
