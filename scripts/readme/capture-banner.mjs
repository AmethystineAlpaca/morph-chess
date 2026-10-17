import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:5173';
const output = path.join(root, 'docs/media/morph-chess-cover.png');
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 440 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}/scripts/readme/banner.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.coverReady === true);
  await page.evaluate(() => window.renderCover());
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: output });
  console.log(`Saved ${output} (1800 × 440)`);
} finally { await browser.close(); }
