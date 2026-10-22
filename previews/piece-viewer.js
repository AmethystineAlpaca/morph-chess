import * as THREE from 'three';
import { rubySet } from '../pieces/ruby/index.js';
import { nightOathSet } from '../pieces/night-oath/index.js';
import { GEM_PALETTES } from '../play/appearance.js';
import { fracturePiece, FRACTURE_PIECES } from '../pieces/ruby/fracture-piece.js';
import { fractureMaterial } from '../pieces/ruby/fracture-material.js';
import { FractureAudio } from '../pieces/ruby/fracture-audio.js';
import { sampleFracture, FRACTURE_TIME, DURATION } from '../pieces/ruby/fracture-motion.js';
import { createPieceStage } from './piece-stage.js';
import './piece-viewer.css';

const icons = { pawn: '♟', rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚' };
const sets = { ruby: rubySet, 'night-oath': nightOathSet };
const colors = ['ruby', 'sapphire'];
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

function tintGem(group, color) {
  const palette = GEM_PALETTES[colors.indexOf(color)];
  group.traverse(mesh => {
    const uniforms = mesh.material?.uniforms;
    if (!uniforms?.gemFilter) return;
    const baseline = mesh.material.userData.opticalAbsorption || [.35, 12, 9];
    const density = mesh.material.userData.paletteDensity || 1;
    if (color === 'ruby') uniforms.gemFilter.value.set(1, 1, 1);
    else uniforms.gemFilter.value.set(...palette.absorption.map((value, channel) => value * density / baseline[channel]));
    uniforms.veinTint.value.fromArray(palette.light);
  });
}

export function mountPieceViewer(initialSet = rubySet) {
  const query = new URLSearchParams(location.search);
  let type = FRACTURE_PIECES.some(piece => piece.type === query.get('piece')) ? query.get('piece') : 'pawn';
  let set = sets[query.get('set')] || initialSet;
  let color = colors.includes(query.get('color')) ? query.get('color') : 'ruby';
  document.documentElement.lang = 'en';
  document.body.innerHTML = `<main id="piece-gallery">
    <h1 class="sr-only">Interactive chess piece collection</h1>
    <canvas id="scene" tabindex="0" role="button" aria-describedby="gesture-hint gesture-secondary" aria-keyshortcuts="Enter Space Escape"></canvas>
    <nav class="gallery-tools" aria-label="Gallery options">
      <a id="back-to-board" class="tool-button" href="${import.meta.env.BASE_URL}?pieces=${set.id}" title="Back to board" aria-label="Back to board"><span aria-hidden="true">←</span><span>Board</span></a>
      <button id="sound" class="tool-button" aria-label="Sound" aria-pressed="true" title="Loading sound" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="sound-waves" d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-muted" d="m17 9 5 6m0-6-5 6"/></svg>
        <span id="sound-label">Sound</span>
      </button>
    </nav>
    <button id="collection-toggle" aria-controls="collection-panel" aria-expanded="false"><span aria-hidden="true">▦</span>Choose a piece</button>
    <aside id="collection-panel" aria-label="Choose your piece">
      <div class="panel-heading"><span>Choose a piece</span><button id="collection-close" class="icon-button" aria-label="Close collection">×</button></div>
      <p class="option-label" id="theme-label">Theme</p>
      <div class="theme-options" role="group" aria-labelledby="theme-label">
        <button data-set="ruby" aria-label="Ruby, pure gemstone"><i class="theme-gem" aria-hidden="true"></i><span>Ruby<small>Pure gemstone</small></span></button>
        <button data-set="night-oath" aria-label="Night Oath, champagne gold"><i class="theme-gem gold" aria-hidden="true"></i><span>Night Oath<small>Champagne gold</small></span></button>
      </div>
      <p class="option-label" id="color-label">Gem color</p>
      <div class="color-options" role="group" aria-labelledby="color-label">
        <button data-color="ruby"><i class="swatch ruby" aria-hidden="true"></i>Ruby</button>
        <button data-color="sapphire"><i class="swatch sapphire" aria-hidden="true"></i>Sapphire</button>
      </div>
      <p class="option-label" id="piece-label">Piece</p>
      <div class="piece-options" role="group" aria-labelledby="piece-label">
        ${FRACTURE_PIECES.map(piece => `<button data-piece="${piece.type}" aria-label="${piece.name}"><span class="piece-symbol" aria-hidden="true">${icons[piece.type]}</span><span>${piece.name}</span></button>`).join('')}
      </div>
    </aside>
    <div class="gallery-hint" data-state="loading" role="note" aria-label="How to interact">
      <div class="hint-primary">
        <span class="hint-icon" aria-hidden="true">
          <svg class="hint-shatter" viewBox="0 0 24 24"><path d="m8 3-5 7 8 11 10-11-5-7H8Z"/><path d="m13 3-3 7 5 2-4 9M3 10h7m5 2 6-2"/></svg>
          <svg class="hint-restore" viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg>
          <span class="hint-spinner"></span>
        </span>
        <span id="gesture-hint">Preparing piece…</span>
      </div>
      <div id="gesture-secondary"><span><span aria-hidden="true">↔</span> Drag to rotate</span><span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 5 5M5 8h6M8 5v6"/></svg><span id="zoom-hint">Scroll to zoom</span></span></div>
    </div>
    <span id="gallery-status" class="sr-only" role="status" aria-live="polite"></span>
    <p id="gallery-error" role="alert" hidden></p>
  </main>`;
  const $ = selector => document.querySelector(selector), canvas = $('#scene');
  let active = null, dirty = true, time = 0, playing = false, loading = true, selectionVersion = 0, actionVersion = 0;
  const stage = createPieceStage(canvas, message => { $('#gallery-error').hidden = false; $('#gallery-error').textContent = message; }, () => { dirty = true; });
  const { renderer, scene, camera, controls, studio } = stage;
  const sound = new FractureAudio([
    { url: new URL('../pieces/ruby/audio/break-wine-glass.wav', import.meta.url), gain: .7 },
    { url: new URL('../pieces/ruby/audio/breaking-glass-stereo.wav', import.meta.url), gain: .9 },
  ], FRACTURE_TIME);
  sound.ready.then(() => { $('#sound').disabled = false; $('#sound').title = 'Turn sound off'; $('#sound-label').textContent = 'Sound on'; }).catch(() => {
    $('#sound').title = 'Sound unavailable'; $('#sound').setAttribute('aria-label', 'Sound unavailable');
    $('#sound-label').textContent = 'No sound';
  });
  const touchInput = matchMedia('(pointer: coarse)');
  touchInput.addEventListener('change', () => update());
  const cache = new Map(), eye = new THREE.Vector3();
  let status = '', hintState = '';
  function update() {
    if (!active) return;
    const broken = time >= FRACTURE_TIME;
    active.model.visible = !broken;
    active.fragments.visible = broken && !loading;
    if (broken && !loading) for (const shard of active.shards) sampleFracture(shard, time, shard.mesh);
    const name = FRACTURE_PIECES.find(piece => piece.type === type).name;
    const gesture = touchInput.matches ? 'Tap' : 'Click';
    const nextHint = loading ? `Preparing ${name.toLowerCase()}…` : broken ? `${gesture} the fragments to restore` : playing ? `${gesture} to restore` : `${gesture} the piece to shatter`;
    if (nextHint !== hintState) {
      hintState = nextHint; $('#gesture-hint').textContent = nextHint;
      $('#zoom-hint').textContent = `${touchInput.matches ? 'Pinch' : 'Scroll'} to zoom`;
      $('.gallery-hint').dataset.state = loading ? 'loading' : broken || playing ? 'broken' : 'ready';
    }
    canvas.setAttribute('aria-label', `${color === 'ruby' ? 'Ruby' : 'Sapphire'} ${name}, ${set.name}. ${loading ? 'Preparing' : broken || playing ? 'Activate to restore' : 'Activate to shatter'}.`);
    canvas.setAttribute('aria-busy', String(loading));
    canvas.setAttribute('aria-disabled', String(loading));
    const nextStatus = `${name} ${loading ? 'loading' : broken ? 'shattered' : 'ready'}`;
    if (nextStatus !== status) { status = nextStatus; $('#gallery-status').textContent = nextStatus; }
    dirty = true;
  }
  function stop() { actionVersion++; playing = false; sound.stop(); }
  function restore() { stop(); time = 0; update(); }
  async function activate() {
    if (loading) return;
    if (playing || time >= FRACTURE_TIME) { restore(); return; }
    const action = ++actionVersion;
    await Promise.all([sound.unlock(), sound.ready.catch(() => {})]);
    if (action !== actionVersion) return;
    // Direct manipulation skips the old demo's idle lead-in. The approved
    // fracture poses and the sound still start together at FRACTURE_TIME.
    time = FRACTURE_TIME - .08; playing = true;
    sound.start(time, 1, { newTake: true }); update();
  }
  function dispose(entry) {
    scene.remove(entry.model, entry.fragments);
    entry.model.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); if (mesh.material.uniforms?.localEye) mesh.material.dispose(); } });
    for (const shard of entry.shards) { shard.geometry.dispose(); if (!shard.metal) shard.mesh.material.dispose(); }
  }
  async function prepare(entry, pieceType) {
    await nextFrame();
    entry.shards = fracturePiece(entry.model, pieceType);
    entry.restoreRadius = Math.max(...entry.shards.map(shard => {
      const offset = shard.frames.length - 7;
      return Math.hypot(shard.frames[offset], shard.frames[offset + 2]) + shard.geometry.boundingSphere.radius;
    })) + .05;
    for (const shard of entry.shards) {
      const material = shard.metal ? shard.material : fractureMaterial(shard.geometry, studio.cube.texture);
      const mesh = new THREE.Mesh(shard.geometry, material);
      if (!shard.metal) mesh.onBeforeRender = (_renderer, _scene, activeCamera) => {
        activeCamera.getWorldPosition(eye); material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
      };
      mesh.renderOrder = 2; mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.copy(shard.center); entry.fragments.add(mesh); shard.mesh = mesh;
    }
    await renderer.compileAsync(entry.fragments, camera, scene);
    entry.ready = true;
  }
  function updateChoices() {
    for (const button of document.querySelectorAll('[data-set]')) button.setAttribute('aria-pressed', String(button.dataset.set === set.id));
    for (const button of document.querySelectorAll('[data-color]')) button.setAttribute('aria-pressed', String(button.dataset.color === color));
    for (const button of document.querySelectorAll('[data-piece]')) button.setAttribute('aria-pressed', String(button.dataset.piece === type));
    $('#piece-gallery').dataset.color = color;
    const backQuery = new URLSearchParams({ pieces: set.id });
    if (query.has('board')) backQuery.set('board', query.get('board'));
    $('#back-to-board').href = `${import.meta.env.BASE_URL}?${backQuery}`;
    document.title = `${FRACTURE_PIECES.find(piece => piece.type === type).name} · ${set.name} · Morph Chess`;
    const url = new URL(location.href);
    url.pathname = `${import.meta.env.BASE_URL}pieces/${set.id}/`;
    url.searchParams.delete('set'); url.searchParams.set('piece', type); url.searchParams.set('color', color);
    history.replaceState(null, '', url);
  }
  async function select() {
    const version = ++selectionVersion; restore(); loading = true;
    if (active) scene.remove(active.model, active.fragments);
    updateChoices();
    const key = `${set.id}/${type}`;
    if (!cache.has(key)) {
      const entry = { model: set.create(type, renderer), fragments: new THREE.Group(), shards: [], ready: false };
      entry.fragments.visible = false;
      cache.set(key, entry); entry.pending = prepare(entry, type);
    }
    active = cache.get(key);
    cache.delete(key); cache.set(key, active);
    scene.add(active.model, active.fragments);
    tintGem(active.model, color); tintGem(active.fragments, color);
    stage.frame(set.dimensions[type].height, !status); update();
    try { await active.pending; }
    catch (error) {
      if (version === selectionVersion) { $('#gallery-error').hidden = false; $('#gallery-error').textContent = 'Could not prepare this piece. Select it again to retry.'; cache.delete(key); }
      console.error(error); return;
    }
    if (version !== selectionVersion) return;
    loading = false; $('#gallery-error').hidden = true;
    tintGem(active.fragments, color); update();
    for (const [oldKey, entry] of cache) {
      if (cache.size <= 3) break;
      if (entry === active || !entry.ready) continue;
      dispose(entry); cache.delete(oldKey);
    }
  }
  function panelOpen(open, keyboard = false) {
    $('#collection-panel').classList.toggle('open', open);
    $('#collection-toggle').setAttribute('aria-expanded', String(open));
    stage.setPanelOpen(open);
    if (open && keyboard) $('.theme-options [aria-pressed=true]').focus();
  }
  for (const button of document.querySelectorAll('[data-set]')) button.onclick = () => {
    if (set.id === button.dataset.set) return;
    set = sets[button.dataset.set]; select();
  };
  for (const button of document.querySelectorAll('[data-color]')) button.onclick = () => {
    if (color === button.dataset.color) return;
    color = button.dataset.color; updateChoices();
    if (active) { tintGem(active.model, color); tintGem(active.fragments, color); update(); }
  };
  for (const button of document.querySelectorAll('[data-piece]')) button.onclick = () => {
    if (type !== button.dataset.piece || !cache.has(`${set.id}/${type}`)) { type = button.dataset.piece; select(); }
    panelOpen(false);
    if (innerWidth <= 800) canvas.focus({ preventScroll: true });
  };
  $('#collection-toggle').onclick = event => panelOpen(!$('#collection-panel').classList.contains('open'), event.detail === 0);
  $('#collection-close').onclick = () => { panelOpen(false); $('#collection-toggle').focus(); };
  $('#sound').onclick = () => {
    sound.setMuted(!sound.muted);
    $('#sound').title = sound.muted ? 'Turn sound on' : 'Turn sound off';
    $('#sound-label').textContent = sound.muted ? 'Sound off' : 'Sound on';
    $('#sound').setAttribute('aria-pressed', String(!sound.muted));
  };
  const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.015), floorHit = new THREE.Vector3();
  function hitPiece(event) {
    if (!active || loading) return false;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (time >= FRACTURE_TIME) {
      // Gaps between small shards are still part of the pile's click target.
      const hit = raycaster.ray.intersectPlane(floorPlane, floorHit);
      return !!hit && Math.hypot(hit.x, hit.z) < active.restoreRadius;
    }
    return raycaster.intersectObject(active.model, true).length > 0;
  }
  let down = null;
  const pointers = new Set();
  canvas.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { down = null; return; }
    if (event.button === 0) down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  });
  canvas.addEventListener('pointermove', event => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.dragged = true;
    canvas.style.cursor = down?.dragged ? 'grabbing' : hitPiece(event) ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); down = null; });
  canvas.addEventListener('pointerup', event => {
    pointers.delete(event.pointerId);
    const click = down && down.id === event.pointerId && !down.dragged;
    down = null; canvas.style.cursor = 'grab';
    if (!click) return;
    if (innerWidth <= 800 && $('#collection-panel').classList.contains('open')) { panelOpen(false); return; }
    if (hitPiece(event)) activate();
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) activate(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (innerWidth <= 800 && $('#collection-panel').classList.contains('open')) {
      panelOpen(false); $('#collection-toggle').focus();
    } else restore();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) { time = DURATION; stop(); update(); }
  });
  window.addEventListener('pagehide', stop);
  renderer.setAnimationLoop(() => {
    if (document.hidden) return;
    if (playing) { time = Math.min(DURATION, sound.time); if (time >= DURATION) stop(); update(); }
    controls.update();
    if (dirty && active) { dirty = false; renderer.render(scene, camera); }
  });
  select();
  return { restore };
}
