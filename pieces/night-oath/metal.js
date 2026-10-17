import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const materials = new WeakMap();

function goldStudio(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#585c65');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, '#111111'); gradient.addColorStop(.035, '#dddddd');
  gradient.addColorStop(.10, '#ffffff'); gradient.addColorStop(.84, '#ffffff');
  gradient.addColorStop(.97, '#aaaaaa'); gradient.addColorStop(1, '#111111');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const panel = (width, height, position, intensity, color = '#ffffff', map = texture) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), map, side: THREE.DoubleSide,
    }));
    mesh.position.set(...position); mesh.lookAt(0, 0, 0); scene.add(mesh);
  };
  // Reflection cards wrap the object, with deliberate dark gaps between them.
  // Every side sees a broad silver-white source and a narrow high-value strip;
  // the gaps provide the contrast that separates polished metal from gold paint.
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + .28;
    panel(i % 2 ? 1.7 : 2.4, 6, [4 * Math.cos(angle), .65, 4 * Math.sin(angle)], i % 2 ? 3.0 : 4.2,
      i % 3 ? '#fff9eb' : '#e8efff');
    const strip = angle + .32;
    panel(.14, 6, [3.9 * Math.cos(strip), 1.3, 3.9 * Math.sin(strip)], 6, '#fffdf4', null);
  }
  panel(3.5, 5, [-.7, 4.5, 1], 3.8, '#fff8ec');
  panel(7, 5, [0, -4, 0], .65, '#aeb8c9');
  const cube = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 20, cube).update(renderer, scene);
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  texture.dispose();
  return cube.texture;
}

// Only isolated previews need these lights. Board scenes already provide
// their own lighting; the Ruby shader does not consume Three.js scene lights.
export function lightMetalPreview(scene) {
  scene.add(new THREE.HemisphereLight('#e4e9f2', '#30251f', .65));
  for (const [color, intensity, position] of [
    ['#fff0d6', 3.2, [-3, 5, 5]], ['#d4e0ff', 2.5, [4, 3, -4]], ['#fff6e7', 1.1, [3, 1, 5]],
  ]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
  }
}

// The jewelry reflections belong to the set, so the gold also works in the
// isolated viewer. No changes to the board's approved lights or environment.
export function oathMetals(renderer) {
  if (materials.has(renderer)) return materials.get(renderer);
  const environment = goldStudio(renderer);
  const make = (name, color, roughness, intensity) => {
    const material = new THREE.MeshStandardMaterial({
      name, color, metalness: 1, roughness, envMap: environment, envMapIntensity: intensity,
      // Like the ruby, render after the board's transmission capture.
      transparent: true, blending: THREE.NoBlending, depthWrite: true,
    });
    return material;
  };
  const result = {
    satin: make('Night Oath / polished champagne gold', '#d4c3a3', .075, 1.0),
    edge: make('Night Oath / mirror champagne bevel', '#f0e5cd', .045, 1.1),
    recess: make('Night Oath / smoked champagne recess', '#766b58', .19, .85),
    base: make('Night Oath / polished champagne plinth', '#b09e7d', .105, .85),
    baseEdge: make('Night Oath / polished plinth bevel', '#ded0b1', .060, 1.0),
  };
  // One standard PBR draw per chessman, with the same five physical finishes
  // carried by vertex attributes. This avoids five extra draws per piece in
  // both the main view and the board reflection.
  const draw = result.satin.clone();
  draw.name = 'Night Oath / gold fittings'; draw.color.set('#ffffff');
  draw.envMapIntensity = 1; draw.vertexColors = true;
  draw.onBeforeCompile = shader => {
    const varyings = 'varying float vGoldRoughness; varying float vGoldIntensity;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      `#include <common>\nattribute float goldRoughness; attribute float goldIntensity; ${varyings}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGoldRoughness = goldRoughness; vGoldIntensity = goldIntensity;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vGoldRoughness;')
      .replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('envMapIntensity', '(envMapIntensity * vGoldIntensity)'));
  };
  draw.customProgramCacheKey = () => 'night-oath-gold-finishes-v1';
  result.draw = draw;
  materials.set(renderer, result);
  return result;
}

export function lathe(points) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 48);
}

export function softenGold(geometry) {
  const softened = toCreasedNormals(geometry, Math.PI * .30);
  if (softened !== geometry) geometry.dispose();
  return softened;
}

// Batch all finishes into a single draw call. The model remains in Ruby's local
// coordinates, including its type-specific rotation and sculpted silhouette.
export function metalwork(group, finishes) {
  const parts = new Map(Object.keys(finishes).filter(key => key !== 'draw').map(key => [key, []]));
  const add = (geometry, finish = 'satin') => {
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const key of Object.keys(copy.attributes)) if (!['position', 'normal'].includes(key)) copy.deleteAttribute(key);
    if (!copy.attributes.normal) copy.computeVertexNormals();
    parts.get(finish).push(copy);
    geometry.dispose();
  };
  return {
    add,
    turned(points, finishesBySegment = []) {
      for (let i = 0; i < points.length - 1; i++) add(lathe(points.slice(i, i + 2)), finishesBySegment[i] || 'satin');
    },
    finish() {
      const combined = [];
      for (const [key, geometries] of parts) {
        const material = finishes[key];
        for (const geometry of geometries) {
          const count = geometry.attributes.position.count;
          const colors = new Float32Array(count * 3), roughness = new Float32Array(count), intensity = new Float32Array(count);
          for (let i = 0; i < count; i++) material.color.toArray(colors, i * 3);
          roughness.fill(material.roughness); intensity.fill(material.envMapIntensity);
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.setAttribute('goldRoughness', new THREE.BufferAttribute(roughness, 1));
          geometry.setAttribute('goldIntensity', new THREE.BufferAttribute(intensity, 1));
          combined.push(geometry);
        }
      }
      const geometry = mergeGeometries(combined);
      combined.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, finishes.draw);
      mesh.name = 'Night Oath · solid gold fittings'; mesh.renderOrder = 2;
      mesh.userData.nightOathMetal = true; group.add(mesh);
    },
  };
}

// Coat a selected height of the actual current model. Clipping rather than
// stretching a decorative primitive preserves every existing crown notch.
export function coatSurface(source, low, high = Infinity, thickness = .003) {
  const original = source.index ? source.toNonIndexed() : source;
  const pos = original.attributes.position, normals = original.attributes.normal, vertices = [], vertexNormals = [];
  const key = p => p.toArray().map(v => Math.round(v * 1e6)).join(',');
  const offsets = new Map(), boundary = new Map();
  // Adjacent facets must meet at one displaced corner. Offsetting each face
  // separately leaves hairline cracks that glitter like torn foil.
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i), id = key(p);
    if (!offsets.has(id)) offsets.set(id, new THREE.Vector3());
    offsets.get(id).add(new THREE.Vector3().fromBufferAttribute(normals, i));
  }
  offsets.forEach(n => n.normalize());
  const clip = (polygon, y, above) => {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const inside = above ? a.p.y >= y : a.p.y <= y;
      const nextInside = above ? b.p.y >= y : b.p.y <= y;
      if (inside) result.push(a);
      if (inside !== nextInside) {
        const t = (y - a.p.y) / (b.p.y - a.p.y);
        result.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), o: a.o.clone().lerp(b.o, t).normalize() });
      }
    }
    return result;
  };
  for (let i = 0; i < pos.count; i += 3) {
    let polygon = [0, 1, 2].map(j => {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i + j);
      return { p, n: new THREE.Vector3().fromBufferAttribute(normals, i + j), o: offsets.get(key(p)) };
    });
    polygon = clip(polygon, low, true);
    if (Number.isFinite(high)) polygon = clip(polygon, high, false);
    for (let j = 1; j < polygon.length - 1; j++) {
      const triangle = [polygon[0], polygon[j], polygon[j + 1]];
      if (new THREE.Triangle(...triangle.map(v => v.p)).getArea() < 1e-12) continue;
      for (const v of triangle) {
        vertices.push(...v.p.clone().addScaledVector(v.o, thickness).toArray());
        vertexNormals.push(...v.n.toArray());
      }
      for (let edge = 0; edge < 3; edge++) {
        const a = triangle[edge], b = triangle[(edge + 1) % 3];
        const id = [key(a.p), key(b.p)].sort().join('/');
        if (boundary.has(id)) boundary.get(id).count++;
        else boundary.set(id, { a, b, count: 1 });
      }
    }
  }
  // Close the rim down into the gemstone; the fitting has a real edge.
  for (const { a, b, count } of boundary.values()) {
    if (count !== 1) continue;
    const outerA = a.p.clone().addScaledVector(a.o, thickness), outerB = b.p.clone().addScaledVector(b.o, thickness);
    for (const triangle of [[a.p, b.p, outerB], [a.p, outerB, outerA]]) {
      const n = new THREE.Triangle(...triangle).getNormal(new THREE.Vector3());
      for (const p of triangle) { vertices.push(...p.toArray()); vertexNormals.push(...n.toArray()); }
    }
  }
  if (original !== source) original.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertexNormals, 3));
  return source.type === 'LatheGeometry' ? geometry : softenGold(geometry);
}

// A closed, folded leaf has a raised centre and bevelled sides. Each row is
// [radius, height, half width, half thickness]; it is seated in the ruby below.
export function foldedLeaf(rows, angle, transform = p => p) {
  const rings = rows.map(([r, y, w, d]) => [
    [r, y, -w], [r + d, y, -w * .72], [r + d * 1.6, y, 0],
    [r + d, y, w * .72], [r, y, w], [r - d, y, 0],
  ].map(([x, height, z]) => transform(new THREE.Vector3(x * Math.cos(angle) - z * Math.sin(angle), height, x * Math.sin(angle) + z * Math.cos(angle)))));
  return closedLoft(rings);
}

export function closedLoft(rings) {
  const positions = [];
  const tri = (a, b, c) => positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  const n = rings[0].length;
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(rings[row][i], rings[row + 1][i], rings[row + 1][j]);
    tri(rings[row][i], rings[row + 1][j], rings[row][j]);
  }
  for (const [ring, end] of [[rings[0], false], [rings.at(-1), true]]) {
    const center = ring.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
    for (let i = 0; i < n; i++) end ? tri(center, ring[(i + 1) % n], ring[i]) : tri(center, ring[i], ring[(i + 1) % n]);
  }
  // Accommodate rings written either clockwise or counterclockwise.
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const a = new THREE.Vector3().fromArray(positions, i), b = new THREE.Vector3().fromArray(positions, i + 3), c = new THREE.Vector3().fromArray(positions, i + 6);
    volume += a.dot(b.cross(c));
  }
  if (volume < 0) for (let i = 0; i < positions.length; i += 9) for (let k = 0; k < 3; k++) [positions[i + 3 + k], positions[i + 6 + k]] = [positions[i + 6 + k], positions[i + 3 + k]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return softenGold(geometry);
}
