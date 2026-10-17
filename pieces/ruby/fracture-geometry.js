import * as THREE from 'three';

const EPSILON = 1e-7;
const vertexKey = point => point.toArray().map(value => Math.round(value * 1e6)).join(',');

export function seededRandom(seed = 85173) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function facesFromGeometry(geometry) {
  const position = geometry.attributes.position, index = geometry.index;
  const faces = [];
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const face = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset));
    if (face[1].clone().sub(face[0]).cross(face[2].clone().sub(face[0])).lengthSq() > 1e-18) faces.push(face);
  }
  return faces;
}

function measure(faces) {
  let volume = 0;
  const center = new THREE.Vector3(), bounds = new THREE.Box3();
  for (const face of faces) {
    face.forEach(point => bounds.expandByPoint(point));
    for (let i = 1; i < face.length - 1; i++) {
      const [a, b, c] = [face[0], face[i], face[i + 1]];
      const tetra = a.dot(b.clone().cross(c)) / 6;
      volume += tetra;
      center.addScaledVector(a.clone().add(b).add(c), tetra / 4);
    }
  }
  return { faces, volume, center: center.divideScalar(volume), bounds };
}

// Clip the actual surface and stitch the cut boundary into closed caps. Keeping
// contour loops (rather than taking a convex hull) preserves the pawn's waist.
function splitFaces(faces, normal, offset) {
  const negative = [], positive = [], segments = [];
  for (const face of faces) {
    const distances = face.map(point => normal.dot(point) - offset);
    if (distances.every(value => value <= EPSILON)) { negative.push(face); continue; }
    if (distances.every(value => value >= -EPSILON)) { positive.push(face); continue; }
    const below = [], above = [], crossings = [];
    for (let i = 0; i < face.length; i++) {
      const point = face[i], next = face[(i + 1) % face.length];
      const distance = distances[i], nextDistance = distances[(i + 1) % face.length];
      if (distance <= EPSILON) below.push(point);
      if (distance >= -EPSILON) above.push(point);
      if (Math.abs(distance) < EPSILON) crossings.push(point);
      if ((distance < -EPSILON && nextDistance > EPSILON) || (distance > EPSILON && nextDistance < -EPSILON)) {
        const intersection = point.clone().lerp(next, distance / (distance - nextDistance));
        below.push(intersection); above.push(intersection); crossings.push(intersection);
      }
    }
    if (below.length >= 3) negative.push(below);
    if (above.length >= 3) positive.push(above);
    const unique = [...new Map(crossings.map(point => [vertexKey(point), point])).values()];
    if (unique.length === 2) segments.push(unique);
  }
  if (!segments.length) return null;
  const nodes = new Map();
  for (const [a, b] of segments) {
    const aKey = vertexKey(a), bKey = vertexKey(b);
    if (aKey === bKey) continue;
    for (const [key, point, neighbor] of [[aKey, a, bKey], [bKey, b, aKey]]) {
      if (!nodes.has(key)) nodes.set(key, { point, adjacent: new Set() });
      nodes.get(key).adjacent.add(neighbor);
    }
  }
  // Reject a numerically ambiguous cut; the caller tries another plane.
  if ([...nodes.values()].some(node => node.adjacent.size !== 2)) return null;
  const u = new THREE.Vector3(Math.abs(normal.y) < .9 ? 0 : 1, Math.abs(normal.y) < .9 ? 1 : 0, 0).cross(normal).normalize();
  const v = normal.clone().cross(u);
  const remaining = new Set(nodes.keys());
  while (remaining.size) {
    const start = remaining.values().next().value, loop = [];
    let current = start, previous = null;
    do {
      loop.push(nodes.get(current).point); remaining.delete(current);
      const next = [...nodes.get(current).adjacent].find(key => key !== previous);
      previous = current; current = next;
    } while (current !== start && remaining.has(current));
    if (current !== start || loop.length < 3) return null;
    const projected = loop.map(point => new THREE.Vector2(point.dot(u), point.dot(v)));
    for (const indices of THREE.ShapeUtils.triangulateShape(projected, [])) {
      const triangle = indices.map(index => loop[index]);
      const direction = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]));
      if (direction.lengthSq() < 1e-18) continue;
      if (direction.dot(normal) < 0) triangle.reverse();
      negative.push(triangle); positive.push([...triangle].reverse());
    }
  }
  return [measure(negative), measure(positive)];
}

function toShard(part) {
  const vertices = [], points = new Map();
  let largestArea = 0, restingNormal = new THREE.Vector3(0, -1, 0);
  for (const face of part.faces) {
    face.forEach(point => points.set(vertexKey(point), point.clone().sub(part.center)));
    for (let i = 1; i < face.length - 1; i++) {
      const triangle = [face[0], face[i], face[i + 1]];
      const normal = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]));
      if (normal.lengthSq() < 1e-18) continue;
      if (normal.length() > largestArea) { largestArea = normal.length(); restingNormal = normal.normalize(); }
      for (const point of triangle) vertices.push(...point.clone().sub(part.center).toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return { geometry, center: part.center, volume: part.volume, vertices: [...points.values()], restingNormal };
}

export function fractureGeometry(geometry, { count = 160, seed = 85173 } = {}) {
  const random = seededRandom(seed), parts = [measure(facesFromGeometry(geometry))];
  for (let iteration = 0; parts.length < count && iteration < count * 8; iteration++) {
    // A few larger chips survive among the fine splinters. Every shard is a
    // partition of the original solid; no replacement particle cloud is used.
    let selected = 0, largest = -Infinity;
    parts.forEach((part, index) => {
      const score = part.volume * (.35 + random());
      if (score > largest) { largest = score; selected = index; }
    });
    const part = parts[selected], size = part.bounds.getSize(new THREE.Vector3());
    const normal = new THREE.Vector3((random() - .5) * size.x, (random() - .5) * size.y, (random() - .5) * size.z).normalize();
    const offset = normal.dot(part.center) + (random() - .5) * Math.min(size.x, size.y, size.z) * .55;
    const split = splitFaces(part.faces, normal, offset);
    if (!split || split.some(piece => piece.volume < part.volume * .07)) continue;
    if (Math.abs(split[0].volume + split[1].volume - part.volume) > part.volume * .0001) continue;
    parts.splice(selected, 1, ...split);
  }
  return parts.map(toShard);
}
