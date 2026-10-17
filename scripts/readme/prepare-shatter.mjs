// Extract the README's synchronized shatter clips from the original recording.
// node scripts/readme/prepare-shatter.mjs /absolute/path/to/recording.mov
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Pass the original gallery MOV recording.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/media');
const temporary = path.join(root, 'tmp/readme-shatter');
mkdirSync(output, { recursive: true });
mkdirSync(temporary, { recursive: true });

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg exited with ${result.status}`);
}

const clips = [
  { name: 'shatter-sapphire-king', start: 40.65 },
  { name: 'shatter-ruby-knight', start: 3.5 },
];
const palette = 'split[frames][colors];[colors]palettegen=stats_mode=full[palette];'
  + '[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle';

for (const clip of clips) {
  clip.file = path.join(temporary, `${clip.name}.mkv`);
  ffmpeg(['-ss', String(clip.start), '-i', source, '-t', '3', '-an',
    '-vf', 'setpts=PTS-STARTPTS,fps=20,crop=1200:1220:0:0,scale=360:366:flags=lanczos,setsar=1',
    '-c:v', 'ffv1', clip.file]);
  ffmpeg(['-i', clip.file, '-filter_complex', `[0:v]${palette}`, '-loop', '0',
    path.join(output, `${clip.name}.gif`)]);
}

// Compose the lossless clips before quantizing, preserving one shared palette.
ffmpeg(['-i', clips[0].file, '-i', clips[1].file, '-filter_complex',
  '[0:v]pad=368:366:0:0:color=0x111217[left];'
    + `[left][1:v]hstack=inputs=2,scale=560:282:flags=lanczos,${palette}`,
  '-loop', '0', path.join(output, 'piece-shattering.gif')]);

// Keep the full picture and gameplay sounds. Silence audio outside the five
// shatter events so incidental recording sounds are not published.
const soundWindows = [[4.2, 6.4], [13.1, 15.4], [19.2, 21.6], [29.8, 32.2], [41.2, 43.7]];
const soundGate = `volume='if(${soundWindows.map(([start, end]) => `between(t,${start},${end})`).join('+')},1,0)':eval=frame`;
ffmpeg(['-i', source, '-map', '0:v:0', '-map', '0:a:0',
  '-vf', 'fps=30,scale=1440:-2:flags=lanczos',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-af', soundGate, '-c:a', 'aac', '-b:a', '128k',
  '-map_metadata', '-1', '-movflags', '+faststart',
  path.join(output, 'piece-shattering-demo.mp4')]);

console.log('Created the two shatter GIFs, the combined GIF, and the full MP4.');
