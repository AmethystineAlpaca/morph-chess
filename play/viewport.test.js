import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { configureViewport } from './viewport.js';

test('viewport stays native on large displays and keeps HiDPI composer buffers in sync after resizing', () => {
  const keys = ['window', 'innerWidth', 'innerHeight', 'devicePixelRatio'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let resizeListener, invalidations = 0;
  const surface = () => ({
    domElement: { style: {} }, info: {},
    setPixelRatio(value) { this.ratio = value; },
    setSize(width, height) { this.width = width; this.height = height; },
  });
  const renderer = surface(), composer = surface();
  const camera = new THREE.PerspectiveCamera();
  try {
    globalThis.window = { addEventListener(event, listener) { assert.equal(event, 'resize'); resizeListener = listener; } };
    globalThis.innerWidth = 2246; globalThis.innerHeight = 1136; globalThis.devicePixelRatio = 1;
    const resize = configureViewport({ renderer, composer, camera, interactive: true, invalidate() { invalidations++; } });
    assert.equal(resizeListener, resize);
    for (const [width, height, dpr] of [[2246,1136,1], [3840,2160,1], [1280,800,2], [2560,1440,2], [390,844,3], [844,390,3]]) {
      globalThis.innerWidth = width; globalThis.innerHeight = height; globalThis.devicePixelRatio = dpr;
      resizeListener();
      assert.ok(renderer.ratio >= 1, 'never upscale a low-resolution buffer');
      assert.ok(renderer.ratio <= Math.min(dpr, 2), 'cap supersampling on high-density screens');
      assert.ok(width * height * renderer.ratio ** 2 <= Math.max(8000000, width * height) + 1, 'bound supersampling cost');
      if (width === 1280) assert.equal(renderer.ratio, 2, 'retain Retina detail when it fits the budget');
      assert.deepEqual([composer.width, composer.height, composer.ratio], [width, height, renderer.ratio]);
      assert.equal(camera.aspect, width / height);
      assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
      assert.equal(renderer.domElement.style.width, width + 'px');
    }
    assert.equal(invalidations, 7);
    const projection = camera.projectionMatrix.clone();
    resize.setQuality('performance');
    assert.equal(resize.getQuality(), 'performance');
    assert.equal(renderer.ratio, 1);
    assert.equal(composer.ratio, 1);
    assert.deepEqual(camera.projectionMatrix, projection, 'quality preserves framing');
    globalThis.innerWidth = 390; globalThis.innerHeight = 844;
    resizeListener();
    assert.equal(renderer.ratio, 1, 'performance choice survives resizing');
    resize.setQuality('unknown');
    assert.equal(resize.getQuality(), 'performance');
    resize.setQuality('high');
    assert.equal(renderer.ratio, 2);
    assert.equal(composer.ratio, 2);
  } finally {
    keys.forEach((key, index) => { if (previous[index]) Object.defineProperty(globalThis, key, previous[index]); else delete globalThis[key]; });
  }
});
