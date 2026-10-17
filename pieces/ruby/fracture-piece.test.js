import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rubySet } from './index.js';
import { nightOathSet } from '../night-oath/index.js';
import { fracturePiece, FRACTURE_PIECES, solidVolume } from './fracture-piece.js';
import { fractureGeometry } from './fracture-geometry.js';
import { orientFractureSurface } from './fracture-surface.js';
import { bakeFractureMotion, sampleFracture, FRACTURE_TIME, DURATION } from './fracture-motion.js';

function withStudio(run) {
  const original = globalThis.document;
  const gradient = () => ({ addColorStop() {} });
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: gradient, createLinearGradient: gradient, fillRect() {} }) }) };
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false }, getRenderTarget() { return null; }, getActiveCubeFace() { return 0; }, getActiveMipmapLevel() { return 0; }, setRenderTarget() {}, render() {} };
  try { run(renderer); }
  finally { if (original === undefined) delete globalThis.document; else globalThis.document = original; }
}

test('all six pieces in both collections fracture without changing the intact assets or losing their metal', () => withStudio(renderer => {
  const object = new THREE.Object3D(), point = new THREE.Vector3();
  for (const set of [rubySet, nightOathSet]) for (const { type } of FRACTURE_PIECES) {
    const model = set.create(type, renderer); model.updateMatrixWorld(true);
    const originals = [], bounds = new THREE.Box3().setFromObject(model, true);
    let expectedVolume = 0;
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      originals.push({ mesh, vertices: mesh.geometry.attributes.position.array.slice() });
      if (!mesh.material.uniforms?.localEye) return;
      let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (mesh.name.startsWith('Crown arch')) { const repaired = orientFractureSurface(geometry); geometry.dispose(); geometry = repaired; }
      expectedVolume += solidVolume(geometry); geometry.dispose();
    });
    const shards = fracturePiece(model, type), label = `${set.id}/${type}`;
    assert.ok(shards.length >= 190 && shards.length < 650, label + ' bounded fragment budget');
    assert.equal(shards.some(shard => shard.metal), set.id === 'night-oath', label + ' preserves metal');
    const glassVolume = shards.filter(shard => !shard.metal).reduce((sum, shard) => sum + solidVolume(shard.geometry), 0);
    assert.ok(Math.abs(glassVolume / expectedVolume - 1) < 1e-5, label + ' conserves gem volume');
    for (const { mesh, vertices } of originals) assert.deepEqual(mesh.geometry.attributes.position.array, vertices);
    for (const shard of shards) {
      const position = shard.geometry.attributes.position, area = new THREE.Vector3();
      assert.ok(Array.from(position.array).every(Number.isFinite), label);
      for (const vertex of shard.vertices) assert.ok(bounds.clone().expandByScalar(1e-5).containsPoint(point.copy(vertex).add(shard.center)), label + ' follows the actual model');
      if (shard.metal) {
        for (const attribute of ['color', 'goldRoughness', 'goldIntensity']) assert.equal(shard.geometry.attributes[attribute].count, position.count, label + ' retains gold finish');
      } else {
        for (let i = 0; i < position.count; i += 3) {
          const [a, b, c] = [i, i + 1, i + 2].map(index => new THREE.Vector3().fromBufferAttribute(position, index));
          area.add(b.sub(a).cross(c.sub(a)));
        }
        assert.ok(area.length() < 1e-7, label + ' closed, correctly oriented cuts');
      }
      for (const time of [FRACTURE_TIME, .91, 1.22, 1.6, DURATION]) {
        sampleFracture(shard, time, object);
        for (const vertex of shard.vertices) assert.ok(point.copy(vertex).applyQuaternion(object.quaternion).add(object.position).y >= .0019, label + ' no floor penetration');
      }
      const settled = object.position.clone();
      sampleFracture(shard, DURATION - .5, object);
      assert.ok(settled.distanceTo(object.position) < 1e-6, label + ' settles');
      shard.geometry.dispose();
    }
  }
}));

test('the approved pawn retains exactly the same 196 cuts and baked trajectories', () => withStudio(renderer => {
  const model = rubySet.create('pawn', renderer); model.updateMatrixWorld(true);
  const expected = [];
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const source = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), head = mesh.name === 'Small faceted pawn head';
    expected.push(...fractureGeometry(source, { count: head ? 36 : 160, seed: head ? 918 : 85173 })); source.dispose();
  });
  bakeFractureMotion(expected);
  const actual = fracturePiece(model, 'pawn');
  assert.equal(actual.length, 196);
  actual.forEach((shard, index) => {
    assert.deepEqual(shard.geometry.attributes.position.array, expected[index].geometry.attributes.position.array);
    assert.deepEqual(shard.frames, expected[index].frames);
    shard.geometry.dispose(); expected[index].geometry.dispose();
  });
}));
