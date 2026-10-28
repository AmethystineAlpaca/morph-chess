// Fit the scene while keeping interactive play clear of the toolbar and hints.
export function configureViewport({renderer,camera,composer,interactive=false,invalidate=()=>{},maxRatio=2,budget=8000000}) {
  const canvas=renderer.domElement;
  let quality = 'high';
  function resize() {
    const compact=innerWidth<=700;
    const width=innerWidth;
    const height=Math.max(innerHeight,360);
    canvas.style.position='absolute';canvas.style.left='0px';canvas.style.top='0px';
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    // The budget limits HiDPI supersampling, never the native CSS resolution.
    // A fixed low pixel budget otherwise enlarges a sub-resolution image on
    // desktop monitors, undoing even multisample and post-process antialiasing.
    const ratio=quality === 'performance' ? 1 : Math.max(1,Math.min(devicePixelRatio,maxRatio,Math.sqrt(budget/(width*height))));
    renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
    composer?.setPixelRatio(ratio);composer?.setSize(width,height);
    camera.clearViewOffset();camera.aspect=width/height;
    // Leave room for the play toolbar and action card without covering squares.
    if(interactive) {
      if (!compact && height <= 560) {
        // In landscape, use the short edge for the board and put its hint beside it.
        camera.zoom = .76;
        camera.setViewOffset(width, height, Math.min(160, width * .19), 0, width, height);
      } else {
        camera.zoom = compact ? Math.min(.8, camera.aspect / 1.12, .75 * Math.max(.25, (height - 340) / height)) : .9 * Math.max(.5, (height - 260) / height);
        camera.setViewOffset(width, height, 0, compact ? 65 : 80, width, height);
      }
    }
    camera.updateProjectionMatrix();invalidate();
  }
  resize.setQuality = value => {
    if (!['high', 'performance'].includes(value)) return;
    quality = value;
    resize();
  };
  resize.getQuality = () => quality;
  window.addEventListener('resize',resize);resize();
  renderer.info.autoReset=false;
  return resize;
}

export function diagnostics() {
  const query=new URLSearchParams(location.search);
  const enabled=query.has('benchmark');
  return {
    reflection:!enabled||query.get('reflection')!=='off',
    post:!enabled||query.get('post')!=='off',
    motion:!enabled||query.get('motion')!=='off',
  };
}
