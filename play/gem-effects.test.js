import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGemEffects, GEM_EFFECTS } from './gem-effects.js';
import { gemstoneMaterial } from '../pieces/ruby/material.js';
import { cutRubyMaterial } from '../pieces/ruby/cut-ruby.js';

test('lighting changes uniforms in place, caches environments and restores each original material exactly', () => {
  assert.deepEqual(GEM_EFFECTS.map(preset => preset.name), ['Original', 'Brilliance']);
  let renders = 0, invalidations = 0;
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget() { return null; }, getActiveCubeFace() { return 0; }, getActiveMipmapLevel() { return 0; }, setRenderTarget() {}, render() { renders++; } };
  const controller = createGemEffects({ renderer, invalidate() { invalidations++; } });
  const geometry = new THREE.IcosahedronGeometry(.25, 0), group = new THREE.Group();
  const original = [new THREE.CubeTexture(), new THREE.CubeTexture()];
  const materials = [gemstoneMaterial(geometry, original[0]), cutRubyMaterial(geometry, original[1])];
  for (const material of materials) group.add(new THREE.Mesh(geometry, material));
  controller.apply(group);
  const shaders = materials.map(material => material.fragmentShader), children = [...group.children];
  const densities = materials.map(material => material.uniforms.opticalDensity.value);
  for (const id of ['prismatic', 'original', 'prismatic', 'original']) {
    controller.set(id);
    assert.deepEqual(group.children, children, 'switching preserves mesh instances');
    materials.forEach((material, index) => {
      assert.equal(group.children[index].material, material);
      assert.equal(material.fragmentShader, shaders[index], 'switching does not rebuild shader programs');
      assert.equal(material.uniforms.opticalDensity.value, densities[index], 'no cumulative optical-density changes');
      assert.equal(material.uniforms.gemEffectActive.value, id === 'original' ? 0 : 1);
      if (id === 'original') assert.equal(material.uniforms.studio.value, original[index]);
    });
  }
  assert.equal(renders, 6, 'the Brilliance studio environment is captured only once');
  assert.equal(invalidations, 4);
  controller.set('original'); controller.set('invalid'); controller.set('royal'); controller.set('luminous');
  assert.equal(invalidations, 4);
  controller.set('prismatic');
  const added = gemstoneMaterial(geometry, original[0]); controller.register(added);
  assert.equal(added.uniforms.studio.value, materials[0].uniforms.studio.value, 'new/promoted pieces inherit current lighting');
  controller.set('original');
  assert.equal(added.uniforms.studio.value, original[0]);
  materials.forEach(material => material.dispose()); added.dispose(); geometry.dispose();
});
