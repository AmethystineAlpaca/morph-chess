import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
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
});
