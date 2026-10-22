import * as THREE from 'three';
import { mountControls } from '../../ui/controls.js';
import { configureViewport, diagnostics } from '../../play/viewport.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createBoardModel, SURFACE_HEIGHT } from './model.js';
import './style.css';

export const DEFAULTS = Object.freeze({ magic: 65, veil: 55, animation: true });
const reference = new URL('./references/approved-multiview.png', import.meta.url).href;

export function mountBoard({ createOverlay, interactive=false } = {}) {
  const debug=diagnostics();
  let dirty=true;
  const invalidate=()=>{dirty=true;};
  document.title = 'Dusk Mirror';
  document.body.classList.add('dusk');
  document.querySelector('#app').innerHTML = `
    <canvas id="scene" aria-label="Dusk Mirror 3D chessboard. Drag to rotate; scroll to zoom."></canvas>
    <aside aria-label="Board settings" hidden>
      <label for="board-view">View</label>
      <select id="board-view"><option value="perspective">Perspective</option><option value="top">Top</option><option value="front">Front</option><option value="side">Side</option><option value="corner">Corner detail</option><option value="edge">Edge detail</option><option value="under">Underside</option><option value="surface">Square detail</option><option value="custom" disabled>Custom view</option></select>
      <details id="dusk-appearance" class="advanced-settings"><summary>Appearance</summary>
      <label for="magic">Red glow intensity <output id="magic-value">65%</output></label><input id="magic" type="range" min="0" max="100" value="65">
      <label for="veil">Smoky crystal depth <output id="veil-value">55%</output></label><input id="veil" type="range" min="0" max="100" value="55">
      </details>
      <div class="settings-row"><button id="pause" aria-pressed="false">Pause animation</button><button id="reset" title="Restore default settings and perspective view">Reset defaults</button></div>
      <nav class="settings-links"><a href="${import.meta.env.BASE_URL}?board=dusk-mirror">Free Play</a><a href="${import.meta.env.BASE_URL}boards/dusk-mirror/${createOverlay ? '' : '?pieces=ruby'}">${createOverlay ? 'Board only' : 'Show pieces'}</a><a href="${reference}" target="_blank" rel="noopener">Reference image</a></nav>
    </aside>
    <footer><span>Drag to rotate · Scroll to zoom · Two-finger drag to pan</span></footer>
    <div id="error" role="alert" hidden></div>`;
  const canvas = document.querySelector('#scene');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (error) { const notice = document.querySelector('#error'); notice.hidden = false; notice.textContent = 'WebGL is unavailable. Enable hardware acceleration in your browser.'; throw error; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(.016, .018, .028);
  const camera = new THREE.PerspectiveCamera(36, 1, .08, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.minDistance = 1.6; controls.maxDistance = 30;
  controls.minPolarAngle = .001; controls.maxPolarAngle = Math.PI - .03;
  const model = createBoardModel(renderer); scene.add(model.group);
  scene.add(new THREE.HemisphereLight(0xc8b7d7, 0x160610, 1));
  const light = new THREE.DirectionalLight(0xffe4e6, 2); light.position.set(-4, 8, 4); scene.add(light);
  const rim = new THREE.DirectionalLight(0xc7bde5, 1.3); rim.position.set(5, 3, -4); scene.add(rim);

  // Broad, static studio washes lift the dark silhouette off the ground. The
  // existing floor draw carries this backdrop; no added lights or bloom passes.
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      threads: { value: model.optics.threads }, power: model.optics.shared.power, time: model.optics.shared.time,
    },
    vertexShader: `varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 p;uniform sampler2D threads;uniform float power,time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){float edge=max(abs(p.x),abs(p.z));
        float glow=exp(-pow((edge-4.3)*1.8,2.));
        vec2 drift=vec2(time*.005,-time*.003);
        float trail=pow(.5+.5*sin(time*.7-p.x*2.7-p.z*2.1),10.);
        float strand=texture2D(threads,p.xz*.115+drift).r*trail;
        vec2 centre=p.xz*vec2(.075,.065);
        vec2 cool=(p.xz-vec2(-3.,-5.))*vec2(.085,.07);
        vec2 warm=(p.xz-vec2(5.,3.))*vec2(.09,.08);
        vec3 color=vec3(.016,.018,.028);
        color+=vec3(.012,.011,.020)*exp(-dot(centre,centre));
        color+=vec3(.006,.012,.025)*exp(-dot(cool,cool));
        color+=vec3(.014,.003,.009)*exp(-dot(warm,warm));
        // A soft contact shadow anchors the slab without losing its edge in
        // a black void. Fine dither prevents banding in the broad gradients.
        color*=mix(.32,1.,smoothstep(3.8,5.3,edge));
        color+=(hash(p.xz*340.)-.5)*.0007;
        color+=vec3(.22,.0012,.019)*glow*(.12+strand*2.)*power;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
      `,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.51; scene.add(ground);

  // A planar reflection supplements the material's studio highlights with real
  // reflections of the existing jewel models, including their faceted shaders.
  const shader = {
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: `uniform mat4 textureMatrix;varying vec4 r;varying vec3 p;
      void main(){p=(modelMatrix*vec4(position,1.)).xyz;r=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;varying vec4 r;varying vec3 p;
      void main(){vec3 c=texture2D(tDiffuse,r.xy/r.w).rgb;
        float f=.12+.28*pow(1.-abs(normalize(cameraPosition-p).y),3.);
        vec2 cell=fract(p.xz+4.);float edge=min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y));
        // The planar image belongs to the flat seat, not its cut edge.
        float seat=smoothstep(.007,.012,edge);
        gl_FragColor=vec4(c,f*seat);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const reflection = new Reflector(new THREE.PlaneGeometry(8, 8), { textureWidth: interactive?512:1024, textureHeight: interactive?512:1024, clipBias: .002, shader, multisample: Math.min(2, renderer.capabilities.maxSamples) });
  reflection.camera.userData.rubyReflection=true;
  reflection.rotation.x = -Math.PI / 2; reflection.position.y = SURFACE_HEIGHT + .001;
  reflection.material.transparent = true; reflection.material.depthWrite = false; reflection.renderOrder = 1;
  scene.add(reflection);
  const context = { renderer, scene, camera, controls, sampleHeight: () => SURFACE_HEIGHT + .007, squareSize: 1, invalidate };
  const overlay = createOverlay?.(context); overlay?.update?.();
  if (overlay?.group) {
    const label = document.createElement('label'); label.className = 'toggle dusk-pieces';
    label.innerHTML = '<input id="show-pieces" type="checkbox" checked> Ruby pieces';
    document.querySelector('#dusk-appearance').append(label);
    label.querySelector('input').onchange = e => { overlay.group.visible = e.target.checked; };
  }
  const presets = {
    perspective: [[10, 10.8, 12.8], [.7, 0, 0]],
    top: [[0, 17, .001], [0, 0, 0]],
    front: [[0, 1.5, 15], [0, .05, 0]],
    side: [[15, 1.5, 0], [0, .05, 0]],
    corner: [[7.1, 2.5, 7.2], [3.9, .05, 3.9]],
    edge: [[2.8, .8, 8.1], [1.2, -.02, 4.1]],
    under: [[10, -8, 12], [0, -.1, 0]],
    surface: [[3.5, 4.7, 6], [1.5, 0, 1.5]],
  };
  let view = 'perspective';
  const viewChoice = document.querySelector('#board-view');
  function setView(name) {
    view = name;
    const [position, target] = presets[name]; camera.position.set(...position); controls.target.set(...target);
    if (name === 'perspective' && innerWidth < 700) { camera.position.multiplyScalar(1.25); controls.target.set(0, 0, 0); }
    controls.update();
    viewChoice.value = name;
  }
  viewChoice.onchange = () => setView(viewChoice.value);
  // A hand-rotated view no longer claims to be one of the named camera views.
  controls.addEventListener('start', () => { viewChoice.value = 'custom'; });
  let paused = !debug.motion, elapsed = 0;
  const pauseButton = document.querySelector('#pause');
  const setPaused = value => { paused = value; invalidate(); pauseButton.textContent = value ? 'Resume animation' : 'Pause animation'; pauseButton.setAttribute('aria-pressed', String(value)); };
  pauseButton.onclick = () => setPaused(!paused);
  for (const [id, uniform] of [['magic', 'power'], ['veil', 'veil']]) document.querySelector(`#${id}`).oninput = event => {
    model.optics.shared[uniform].value = Number(event.target.value) / 100;
    document.querySelector(`#${id}-value`).value = `${event.target.value}%`;
  };
  document.querySelector('#reset').onclick = () => {
    for (const [id, uniform] of [['magic', 'power'], ['veil', 'veil']]) {
      document.querySelector(`#${id}`).value = DEFAULTS[id]; document.querySelector(`#${id}-value`).value = `${DEFAULTS[id]}%`;
      model.optics.shared[uniform].value = DEFAULTS[id] / 100;
    }
    setPaused(false); elapsed = 0;
    if (overlay?.group) { overlay.group.visible = true; document.querySelector('#show-pieces').checked = true; }
    setView('perspective');
  };
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(interactive?2:4, renderer.capabilities.maxSamples) });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .19, .35, 1.1); composer.addPass(bloom);
  composer.addPass(new OutputPass()); if(!interactive)composer.addPass(new SMAAPass());
  configureViewport({renderer,camera,composer,interactive,invalidate,maxRatio:interactive?1.5:2,budget:interactive?1800000:3500000});
  setView('perspective');
  controls.addEventListener('change',invalidate);
  document.querySelector('aside').addEventListener('input',invalidate);
  document.querySelector('aside').addEventListener('change',invalidate);
  document.addEventListener('visibilitychange',invalidate);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta=Math.min(clock.getDelta(),.08);
    if(document.hidden)return;
    const moved=controls.update();
    if(paused&&!dirty&&!moved)return;
    dirty=false;
    if(!paused)elapsed+=delta;
    model.update(elapsed);overlay?.update?.();
    model.details.visible = camera.position.y > SURFACE_HEIGHT;
    ground.visible = camera.position.y > -.4;
    reflection.visible = debug.reflection && camera.position.y > SURFACE_HEIGHT;
    renderer.info.reset();
    if(debug.post)composer.render();else renderer.render(scene,camera);
  });
  if (!interactive) mountControls();
  return { ...context, model, setView, get view() { return view; } };
}
