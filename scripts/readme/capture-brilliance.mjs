// Record the real Pieces View with deterministic time and camera movement.
// No production source files or gemstone/fragment geometries are modified.
import { createRequire } from 'node:module';
import { mkdir, writeFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:5173';
const out = path.join(root, 'docs/media'), temporary = path.join(root, 'tmp/readme-brilliance');
const stills = process.argv.includes('--stills'), encodeOnly = process.argv.includes('--encode-only');
if (stills && encodeOnly) throw new Error('Choose --stills or --encode-only.');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const fps = 15;
const shots = [
  { name: 'brilliance-shatter-orbit', duration: 12, mode: 'shatter' },
  { name: 'original-vs-brilliance', duration: 8, mode: 'lighting' },
].filter(shot => !only || shot.name === only);
if (!shots.length) throw new Error('Unknown showcase name.');
const hook = `window.readmeCapture = {
  get ready() { return !loading && active?.ready; },
  render(seconds, mode) {
    stop(); sound.setMuted(true); renderer.setAnimationLoop(null);
    controls.enableDamping = false; controls.autoRotate = false;
    camera.clearViewOffset(); camera.zoom = 1; camera.updateProjectionMatrix();
    let label, subtitle, angle, radius, elevation, targetHeight;
    if (mode === 'lighting') {
      const brilliance = seconds >= 4;
      stage.gemEffects.set(brilliance ? 'prismatic' : 'original');
      time = 0; angle = .55 + (seconds % 4) / 4 * Math.PI * 2;
      radius = 3.6; elevation = 1.65; targetHeight = .83;
      label = brilliance ? 'BRILLIANCE' : 'ORIGINAL';
      subtitle = 'Same ruby king · same camera orbit';
    } else {
      stage.gemEffects.set('prismatic');
      time = seconds < .9 ? 0 : Math.min(DURATION, FRACTURE_TIME + (seconds - .9) * 1.3);
      const follow = Math.max(0, Math.min(1, (seconds - .9) / 1.4));
      const eased = follow * follow * (3 - 2 * follow);
      const orbit = Math.max(0, Math.min(1, (seconds - 3.1) / 8.4));
      angle = .55 + orbit * Math.PI * 2;
      radius = 3.6 + eased * .9;
      elevation = 1.65 - eased * .15 + Math.sin(orbit * Math.PI * 2) * .48;
      targetHeight = .83 - eased * .73;
      label = 'BRILLIANCE / RUBY KING';
      subtitle = seconds < .9 ? 'Click to shatter' : seconds < 3.1 ? 'Gemstone, cut into hundreds of fragments' : 'Orbit the settled fragments · watch the facets catch the light';
    }
    update();
    controls.target.set(0, targetHeight, 0);
    camera.position.set(Math.sin(angle) * radius, elevation, Math.cos(angle) * radius);
    controls.update(); stage.render();
    document.querySelector('#capture-title').textContent = label;
    document.querySelector('#capture-subtitle').textContent = subtitle;
    return { mode, seconds, shards: active.shards.length, broken: time >= FRACTURE_TIME, effect: stage.gemEffects.value };
  }
};`;
await mkdir(out, { recursive: true }); await mkdir(temporary, { recursive: true });
const browser = encodeOnly ? null : await require(process.env.PLAYWRIGHT_MODULE || 'playwright').chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const shot of shots) {
    const directory = path.join(temporary, shot.name); await mkdir(directory, { recursive: true });
    const errors = [], frames = Math.round(shot.duration * fps);
    if (browser) {
      const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1.5 });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
      await page.route(/\/previews\/piece-viewer\.js(?:\?.*)?$/, async route => {
        const response = await route.fetch();
        const source = await response.text();
        if (!source.includes('return { restore };')) throw new Error('Gallery capture hook no longer matches.');
        await route.fulfill({ response, body: source.replace('return { restore };', hook + '\nreturn { restore };') });
      });
      await page.goto(`${origin}/pieces/ruby/?piece=king`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.readmeCapture?.ready);
      await page.addStyleTag({ content: `.gallery-tools,#collection-panel,#collection-toggle,.gallery-hint{display:none!important}#capture-caption{position:fixed;top:27px;left:30px;pointer-events:none;font-family:Arial,sans-serif}#capture-title{font-size:13px;letter-spacing:3px;color:#e7d6b2}#capture-subtitle{font-size:12px;letter-spacing:.2px;color:#b8adb9;margin-top:10px}` });
      await page.evaluate(() => { const caption = document.createElement('div'); caption.id = 'capture-caption'; caption.innerHTML = '<div id="capture-title"></div><div id="capture-subtitle"></div>'; document.body.append(caption); });
      const indices = stills ? [0, Math.round(fps * 2), Math.round(fps * 4), Math.round(fps * 6), Math.min(frames - 1, Math.round(fps * 10))] : Array.from({ length: frames }, (_, index) => index);
      for (const index of indices) {
        const state = await page.evaluate(({ seconds, mode }) => readmeCapture.render(seconds, mode), { seconds: index / fps, mode: shot.mode });
        await page.screenshot({ path: path.join(directory, `${stills ? 'still-' : ''}${String(index).padStart(4, '0')}.png`), scale: 'css' });
        if (index % 30 === 0 || stills) console.log(shot.name, index, JSON.stringify(state));
      }
      await page.close();
      if (errors.length) throw new Error(errors.join('\n'));
    }
    if (!stills) {
      const captured = (await readdir(directory)).filter(name => /^\d{4}\.png$/.test(name));
      if (captured.length !== frames) throw new Error(`Expected ${frames} source frames for ${shot.name}, got ${captured.length}.`);
      const encoded = path.join(directory, 'encoded.gif');
      const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(directory, '%04d.png'), '-filter_complex', 'scale=800:600:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full:max_colors=256[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle', '-loop', '0', encoded], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || 'FFmpeg failed.');
      const file = path.join(out, `${shot.name}.gif`);
      const optimized = spawnSync(process.env.GIFSICLE || 'gifsicle', ['-O3', '--lossy=35', encoded, '-o', file], { encoding: 'utf8' });
      if (optimized.status !== 0) throw new Error(optimized.stderr || 'Gifsicle failed.');
      report.push({ ...shot, frames, fps, bytes: (await stat(file)).size, errors });
    }
  }
} finally { await browser?.close(); }
await writeFile(path.join(temporary, stills ? 'stills-report.json' : 'capture-report.json'), JSON.stringify(report, null, 2));
