import * as THREE from 'three';
import { mountControls } from '../../ui/controls.js';
import { configureViewport, diagnostics } from '../../play/viewport.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createStudio } from './materials.js';
import { createBoardModel, SURFACE_HEIGHT } from './model.js';
export const DEFAULTS = Object.freeze({ roughness: 24 });

export function mountBoard({createOverlay, interactive=false}={}) {
  const debug=diagnostics();
  document.title='Midnight Silver';
  document.body.classList.add('midnight');
  document.querySelector('#app').innerHTML=`<canvas id="scene" aria-label="Midnight Silver 3D chessboard. Drag to rotate; scroll to zoom."></canvas>
  <aside aria-label="Board settings" hidden>
    <label for="board-view">View</label><select id="board-view"><option value="perspective">Perspective</option><option value="top">Top</option><option value="detail">Inlay detail</option><option value="edge">Edge detail</option><option value="custom" disabled>Custom view</option></select>
    <details class="advanced-settings"><summary>Appearance</summary><label for="finish">Stone roughness <output id="finish-value">24%</output></label><input id="finish" type="range" min="12" max="65" value="24"><label class="toggle"><input id="ornament" type="checkbox" checked> Show inlays</label></details>
    <nav class="settings-links"><a href="/?board=midnight-silver">Free Play</a><a href="/pieces/ruby/">View pieces</a></nav>
  </aside>
  <footer><span>Drag to rotate · Scroll to zoom</span></footer><div id="error" hidden></div>`;
  let dirty=true;
  const invalidate=()=>{dirty=true;};
  const canvas=document.querySelector('#scene');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch(error){document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='WebGL is unavailable. Enable hardware acceleration in your browser.';throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#09111e');scene.fog=new THREE.Fog('#09111e',35,95);
  const camera=new THREE.PerspectiveCamera(36,1,.5,100);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3.2;controls.maxDistance=28;controls.maxPolarAngle=1.43;controls.minPolarAngle=.001;
  function reset(){camera.position.set(11,12,14);controls.target.set(.55,0,0);controls.update();}
  reset();
  const environment=createStudio(renderer);scene.environment=environment.texture;scene.environmentIntensity=1;
  scene.add(new THREE.HemisphereLight(0xbdd3ed,0x080d17,.45));
  const key=new THREE.DirectionalLight(0xffedcf,2.3);key.position.set(-5,10,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7});key.shadow.normalBias=.003;key.shadow.bias=-.00003;key.shadow.radius=3;scene.add(key);
  const rim=new THREE.DirectionalLight(0xb6d4ff,1.2);rim.position.set(5,5,-7);scene.add(rim);
  const grazing=new THREE.DirectionalLight(0xffe4bd,.65);grazing.position.set(-7,3.5,4);scene.add(grazing);
  const model=createBoardModel(renderer, invalidate);scene.add(model.group);
  if(interactive) for(const material of model.materials){material.roughness=.40;material.clearcoat=.22;material.envMapIntensity=.55;}
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#080f1a',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-.725;ground.receiveShadow=true;scene.add(ground);
  // Soft ambient occlusion under the entire slab supplements the directional
  // shadow, grounding the object even on the unlit side of the plinth.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;
  const ctx=shadowCanvas.getContext('2d');
  for(let i=0;i<24;i++){ctx.fillStyle='rgba(0,0,0,.025)';const inset=12+i;ctx.fillRect(inset,inset,256-2*inset,256-2*inset);}
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(11.5,11.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.721;scene.add(shadow);
  // Real planar reflections of the supplied pieces, with Fresnel falloff.
  // Environment highlights remain in the stone's physical material.
  const reflectionShader={
    uniforms:{...THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),polish:{value:interactive?.42:.24}},
    vertexShader:`uniform mat4 textureMatrix;varying vec4 vReflection;varying vec3 vWorld;varying vec2 vBoardUv;
      void main(){vBoardUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;vReflection=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float polish;varying vec4 vReflection;varying vec3 vWorld;varying vec2 vBoardUv;
      void main(){vec2 uv=vReflection.xy/vReflection.w;float blur=.0006+polish*.0035;
      vec3 reflected=texture2D(tDiffuse,uv).rgb*.4;
      reflected+=(texture2D(tDiffuse,uv+vec2(blur,0.)).rgb+texture2D(tDiffuse,uv-vec2(blur,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,blur)).rgb+texture2D(tDiffuse,uv-vec2(0.,blur)).rgb)*.15;
      float facing=abs(normalize(cameraPosition-vWorld).y);
      float fresnel=.12+.42*pow(1.-facing,3.);
      // Polished tiles reflect individually; the joints and beveled edges do not.
      vec2 tile=fract(vBoardUv*8.);
      float edge=min(min(tile.x,1.-tile.x),min(tile.y,1.-tile.y));
      float gapWidth=max(fwidth(edge)*1.2,.008);
      float tileMask=smoothstep(.003,.003+gapWidth,edge);
      gl_FragColor=vec4(reflected,fresnel*(1.-polish)*tileMask);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  };
  const reflection=new Reflector(new THREE.PlaneGeometry(8,8),{textureWidth:interactive?512:1024,textureHeight:interactive?512:1024,clipBias:.001,shader:reflectionShader,multisample:Math.min(2,renderer.capabilities.maxSamples)});
  reflection.camera.userData.rubyReflection=true;reflection.visible=debug.reflection;
  reflection.rotation.x=-Math.PI/2;reflection.position.y=SURFACE_HEIGHT+.003;reflection.material.transparent=true;reflection.material.depthWrite=false;reflection.renderOrder=2;scene.add(reflection);
  const context={scene,renderer,camera,controls,sampleHeight:()=>SURFACE_HEIGHT+.006,squareSize:1,invalidate};
  const overlay=createOverlay?.(context);overlay?.update?.();
  const viewChoice=document.querySelector('#board-view');
  viewChoice.onchange=()=>{
    if(viewChoice.value==='perspective'){reset();return;}
    const views={top:[[0,19,.01],[0,0,0]],detail:[[6.15,2.7,6.65],[3.7,.01,3.85]],edge:[[6.7,1.25,8.3],[3.3,-.31,4.4]]};
    const [position,target]=views[viewChoice.value];camera.position.set(...position);controls.target.set(...target);controls.update();
  };
  controls.addEventListener('start',()=>{viewChoice.value='custom';});
  document.querySelector('#ornament').onchange=e=>{model.ornaments.visible=e.target.checked;};
  document.querySelector('#finish').oninput=e=>{for(const material of model.materials)material.roughness=Number(e.target.value)/100;reflection.material.uniforms.polish.value=Number(e.target.value)/100;document.querySelector('#finish-value').value=e.target.value+'%';};
  // MSAA covers geometric edges; SMAA resolves the remaining high-contrast
  // inlay stair-steps after tone mapping, without globally blurring the marble.
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(interactive?2:4,renderer.capabilities.maxSamples)});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new OutputPass());
  if(!interactive)composer.addPass(new SMAAPass());
  configureViewport({renderer,camera,composer,interactive,invalidate,maxRatio:interactive?1.5:2,budget:interactive?1800000:6000000});
  controls.addEventListener('change',invalidate);
  document.querySelector('aside').addEventListener('input',invalidate);
  document.querySelector('aside').addEventListener('change',()=>{renderer.shadowMap.needsUpdate=true;invalidate();});
  document.addEventListener('visibilitychange',invalidate);
  if(interactive){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;}
  renderer.setAnimationLoop(()=>{
    if(document.hidden)return;
    const moved=controls.update();
    overlay?.update?.();
    if(interactive&&!dirty&&!moved)return;
    dirty=false;
    renderer.info.reset();
    if(debug.post)composer.render();else renderer.render(scene,camera);
  });
  if(!interactive)mountControls();
  return context;
}
