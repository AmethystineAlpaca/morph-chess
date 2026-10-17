// Dedicated capture page: uses the app's models, optics and board render passes.
// It is intentionally separate from the app and its production build entries.
import * as THREE from 'three';
import { pieceSets, boards } from '../../catalog.js';
import { tablePieceFactory } from '../../play/piece-cache.js';
import { createAppearanceState } from '../../play/appearance.js';
import { attachTable } from '../../play/table.js';
import { lightMetalPreview } from '../../pieces/night-oath/metal.js';

const query = new URLSearchParams(location.search);
const set = pieceSets[query.get('pieces') || 'night-oath'];
const appearance = createAppearanceState();
const tau = Math.PI * 2;

if (query.get('view') === 'board') {
  // Take control of time without replacing the board's reflection/post pipeline.
  let renderFrame;
  const context = boards[query.get('board')].mount({
    interactive: true,
    createOverlay: ctx => {
      ctx.renderer.setAnimationLoop = callback => { renderFrame = callback; };
      return attachTable(ctx, set, () => {}, { appearance });
    },
  });
  const { camera, controls, invalidate } = context;
  controls.enableDamping = false;
  controls.target.set(0, -1, 0);
  camera.zoom = .9;
  camera.updateProjectionMatrix();
  let phase = 0;
  if (context.model) {
    const update = context.model.update.bind(context.model);
    // The magical field gently advances and returns for a seamless orbit loop.
    context.model.update = () => update(3 + 3 * (1 - Math.cos(phase * tau)));
  }
  window.renderShowcase = progress => {
    phase = progress;
    const angle = .52 + progress * tau;
    const radius = 14.2;
    camera.position.set(Math.sin(angle) * radius, 9.8, Math.cos(angle) * radius);
    controls.update(); invalidate(); renderFrame();
  };
} else {
  const width = innerWidth, height = innerHeight, rowHeight = height / 2, span = 7.4;
  const canvas = document.createElement('canvas'); document.querySelector('#app').append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#15191f');
  lightMetalPreview(scene);
  const halfHeight = span * rowHeight / width / 2;
  const camera = new THREE.OrthographicCamera(-span / 2, span / 2, halfHeight, -halfHeight, .1, 30);
  camera.position.set(0, 2.8, 10); camera.lookAt(0, .83, 0); camera.updateMatrixWorld();
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  const inverse = new THREE.Matrix4();
  const types = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
  const create = tablePieceFactory(set, renderer, appearance);
  const groups = ['white', 'black'].map((side, row) => {
    const group = new THREE.Group(); scene.add(group);
    types.forEach((type, column) => {
      const model = create(type, side);
      model.position.x = (column - 2.5) * 1.13;
      model.userData.restRotation = type === 'knight' ? -.3 : model.rotation.y;
      model.traverse(mesh => {
        if (!mesh.material?.uniforms?.orthographic) return;
        const updateEye = mesh.onBeforeRender;
        mesh.onBeforeRender = function (...args) {
          inverse.copy(this.matrixWorld).invert();
          this.material.uniforms.orthographic.value = true;
          this.material.uniforms.localDirection.value.copy(direction).transformDirection(inverse);
          updateEye.apply(this, args);
        };
      });
      group.add(model);
      const label = document.createElement('span'); label.className = 'piece-label';
      label.textContent = type[0].toUpperCase() + type.slice(1);
      label.style.left = `${width / 2 + model.position.x * width / span}px`;
      label.style.top = `${(row + 1) * rowHeight - 30}px`;
      document.body.append(label);
    });
    const title = document.createElement('p'); title.className = 'row-title';
    title.textContent = side === 'white' ? 'RUBY' : 'SAPPHIRE';
    title.style.top = `${row * rowHeight + 18}px`;
    title.style.color = side === 'white' ? '#c7858e' : '#92a9d3';
    document.body.append(title);
    return group;
  });
  const divider = document.createElement('div'); divider.className = 'divider';
  divider.style.top = `${rowHeight}px`; document.body.append(divider);
  renderer.setScissorTest(true);
  window.renderShowcase = progress => {
    groups.forEach(group => group.children.forEach(model => {
      model.rotation.y = model.userData.restRotation + progress * tau;
    }));
    groups.forEach((group, row) => {
      groups.forEach(other => { other.visible = other === group; });
      renderer.setViewport(0, height - (row + 1) * rowHeight, width, rowHeight);
      renderer.setScissor(0, height - (row + 1) * rowHeight, width, rowHeight);
      renderer.render(scene, camera);
    });
  };
}

window.renderShowcase(0);
window.showcaseReady = true;
