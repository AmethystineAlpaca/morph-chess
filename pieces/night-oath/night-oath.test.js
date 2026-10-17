import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rubySet } from '../ruby/index.js';
import { nightOathSet } from './index.js';
import { coatSurface } from './metal.js';
import { tablePieceFactory } from '../../play/piece-cache.js';
import { createAppearanceState } from '../../play/appearance.js';

function studioStub(run) {
  const previous = globalThis.document;
  const gradient = () => ({ addColorStop() {} });
  globalThis.document = { createElement() { return { getContext() { return { createRadialGradient: gradient, createLinearGradient: gradient, fillRect() {} }; } }; } };
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false }, getRenderTarget() { return null; },
    getActiveCubeFace() { return 0; }, getActiveMipmapLevel() { return 0; }, setRenderTarget() {}, render() {} };
  try { run(renderer); } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}

test('new set retains current Ruby shapes and leaves independent Ruby instances untouched', () => studioStub(renderer => {
  for (const type of rubySet.availablePieces) {
    const before = rubySet.create(type, renderer);
    const originalPositions = before.children.map(mesh => [...mesh.geometry.attributes.position.array]);
    const originalMaterials = before.children.map(mesh => mesh.material);
    const model = nightOathSet.create(type, renderer);
    assert.notEqual(model, before);
    assert.deepEqual(model.quaternion.toArray(), before.quaternion.toArray());
    assert.deepEqual(before.children.map(mesh => [...mesh.geometry.attributes.position.array]), originalPositions);
    assert.deepEqual(before.children.map(mesh => mesh.material), originalMaterials);
    for (const mesh of model.children.filter(mesh => mesh.material.uniforms && !mesh.name.includes('inset'))) {
      assert.ok(before.children.some(original => original.name === mesh.name &&
        original.geometry.attributes.position.array.length === mesh.geometry.attributes.position.array.length &&
        original.geometry.attributes.position.array.every((v, i) => v === mesh.geometry.attributes.position.array[i])), type + ': ruby geometry preserved');
      assert.ok(!before.children.some(original => original.material === mesh.material), type + ': independent optics');
    }
    assert.ok(before.children.every(mesh => !mesh.userData.nightOathMetal));
  }
}));

test('all six metal sets fit a square, keep correct heights and stay within a board geometry budget', () => studioStub(renderer => {
  let total = 0;
  for (const type of rubySet.availablePieces) {
    const model = nightOathSet.create(type, renderer);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true), size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.max(size.x, size.z) < .80, `${type}: square clearance`);
    assert.ok(Math.abs(size.y - rubySet.dimensions[type].height) < .008, `${type}: unchanged height`);
    const metal = model.children.filter(mesh => mesh.userData.nightOathMetal);
    assert.equal(metal.length, 1, `${type}: one batched metal draw`);
    for (const mesh of model.children) {
      const { position, normal } = mesh.geometry.attributes;
      assert.ok([...position.array, ...normal.array].every(Number.isFinite), type + ': valid geometry');
      total += (mesh.geometry.index?.count || position.count) / 3 * ({ pawn: 16, rook: 4, knight: 4, bishop: 4, queen: 2, king: 2 }[type]);
    }
    for (const mesh of metal) {
      assert.equal(mesh.material.metalness, 1);
      assert.equal(mesh.material.emissive.getHex(), 0, 'brightness comes from reflection');
      assert.ok(mesh.material.envMap?.isCubeTexture);
      assert.equal(mesh.material.blending, THREE.NoBlending);
      assert.ok(mesh.material.roughness > .035 && mesh.material.roughness < .35);
      const attributes = mesh.geometry.attributes;
      assert.ok([...attributes.goldRoughness.array].every(value => value > .035 && value < .35));
      assert.equal(new Set(attributes.goldRoughness.array).size, 5, 'preserves polished surfaces and recessed finish');
    }
  }
  assert.ok(total < 150000, `board triangles: ${total}`);
}));

test('coating preserves the smooth normals of the original turned metal shoulders', () => {
  const geometry = new THREE.LatheGeometry([new THREE.Vector2(.3, 0), new THREE.Vector2(.25, .1), new THREE.Vector2(.2, .2)], 32);
  const coat = coatSurface(geometry, .035, .17);
  const normals = coat.attributes.normal;
  // Adjacent vertices on one conical triangle have different radial normals.
  // Flattening these would produce a distracting faceted foil reflection.
  assert.notDeepEqual(Array.from(normals.array.slice(0, 3)), Array.from(normals.array.slice(6, 9)));
  for (let i = 0; i < normals.count; i++) assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normals, i).length() - 1) < .00001);
});

test('both knight eyes have solid metal across the opening, seated just above the carved ruby', () => studioStub(renderer => {
  const model = nightOathSet.create('knight', renderer);
  model.rotation.set(0, 0, 0); model.updateMatrixWorld(true);
  const metal = model.children.find(mesh => mesh.userData.nightOathMetal);
  const cheek = model.getObjectByName('Broad ruby planes with carved eyelid, nostril and lip seam');
  for (const side of [-1, 1]) for (const offset of [-.025, 0, .025]) {
    const x = -.045 + offset * Math.cos(.25), y = .959 + offset * Math.sin(.25);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, side), new THREE.Vector3(0, 0, -side));
    const gold = ray.intersectObject(metal)[0], ruby = ray.intersectObject(cheek)[0];
    assert.ok(gold && ruby, 'the eye centre and both ends are filled on each cheek');
    const clearance = ruby.distance - gold.distance;
    assert.ok(clearance > .002 && clearance < .025, 'the insert covers the recess without floating above the face');
  }
}));

test('both sides share metal resources while Ruby color, glow and camera uniforms remain per piece', () => studioStub(renderer => {
  const appearance = createAppearanceState();
  const factory = tablePieceFactory(nightOathSet, renderer, appearance);
  const white = factory('king', 'white', 'w-king'), black = factory('king', 'black', 'b-king');
  black.position.x = 3;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 4, 6); camera.updateMatrixWorld(true);
  for (const [model, sideTone] of [[white, 0], [black, 1]]) {
    model.updateMatrixWorld(true);
    for (const mesh of model.children) {
      assert.doesNotThrow(() => mesh.onBeforeRender(null, null, camera));
      if (mesh.material.uniforms) assert.equal(mesh.material.uniforms.sideTone.value, sideTone);
    }
  }
  const a = white.children.find(mesh => mesh.userData.nightOathMetal), b = black.children.find(mesh => mesh.userData.nightOathMetal);
  assert.equal(a.geometry, b.geometry); assert.equal(a.material, b.material);
}));
