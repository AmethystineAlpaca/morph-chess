import * as THREE from 'three';
import { BAKED_VEINS } from './baked-veins.js';

export const VEIN_TILE = 24;
export const VEIN_PADDING = 3;
const textures = new Map();

export function veinAtlasLayout(geometry) {
  const faces = (geometry.index?.count || geometry.attributes.position.count) / 3;
  const columns = Math.ceil(Math.sqrt(faces));
  const width = THREE.MathUtils.ceilPowerOfTwo(columns * VEIN_TILE);
  const height = THREE.MathUtils.ceilPowerOfTwo(Math.ceil(faces / columns) * VEIN_TILE);
  return { faces, columns, width, height };
}

export function veinAtlasKey(geometry, veins) {
  let hash = 2166136261;
  const add = value => { hash = Math.imul(hash ^ Math.round(value * 1e6), 16777619) >>> 0; };
  for (const value of geometry.attributes.position.array) add(value);
  for (const value of geometry.index?.array || []) add(value);
  for (const segment of veins.segments) for (const value of segment.flat()) add(value);
  add(veins.width);
  return hash.toString(16);
}

// Sparse byte runs keep the baked, single-channel masks compact in the model
// bundle. Decoding is synchronous and done once per shared texture, not per frame.
export function decodeVeinAtlas(encoded, length) {
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  const pixels = new Uint8Array(length);
  let input = 0, output = 0;
  while (input < bytes.length) {
    const skip = bytes[input++] | bytes[input++] << 8;
    const count = bytes[input++] | bytes[input++] << 8;
    output += skip;
    if (input + count > bytes.length || output + count > length) throw new Error('Invalid baked vein atlas');
    pixels.set(bytes.subarray(input, input + count), output);
    input += count; output += count;
  }
  return pixels;
}

export function applyVeinAtlas(mesh) {
  const veins = mesh.material.userData.veins;
  if (!veins?.segments.length) return;
  const geometry = mesh.geometry;
  if (geometry.index) throw new Error('Vein atlas needs independent triangle UVs');
  const key = veinAtlasKey(geometry, veins);
  const asset = BAKED_VEINS[key];
  if (!asset) throw new Error(`Missing baked head texture ${mesh.name}; run npm run bake:veins`);
  const { faces, columns, width, height } = veinAtlasLayout(geometry);
  const uv = new Float32Array(faces * 6);
  const span = VEIN_TILE - VEIN_PADDING * 2 - 1;
  for (let face = 0; face < faces; face++) {
    const x = (face % columns) * VEIN_TILE + VEIN_PADDING + .5;
    const y = Math.floor(face / columns) * VEIN_TILE + VEIN_PADDING + .5;
    uv.set([x / width, y / height, (x + span) / width, y / height, x / width, (y + span) / height], face * 6);
  }
  geometry.setAttribute('veinUv', new THREE.BufferAttribute(uv, 2));
  if (!textures.has(key)) {
    const texture = new THREE.DataTexture(decodeVeinAtlas(asset, width * height), width, height, THREE.RedFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    textures.set(key, texture);
  }
  mesh.material.uniforms.veinMap.value = textures.get(key);
  mesh.material.uniforms.hasVeins.value = 1;
}
