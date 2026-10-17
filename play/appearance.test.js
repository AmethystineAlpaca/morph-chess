import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GEM_PALETTES, createAppearanceState } from './appearance.js';
import { tablePieceFactory } from './piece-cache.js';
import { gemstoneMaterial } from '../pieces/ruby/material.js';
import { cutRubyMaterial } from '../pieces/ruby/cut-ruby.js';

test('every table starts with red near-side and blue far-side gems', () => {
  for (const state of [createAppearanceState(), createAppearanceState()]) {
    assert.equal(state.resolve('white', 'white-pawn-0').palette, GEM_PALETTES[0]);
    assert.equal(state.resolve('black', 'black-pawn-0').palette, GEM_PALETTES[1]);
    assert.equal(state.resolve('white', 'white-king-4').palette, GEM_PALETTES[0]);
  }
});

test('shared GPU material restores gem and fixed vein colors for main and reflection draws', () => {
  const geometry = new THREE.IcosahedronGeometry(.3);
  const material = gemstoneMaterial(geometry, null);
  const state = createAppearanceState();
  const factory = tablePieceFactory({ create() {
    const group = new THREE.Group(); group.add(new THREE.Mesh(geometry, material)); return group;
  } }, {}, state);
  const a = factory('pawn', 'white', 'white-pawn-0').children[0];
  const b = factory('pawn', 'black', 'black-pawn-0').children[0];
  const c = factory('pawn', 'white', 'white-pawn-1').children[0];
  assert.equal(a.material, b.material);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 3); camera.updateMatrixWorld();
  for (const reflected of [false, true, false]) {
    camera.userData.rubyReflection = reflected;
    for (const [mesh, palette] of [[a, 0], [b, 1], [c, 0], [a, 0]]) {
      mesh.onBeforeRender(null, null, camera);
      assert.deepEqual(material.uniforms.gemFilter.value.toArray(), GEM_PALETTES[palette].filter);
      assert.deepEqual(material.uniforms.veinTint.value.toArray(), GEM_PALETTES[palette].light);
      assert.equal(material.uniforms.bounceLimit.value, reflected ? 1 : 4);
    }
  }
  geometry.dispose(); material.dispose();
});

test('colored carved heads retain increased optical depth without inheriting red channel bias', () => {
  const geometry = new THREE.IcosahedronGeometry(.3);
  const material = cutRubyMaterial(geometry, null);
  const state = createAppearanceState();
  const factory = tablePieceFactory({ create: () => new THREE.Mesh(geometry, material) }, {}, state);
  const mesh = factory('pawn', 'white', 'white-pawn-0');
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0,2,3); camera.updateMatrixWorld();
  mesh.onBeforeRender(null,null,camera);
  assert.deepEqual(material.uniforms.gemFilter.value.toArray(),[1,1,1], 'original ruby is unchanged');
  const blue = factory('pawn', 'black', 'black-pawn-0');
  for (const color of [1]) {
    blue.onBeforeRender(null,null,camera);
    const filter=material.uniforms.gemFilter.value.toArray();
    filter.forEach((value,channel) => assert.ok(Math.abs(value*material.userData.opticalAbsorption[channel]-GEM_PALETTES[color].absorption[channel]*2)<1e-10));
  }
  geometry.dispose(); material.dispose();
});

