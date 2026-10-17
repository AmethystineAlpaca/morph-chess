// Fit the scene while keeping interactive play clear of the toolbar and hints.
export function configureViewport({renderer,camera,composer,interactive=false,invalidate=()=>{},maxRatio=1.5,budget=1800000}) {
  const canvas=renderer.domElement;
  function resize() {
    const compact=innerWidth<=700;
    const width=innerWidth;
    const height=Math.max(innerHeight,360);
    canvas.style.position='absolute';canvas.style.left='0px';canvas.style.top='0px';
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    const ratio=Math.min(devicePixelRatio,maxRatio,Math.sqrt(budget/(width*height)));
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
        camera.zoom = compact ? Math.min(.8, camera.aspect / 1.12, .75 * Math.max(.25, (height - 230) / height)) : .9 * Math.max(.5, (height - 180) / height);
        if (!compact) camera.setViewOffset(width, height, 0, 20, width, height);
      }
    }
    camera.updateProjectionMatrix();invalidate();
  }
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
