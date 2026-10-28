import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachTable } from './table.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(t, replies = ['d7d5', 'g8f6']) {
  const keys = ['window', 'innerWidth', 'Worker', 'requestAnimationFrame'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => keys.forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
    else delete globalThis[key];
  }));
  const frames = [];
  globalThis.window = { addEventListener() {} };
  globalThis.innerWidth = 1200;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.Worker = class {
    postMessage(command) {
      const reply = command === 'uci' ? 'uciok' : command === 'isready' ? 'readyok'
        : command.startsWith('go ') ? `bestmove ${replies.shift()}` : null;
      if (reply) queueMicrotask(() => this.onmessage({ data: reply }));
    }
    terminate() {}
  };
  const scene = new THREE.Scene();
  let finishCompile, compilations = 0;
  const renderer = {
    domElement: { addEventListener() {}, style: {} },
    compileAsync() { compilations++; return new Promise(resolve => { finishCompile = resolve; }); },
  };
  const controls = { target: new THREE.Vector3(), update() {} };
  const pieceSet = { create() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(.4, .7, .4), new THREE.ShaderMaterial({
      uniforms: { localEye: { value: new THREE.Vector3() }, studio: { value: null } },
    })));
    return group;
  } };
  const table = attachTable({ scene, renderer, controls, camera: new THREE.PerspectiveCamera(), sampleHeight: () => 0 }, pieceSet, () => {});
  const move = (from, to) => {
    const activate = name => table.activateSquare(name.charCodeAt(0) - 97, Number(name[1]) - 1);
    activate(from); activate(to);
  };
  return { table, scene, frames, move, get compilations() { return compilations; }, compile: () => finishCompile() };
}

test('disabled shattering skips preparation and keeps captures and AI turns correct', async t => {
  const f = fixture(t);
  f.table.setShatterEnabled(false);
  await f.table.startGame();
  f.move('e2', 'e4'); await settle();
  f.move('e4', 'd5'); await settle();
  const state = f.table.getState();
  assert.deepEqual(state.history, ['e4', 'd5', 'exd5', 'Nf6']);
  assert.equal(state.pieces.length, 31);
  assert.equal(state.phase, 'playing');
  assert.equal(state.humanTurn, true);
  assert.equal(f.frames.length, 0, 'no animation or fracture preparation scheduled');
  assert.equal(f.compilations, 0);
  assert.equal(f.scene.getObjectByName('Capture debris'), undefined);
  f.table.setShatterEnabled(true);
  assert.deepEqual(f.table.getState().history, state.history);
});

test('instant en passant removes the captured pawn from its actual square', async t => {
  const f = fixture(t, ['a7a6', 'd7d5', 'g8f6']);
  f.table.setShatterEnabled(false);
  await f.table.startGame();
  f.move('e2', 'e4'); await settle();
  f.move('e4', 'e5'); await settle();
  f.move('e5', 'd6'); await settle();
  const state = f.table.getState();
  assert.equal(state.history[4], 'exd6');
  assert.equal(state.pieces.length, 31);
  assert.equal(state.pieces.some(piece => piece.file === 3 && piece.rank === 4), false);
  assert.equal(state.pieces.some(piece => piece.side === 'white' && piece.file === 3 && piece.rank === 5), true);
});

for (const stage of ['before preparation', 'during compilation', 'while falling']) {
  test(`disabling shattering ${stage} completes exactly one capture and cleans up debris`, async t => {
    const f = fixture(t);
    await f.table.startGame();
    f.move('e2', 'e4'); await settle();
    f.move('e4', 'd5');
    assert.equal(f.table.getState().phase, 'animating');
    if (stage !== 'before preparation') { f.frames.shift()(); await settle(); }
    if (stage === 'while falling') { f.compile(); await settle(); }
    const debris = f.scene.getObjectByName('Capture debris');
    if (stage === 'while falling') assert.ok(debris);
    f.table.setShatterEnabled(false);
    // Re-enable before the old asynchronous preparation returns: it must stay cancelled.
    f.table.setShatterEnabled(true);
    if (stage === 'before preparation') f.frames.shift()();
    if (stage === 'during compilation') f.compile();
    await settle();
    assert.deepEqual(f.table.getState().history, ['e4', 'd5', 'exd5', 'Nf6']);
    assert.equal(f.table.getState().phase, 'playing');
    assert.equal(f.scene.getObjectByName('Capture debris'), undefined);
    if (debris) assert.equal(debris.children.length, 0);
  });
}
