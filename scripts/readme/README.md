# README media capture

These tools render the existing models and shaders into four looping GIFs in `docs/media/`. Each GIF contains 135 frames at 15 fps: a nine-second, 360-degree rotation. Source frames are captured at 20 fps before encoding.

Start the project with `npm run dev`. Install FFmpeg and Google Chrome, then make the capture tools available without adding them to the app's dependencies:

```sh
npm install --prefix tmp/readme-tools --no-save playwright gifsicle
PLAYWRIGHT_MODULE="$PWD/tmp/readme-tools/node_modules/playwright" \
GIFSICLE="$PWD/tmp/readme-tools/node_modules/.bin/gifsicle" \
node scripts/readme/capture.mjs
```

Use `--stills` to inspect four directions before recording, `--encode-only` to re-encode an existing full capture, or `--only=ruby-dusk-mirror` to capture one showcase. The other names are `night-oath-pieces`, `night-oath-midnight-silver`, and `ruby-pieces`. `CAPTURE_ORIGIN` overrides the default `http://127.0.0.1:5173` server address.

Frames and capture reports go to `tmp/readme-frames/`. The capture page is separate from the production app and does not change its models, materials, or controls. Piece grids show every type in both gem colors at a shared scale. Board scenes use the full starting position and the existing reflection and postprocessing passes; Dusk Mirror's magical field advances and returns smoothly so the orbit loops cleanly.

## Cover banner

The README opens with a 1800 × 440 PNG rendered from the Ruby pieces and Dusk Mirror board, with the project title and no gameplay UI. With the dev server running and Playwright installed as above, regenerate it with:

```sh
PLAYWRIGHT_MODULE="$PWD/tmp/readme-tools/node_modules/playwright" \
node scripts/readme/capture-banner.mjs
```

The image is saved to `docs/media/morph-chess-cover.png`. Adjust the title in `banner.html` and the camera composition in `banner.js`. To preview the scene, open `http://127.0.0.1:5173/scripts/readme/banner.html` through the dev server; opening the HTML file directly does not load its JavaScript modules.

## Shattering showcase

The opening GIF is extracted from the gallery screen recording. It pairs the gold-trimmed sapphire king on the left with the untrimmed ruby knight on the right. Both begin breaking at the same point in the three-second loop. The control panels are cropped away, and each clip is reduced to 360 × 366 pixels; the combined GIF is reduced to 560 × 282 pixels and embedded with standard Markdown.

To regenerate the two individual GIFs, the combined GIF, and the complete recording with its gameplay audio, pass the original MOV to:

```sh
node scripts/readme/prepare-shatter.mjs '/absolute/path/to/recording.mov'
```

This requires only Node.js and FFmpeg. Lossless intermediate clips stay in `tmp/readme-shatter/`; the finished GIFs and the 1440-pixel-wide MP4 go to `docs/media/`.

The MP4 omits recording metadata and silences audio outside the five shatter events. Its picture remains complete, and the glass effects retain their original timing.

## Original / Brilliance and the fragment orbit

`capture-brilliance.mjs` records the real Pieces View, including the existing gemstone shaders, baked fracture motion, floor reflections, bloom and antialiasing. It adds a capture hook only to the browser's intercepted gallery module response; no production source files are changed. The hook freezes real-time playback and samples the same fragment simulation at deterministic times. Only the normal gallery controls are hidden, with a small caption added for the GIF.

With the dev server running and the same Playwright / Gifsicle tools installed above:

```sh
PLAYWRIGHT_MODULE="$PWD/tmp/readme-tools/node_modules/playwright" \
GIFSICLE="$PWD/tmp/readme-tools/node_modules/.bin/gifsicle" \
node scripts/readme/capture-brilliance.mjs
```

- `docs/media/original-vs-brilliance.gif`: eight seconds, with the same ruby king and camera path shown first in Original and then in Brilliance.
- `docs/media/brilliance-shatter-orbit.gif`: twelve seconds, starting with an intact Brilliance ruby king, showing the fracture and settling, then a full orbit around the stationary fragments at varying elevations. The camera follows the collapse down to the floor; the fragments remain visible throughout the orbit.

Both GIFs are 800 × 600 pixels at 15 fps, captured from a 960 × 720 gallery viewport with 1.5× pixel density. PNG source frames and reports stay in `tmp/readme-brilliance/`. They are silent visual demos; the separate full-recording MP4 retains glass audio.

Use `--stills` to inspect the framing and highlights first, `--encode-only` to regenerate GIFs from existing frames, or `--only=brilliance-shatter-orbit` / `--only=original-vs-brilliance` to record one GIF. `CAPTURE_ORIGIN` overrides the dev-server address. FFmpeg creates a 256-color palette; Gifsicle optimizes the result. These captures do not require a source MOV.
