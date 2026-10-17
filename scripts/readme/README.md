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
