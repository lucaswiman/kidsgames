import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * Builds the service worker (src/sw.js) with the list of every file in the
 * build, so the whole game is saved for offline play on first visit.
 */
function serviceWorker() {
  return {
    name: 'slimy-stretch-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', './index.html', ...Object.keys(bundle).map(f => `./${f}`)];
      const publicFiles = [
        'manifest.webmanifest',
        'icon-180.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'favicon-32.png',
      ];
      files.push(...publicFiles.map(f => `./${f}`));
      const unique = [...new Set(files)];
      const template = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8');
      // The cache name changes whenever any file does, so iPads pick up updates.
      const hash = createHash('sha256').update(unique.join('\n')).update(template);
      for (const f of publicFiles) {
        hash.update(readFileSync(new URL(`./public/${f}`, import.meta.url)));
      }
      const version = hash.digest('hex').slice(0, 12);
      const source = template.replace(
        'self.__PRECACHE__',
        JSON.stringify({ version, files: unique })
      );
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
  },
});
