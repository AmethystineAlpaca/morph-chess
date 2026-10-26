import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { jewelryStudio } from '../pieces/ruby/material.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGemEffects } from '../play/gem-effects.js';

// The approved fracture stage is shared by both piece collections.
export function createPieceStage(canvas, onError, invalidate) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (error) { onError('3D preview is unavailable. Enable hardware acceleration in your browser.'); throw error; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#13151c');
  scene.fog = new THREE.FogExp2('#13151c', .11);
  const camera = new THREE.PerspectiveCamera(35, 1, .03, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 1.5; controls.maxDistance = 7;
  controls.minPolarAngle = .01; controls.maxPolarAngle = Math.PI * .47;
  scene.add(new THREE.HemisphereLight('#e1e6ff', '#38232e', 1.8));
  const key = new THREE.DirectionalLight('#fff1e7', 3.2);
  key.position.set(-2, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: .1, far: 10 });
  key.shadow.bias = -.0001; key.shadow.normalBias = .006; key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#c7d7ff', 2);
  rim.position.set(2, 2, -2); scene.add(rim);
  const studio = jewelryStudio(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromCubemap(studio.cube.texture);
  scene.environment = environment.texture; pmrem.dispose();

  const checker = document.createElement('canvas'); checker.width = checker.height = 256;
  const ctx = checker.getContext('2d');
  ctx.fillStyle = '#252630'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1e2029'; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
  ctx.strokeStyle = '#30313b'; ctx.lineWidth = .6;
  for (const x of [0, 128, 256]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (const y of [0, 128, 256]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  const floorTexture = new THREE.CanvasTexture(checker);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(40, 40); floorTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTexture, roughness: .34, metalness: .28, envMapIntensity: .25 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const reflectionShader = {
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: `uniform mat4 textureMatrix; varying vec4 reflectionUv; void main() { reflectionUv=textureMatrix*vec4(position,1.); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec4 reflectionUv; void main() {
      vec2 uv=reflectionUv.xy/reflectionUv.w; vec3 reflected=texture2D(tDiffuse,uv).rgb*.4;
      reflected+=texture2D(tDiffuse,uv+vec2(.0015,0.)).rgb*.15;
      reflected+=texture2D(tDiffuse,uv-vec2(.0015,0.)).rgb*.15;
      reflected+=texture2D(tDiffuse,uv+vec2(0.,.0015)).rgb*.15;
      reflected+=texture2D(tDiffuse,uv-vec2(0.,.0015)).rgb*.15;
      gl_FragColor=vec4(reflected,.16);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  };
  const reflection = new Reflector(new THREE.PlaneGeometry(20, 20), { textureWidth: 1024, textureHeight: 1024, clipBias: .001, shader: reflectionShader, multisample: Math.min(4, renderer.capabilities.maxSamples) });
  reflection.rotation.x = -Math.PI / 2; reflection.position.y = .0005;
  reflection.material.transparent = true; reflection.material.depthWrite = false; reflection.renderOrder = 1;
  scene.add(reflection);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) }));
  composer.addPass(new RenderPass(scene, camera));
  const gemEffects = createGemEffects({ renderer, invalidate });
  gemEffects.connectComposer(composer);
  composer.addPass(new SMAAPass()); composer.addPass(new OutputPass());
  let framedHeight = .95, overlayOpen = false;
  function frame(height, reset = true) {
    const oldTarget = controls.target.clone();
    const direction = camera.position.clone().sub(oldTarget).normalize();
    const scale = Math.max(1, height / 1.1);
    framedHeight = height;
    controls.target.set(0, height * .40, 0);
    if (reset) camera.position.copy(controls.target).add(new THREE.Vector3(1.75, 1.45, 2.8).multiplyScalar(scale));
    else camera.position.copy(controls.target).addScaledVector(direction, 3.6 * scale);
    controls.minDistance = 1.5 * scale; controls.maxDistance = 7 * scale;
    controls.update(); invalidate();
  }
  function resize() {
    const panelSpace = innerWidth > 800 ? 282 : 0;
    const overlaySpace = innerWidth <= 800 && overlayOpen ? 250 : 0;
    const ratio = Math.max(1, Math.min(devicePixelRatio, 2, Math.sqrt(8000000 / (innerWidth * innerHeight))));
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(ratio); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.zoom = Math.min(1, (innerWidth - panelSpace) / innerHeight * .94) * (overlaySpace && innerWidth < 500 ? .8 : 1);
    camera.setViewOffset(innerWidth, innerHeight, (panelSpace + overlaySpace) / 2, 0, innerWidth, innerHeight);
    camera.updateProjectionMatrix(); invalidate();
  }
  controls.addEventListener('change', invalidate);
  window.addEventListener('resize', resize);
  resize(); frame(framedHeight);
  return { renderer, scene, camera, controls, studio, gemEffects, frame,
    render() { composer.render(); },
    closeUp() {
      const direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.set(0, framedHeight * .76, 0);
      camera.position.copy(controls.target).addScaledVector(direction, Math.max(1.5, framedHeight * 1.25));
      controls.update(); invalidate();
    },
    resetView() { frame(framedHeight); },
    setPanelOpen(open) { overlayOpen = open; resize(); },
  };
}
