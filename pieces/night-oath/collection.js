import * as THREE from 'three';
import { rubySet } from '../ruby/index.js';
import { nightOathSet } from './index.js';
import { lightMetalPreview } from './metal.js';

const canvas = document.querySelector('#collection');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#15191f');
lightMetalPreview(scene);
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
const shadowContext = shadowCanvas.getContext('2d');
const shadowGradient = shadowContext.createRadialGradient(64, 64, 16, 64, 64, 63);
shadowGradient.addColorStop(0, 'rgba(0,0,0,.65)'); shadowGradient.addColorStop(.55, 'rgba(0,0,0,.22)'); shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 128, 128);
const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
for (let i = 0; i < 6; i++) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.position.set((i - 2.5) * 1.0, -.002, 0); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
}
const camera = new THREE.OrthographicCamera(-3.5, 3.5, 2, -2, .1, 30);
const types = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
const models = new Map();
let active, raised = false, rotation = 0, spinning = false, frame = 0, lastTime = 0;
const direction = new THREE.Vector3(), inverse = new THREE.Matrix4();
function render() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  const span = 6.7;
  camera.left = -span / 2; camera.right = span / 2;
  camera.top = span * height / width / 2; camera.bottom = -camera.top;
  camera.position.set(0, raised ? 7 : 3, 10);
  camera.lookAt(0, .79, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  active.children.forEach(model => { model.rotation.y = model.userData.restRotation + rotation; });
  scene.updateMatrixWorld(true); camera.getWorldDirection(direction);
  active.traverse(mesh => {
    const u = mesh.material?.uniforms;
    if (!u?.orthographic) return;
    u.orthographic.value = true;
    inverse.copy(mesh.matrixWorld).invert();
    u.localDirection.value.copy(direction).transformDirection(inverse);
  });
  renderer.render(scene, camera);
}
function select(set) {
  if (active) scene.remove(active);
  if (!models.has(set.id)) {
    const row = new THREE.Group();
    types.forEach((type, i) => {
      const model = set.create(type, renderer); model.position.x = (i - 2.5) * 1.0;
      if (type === 'knight') model.rotation.y = -.30;
      model.userData.restRotation = model.rotation.y;
      row.add(model);
    });
    models.set(set.id, row);
  }
  active = models.get(set.id); scene.add(active);
  document.querySelector('#inlaid').setAttribute('aria-pressed', set === nightOathSet);
  document.querySelector('#original').setAttribute('aria-pressed', set === rubySet);
  document.querySelectorAll('.labels a').forEach((link, i) => { link.href = `${import.meta.env.BASE_URL}pieces/${set.id}/?piece=${types[i]}`; });
  render();
}
document.querySelector('#inlaid').onclick = () => select(nightOathSet);
document.querySelector('#original').onclick = () => select(rubySet);
document.querySelector('#angle').onclick = event => {
  raised = !raised; event.target.setAttribute('aria-pressed', raised); render();
};
window.addEventListener('resize', render);
const rotateButton = document.querySelector('#rotate');
function animate(time) {
  if (!spinning) return;
  if (lastTime) rotation += Math.min(time - lastTime, 50) * .00028;
  lastTime = time; render(); frame = requestAnimationFrame(animate);
}
function setSpinning(value) {
  spinning = value; lastTime = 0;
  rotateButton.setAttribute('aria-pressed', value);
  rotateButton.textContent = value ? 'Pause rotation' : 'Rotate pieces';
  cancelAnimationFrame(frame);
  if (spinning) frame = requestAnimationFrame(animate);
}
rotateButton.onclick = () => setSpinning(!spinning);
let pointer;
canvas.style.touchAction = 'pan-y'; canvas.style.cursor = 'grab';
canvas.onpointerdown = event => { setSpinning(false); pointer = event.clientX; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; };
canvas.onpointermove = event => {
  if (pointer === undefined) return;
  rotation += (event.clientX - pointer) * .008; pointer = event.clientX; render();
};
canvas.onpointerup = canvas.onpointercancel = () => { pointer = undefined; canvas.style.cursor = 'grab'; };
document.addEventListener('visibilitychange', () => { if (document.hidden) setSpinning(false); });
select(nightOathSet);
