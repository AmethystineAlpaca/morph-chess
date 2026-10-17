// Opt-in repeatable camera-motion benchmark. No polling or overlay in normal use.
export function benchmark({ renderer, controls }) {
  if (!new URLSearchParams(location.search).has('benchmark')) return;
  const label = document.createElement('output');
  label.id = 'benchmark';
  label.style.cssText = 'position:fixed;left:20px;top:155px;z-index:10;background:#000c;color:white;padding:12px;font:12px monospace;white-space:pre';
  document.body.append(label);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1;
  let start = performance.now(), previous = start, samples = [], windows = 0;
  function frame(now) {
    const duration = now - previous;
    previous = now;
    if (now - start > 2500) samples.push(duration);
    if (now - start > 7500) {
      samples.sort((a,b) => a-b);
      const average = samples.reduce((a,b) => a+b,0) / samples.length;
      label.textContent = JSON.stringify({ fps: +(1000/average).toFixed(1), frameMs: +average.toFixed(1), p95Ms: +samples[Math.floor(samples.length*.95)].toFixed(1), viewport: [innerWidth,innerHeight], drawingBuffer: [renderer.domElement.width,renderer.domElement.height], drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length, run: ++windows }, null, 2);
      start = now; samples = [];
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
