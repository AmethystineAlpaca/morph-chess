// Requires a Vite dev server, Playwright, Chrome, FFmpeg and Gifsicle.
// node scripts/readme/capture.mjs [--stills | --encode-only] [--only=night-oath-pieces]
// PLAYWRIGHT_MODULE can point to an existing Playwright package outside this repo.
import { createRequire } from 'node:module';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:5173';
const output = path.join(root, 'docs/media');
const framesRoot = path.join(root, 'tmp/readme-frames');
const stills = process.argv.includes('--stills');
const encodeOnly = process.argv.includes('--encode-only');
if (stills && encodeOnly) throw new Error('Choose either --stills or --encode-only');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const captureFps = 20, frameCount = 180, outputFps = 15;
const shots = [
  { name: 'night-oath-pieces', query: 'pieces=night-oath', width: 1080, height: 660 },
  { name: 'night-oath-midnight-silver', query: 'view=board&pieces=night-oath&board=midnight-silver', width: 1024, height: 768 },
  { name: 'ruby-pieces', query: 'pieces=ruby', width: 1080, height: 660 },
  { name: 'ruby-dusk-mirror', query: 'view=board&pieces=ruby&board=dusk-mirror', width: 1024, height: 768 },
].filter(shot => !only || shot.name === only);
if (!shots.length) throw new Error(`Unknown showcase: ${only}`);

await mkdir(output, { recursive: true });
const browser = encodeOnly ? null : await require(process.env.PLAYWRIGHT_MODULE || 'playwright')
  .chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const shot of shots) {
    const page = await browser?.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1 });
    const errors = [];
    const directory = path.join(framesRoot, shot.name, ...(stills ? ['stills'] : []));
    await mkdir(directory, { recursive: true });
    if (page) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${origin}/scripts/readme/?${shot.query}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.showcaseReady === true);
      await page.evaluate(() => document.fonts.ready);
      for (let warmup = 0; warmup < 3; warmup++) await page.evaluate(() => window.renderShowcase(0));
      const count = stills ? 4 : frameCount;
      for (let index = 0; index < count; index++) {
        const progress = index / count;
        await page.evaluate(progress => window.renderShowcase(progress), progress);
        await page.screenshot({ path: path.join(directory, `${String(index).padStart(4, '0')}.png`) });
        if (index % 30 === 0) console.log(`${shot.name}: ${index}/${count}`);
      }
      if (errors.length) throw new Error(`${shot.name}: ${errors.join('\n')}`);
    }
    if (!stills) {
      const frames = (await readdir(directory)).filter(file => /^\d{4}\.png$/.test(file));
      if (frames.length !== frameCount) throw new Error(`Expected ${frameCount} captured frames for ${shot.name}`);
      const board = shot.query.includes('view=board');
      const filter = `[0:v]fps=${outputFps},scale=${board ? 800 : 960}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full:max_colors=${board ? 192 : 256}[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`;
      const encodedFile = path.join(directory, 'encoded.gif');
      const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
        '-framerate', String(captureFps), '-i', path.join(directory, '%04d.png'),
        '-t', String(frameCount / captureFps), '-filter_complex', filter, '-loop', '0', encodedFile], { encoding: 'utf8' });
      if (encoded.status !== 0) throw new Error(encoded.stderr || 'FFmpeg failed');
      const optimized = spawnSync(process.env.GIFSICLE || 'gifsicle', ['-O3',
        ...(board ? ['--lossy=80'] : []), encodedFile, '-o', path.join(output, `${shot.name}.gif`)], { encoding: 'utf8' });
      if (optimized.status !== 0) throw new Error(optimized.stderr || 'Gifsicle is required (set GIFSICLE to its path)');
    }
    report.push({ ...shot, captureFrames: stills ? 4 : frameCount, captureFps, outputFps, errors });
    await page?.close();
    console.log(`${shot.name}: complete`);
  }
} finally {
  await browser?.close();
}
await writeFile(path.join(framesRoot, stills ? 'stills-report.json' : 'capture-report.json'), JSON.stringify(report, null, 2));
