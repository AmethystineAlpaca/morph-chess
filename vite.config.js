import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig(({ command, isPreview }) => ({
  // Development stays at /; production matches the GitHub project site.
  base: command === 'build' || isPreview ? '/morph-chess/' : '/',
  plugins: [{
    name: 'publish-credits',
    generateBundle() {
      // Publish only explicit license/credit files, never the project directory.
      for (const [fileName, source] of [
        ['LICENSE', './LICENSE'],
        ['pieces/ruby/audio/README.md', './pieces/ruby/audio/README.md'],
        ['play/audio/CREDITS.txt', './play/audio/CREDITS.txt'],
        ['licenses/three.txt', './node_modules/three/LICENSE'],
        ['licenses/vite.txt', './node_modules/vite/LICENSE.md'],
      ]) this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(source, import.meta.url)) });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        combined: fileURLToPath(new URL('./index.html', import.meta.url)),
        jellyOcean: fileURLToPath(new URL('./boards/jelly-ocean/index.html', import.meta.url)),
        midnightSilver: fileURLToPath(new URL('./boards/midnight-silver/index.html', import.meta.url)),
        duskMirror: fileURLToPath(new URL('./boards/dusk-mirror/index.html', import.meta.url)),
        ruby: fileURLToPath(new URL('./pieces/ruby/index.html', import.meta.url)),
        rubyShatter: fileURLToPath(new URL('./pieces/ruby/shatter.html', import.meta.url)),
        nightOath: fileURLToPath(new URL('./pieces/night-oath/index.html', import.meta.url)),
        nightOathCollection: fileURLToPath(new URL('./pieces/night-oath/collection.html', import.meta.url)),
      },
    },
  },
}));
