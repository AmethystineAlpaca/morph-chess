import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { captureTiming, prepareCaptureEffect, CAPTURE_PAUSE, DEBRIS_FADE } from './capture-effect.js';
import { createAppearanceState } from './appearance.js';

test('capture arrives one second earlier while debris stays visible through landing and sound', () => {
  for (const duration of [1.92, 2.048889]) {
    const arrival = duration + CAPTURE_PAUSE - 1;
    assert.deepEqual(captureTiming(0, duration), { arrived: false, opacity: 1, done: false });
    assert.equal(captureTiming(arrival - .001, duration).arrived, false);
    assert.deepEqual(captureTiming(arrival, duration), { arrived: true, opacity: 1, done: false });
    assert.deepEqual(captureTiming(duration, duration), { arrived: true, opacity: 1, done: false });
    assert.deepEqual(captureTiming(duration + CAPTURE_PAUSE, duration), { arrived: true, opacity: 1, done: false });
    const halfway = captureTiming(duration + CAPTURE_PAUSE + DEBRIS_FADE / 2, duration);
    assert.ok(Math.abs(halfway.opacity - .5) < 1e-10);
    assert.equal(halfway.arrived, true);
    assert.deepEqual(captureTiming(duration + CAPTURE_PAUSE + DEBRIS_FADE + .001, duration), { arrived: true, opacity: 0, done: true });
  }
});

test('debris uses local geometry and side color; cleanup preserves shared intact resources', async () => {
  const originalGeometry = new THREE.BoxGeometry(.5, .8, .5).translate(0, .4, 0);
  const originalMaterial = new THREE.ShaderMaterial({ uniforms: { localEye: { value: new THREE.Vector3() }, studio: { value: null } } });
  let originalDisposed = false;
  originalMaterial.addEventListener('dispose', () => { originalDisposed = true; });
  originalGeometry.addEventListener('dispose', () => { originalDisposed = true; });
  const model = new THREE.Group();
  model.add(new THREE.Mesh(originalGeometry, originalMaterial));
  model.rotation.y = Math.PI;
  const parent = new THREE.Group(); parent.position.set(3.5, .25, -3.5); parent.add(model); parent.updateMatrixWorld(true);
  const effect = await prepareCaptureEffect(model, { type: 'pawn', side: 'black' }, {
    renderer: { compileAsync: async () => {} }, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(), appearance: createAppearanceState(),
  });
  assert.equal(effect.group.rotation.y, Math.PI);
  assert.ok(new THREE.Box3().setFromObject(effect.group).max.x < .3);
  assert.deepEqual(effect.group.children[0].material.uniforms.gemFilter.value.toArray(), createAppearanceState().resolve('black').palette.filter);
  const arrival = effect.update(2.048889 + CAPTURE_PAUSE - 1, 2.048889);
  assert.deepEqual(arrival, { arrived: true, opacity: 1, done: false });
  const falling = effect.group.children.map(mesh => [...mesh.position.toArray(), ...mesh.quaternion.toArray()]);
  effect.update(2.048889, 2.048889);
  const settled = effect.group.children.map(mesh => [...mesh.position.toArray(), ...mesh.quaternion.toArray()]);
  assert.notDeepEqual(falling, settled, 'fragments continue moving after the capturing piece arrives');
  effect.update(2.048889 + CAPTURE_PAUSE + DEBRIS_FADE / 2, 2.048889);
  assert.deepEqual(effect.group.children.map(mesh => [...mesh.position.toArray(), ...mesh.quaternion.toArray()]), settled);
  assert.ok(Math.abs(effect.group.children[0].material.uniforms.captureOpacity.value - .5) < 1e-10);
  let disposed = 0;
  const count = effect.group.children.length;
  for (const mesh of effect.group.children) {
    mesh.geometry.addEventListener('dispose', () => disposed++);
    mesh.material.addEventListener('dispose', () => disposed++);
  }
  effect.dispose();
  assert.equal(disposed, count * 2);
  assert.equal(originalDisposed, false);
});
