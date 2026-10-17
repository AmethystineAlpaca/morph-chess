// Settings float over the scene, so no space is reserved for a sidebar.
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
    if(interactive) camera.zoom=compact?Math.min(.9,camera.aspect/1.35):.9;
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
