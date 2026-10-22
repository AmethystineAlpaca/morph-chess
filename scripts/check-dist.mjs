import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const directory = resolve('dist');
const base = '/morph-chess/';
const entries = [
  'index.html', 'boards/jelly-ocean/index.html',
  'boards/midnight-silver/index.html', 'boards/dusk-mirror/index.html',
  'pieces/ruby/index.html', 'pieces/ruby/shatter.html',
  'pieces/night-oath/index.html', 'pieces/night-oath/collection.html',
  'LICENSE', 'pieces/ruby/audio/README.md', 'play/audio/CREDITS.txt',
  'licenses/three.txt', 'licenses/vite.txt',
];
for (const entry of entries) assert.ok(statSync(join(directory, entry)).isFile(), `Missing ${entry}`);
let count = 0;
function check(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${path}`);
    if (entry.isDirectory()) { check(path); continue; }
    assert.ok(!/(^\.|\.(?:pem|key|p12|pfx|env|map|sqlite|db)$)/i.test(entry.name), `Private/local file: ${path}`);
    count++;
    if (!/\.(?:html|js|css)$/.test(entry.name)) continue;
    const content = readFileSync(path, 'utf8');
    assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?=[:/])/i.test(content), `Local server dependency: ${path}`);
    for (const match of content.matchAll(/(?:href|src)=["'](\/[^"']*)/g)) {
      assert.ok(match[1].startsWith(base), `Outside base: ${match[1]} in ${path}`);
    }
    for (const match of content.matchAll(/\/morph-chess\/(assets\/[^"'`\s)<>?#]+)/g)) {
      assert.ok(statSync(join(directory, match[1])).isFile(), `Missing asset: ${match[1]}`);
    }
  }
}
check(directory);
assert.equal(readdirSync(join(directory, 'assets')).filter(name => name.endsWith('.wav')).length, 3);
console.log(`Verified ${count} production files, 8 HTML entries, 3 sounds, asset paths and credits under ${base}`);
