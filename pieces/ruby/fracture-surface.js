import * as THREE from 'three';

const key = point => point.toArray().map(value => Math.round(value * 1e6)).join(',');

// Some original crown tubes have reversed end caps. Repair a copy used only
// for fracture volume calculations; the approved intact model stays untouched.
export function orientFractureSurface(source) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const positions = geometry.attributes.position;
  const faces = [], edges = new Map();
  for (let i = 0; i < positions.count; i += 3) {
    const face = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, i + j));
    if (new THREE.Triangle(...face).getArea() < 1e-12) continue;
    const index = faces.length; faces.push(face);
    for (let j = 0; j < 3; j++) {
      const a = key(face[j]), b = key(face[(j + 1) % 3]), edge = [a, b].sort().join('|');
      if (!edges.has(edge)) edges.set(edge, []);
      edges.get(edge).push({ index, direction: a < b });
    }
  }
  const adjacency = faces.map(() => []), flips = new Map();
  for (const owners of edges.values()) if (owners.length === 2) {
    const [a, b] = owners;
    adjacency[a.index].push({ index: b.index, opposite: a.direction === b.direction });
    adjacency[b.index].push({ index: a.index, opposite: a.direction === b.direction });
  }
  for (let root = 0; root < faces.length; root++) {
    if (flips.has(root)) continue;
    const queue = [root]; flips.set(root, false);
    for (let at = 0; at < queue.length; at++) for (const neighbor of adjacency[queue[at]]) {
      if (flips.has(neighbor.index)) continue;
      flips.set(neighbor.index, flips.get(queue[at]) !== neighbor.opposite); queue.push(neighbor.index);
    }
    let volume = 0;
    for (const index of queue) {
      if (flips.get(index)) faces[index].reverse();
      const [a, b, c] = faces[index]; volume += a.dot(b.clone().cross(c));
    }
    if (volume < 0) queue.forEach(index => faces[index].reverse());
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(face => face.flatMap(point => point.toArray())), 3));
  result.computeVertexNormals(); geometry.dispose();
  return result;
}

// Gold fittings include open coatings, so split their actual surface into
// patches and retain the per-vertex champagne finishes, rather than treating
// them as watertight glass or letting the metal disappear during a break.
export function fractureMetalSurface(source, material, cellSize = .115) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const attributes = Object.entries(geometry.attributes);
  const positionIndex = attributes.findIndex(([name]) => name === 'position');
  const buckets = new Map();
  const position = vertex => new THREE.Vector3().fromArray(vertex[positionIndex]);
  function split(triangle, depth = 0) {
    const points = triangle.map(position);
    const lengths = points.map((point, i) => point.distanceToSquared(points[(i + 1) % 3]));
    const longest = lengths.indexOf(Math.max(...lengths));
    if (depth < 8 && lengths[longest] > cellSize * cellSize * 1.8) {
      const next = (longest + 1) % 3, last = (longest + 2) % 3;
      const middle = triangle[longest].map((values, attribute) => values.map((value, channel) => (value + triangle[next][attribute][channel]) / 2));
      split([triangle[longest], middle, triangle[last]], depth + 1);
      split([middle, triangle[next], triangle[last]], depth + 1); return;
    }
    const center = points[0].clone().add(points[1]).add(points[2]).divideScalar(3);
    const cell = center.toArray().map(value => Math.floor(value / cellSize)).join(',');
    if (!buckets.has(cell)) buckets.set(cell, []);
    buckets.get(cell).push(triangle);
  }
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    const triangle = [0, 1, 2].map(j => attributes.map(([, attribute]) => Array.from(attribute.array.slice((i + j) * attribute.itemSize, (i + j + 1) * attribute.itemSize))));
    if (new THREE.Triangle(...triangle.map(position)).getArea() > 1e-12) split(triangle);
  }
  const shards = [];
  for (const triangles of buckets.values()) {
    const center = new THREE.Vector3(), vertices = new Map(), restingNormal = new THREE.Vector3();
    let area = 0, largest = 0;
    for (const triangle of triangles) {
      const points = triangle.map(position), face = new THREE.Triangle(...points), size = face.getArea();
      center.addScaledVector(face.getMidpoint(new THREE.Vector3()), size); area += size;
      if (size > largest) { largest = size; face.getNormal(restingNormal); }
    }
    center.divideScalar(area);
    const fragment = new THREE.BufferGeometry();
    attributes.forEach(([name, attribute], index) => {
      const values = [];
      for (const triangle of triangles) for (const vertex of triangle) {
        if (name === 'position') {
          const point = position(vertex).sub(center); values.push(...point.toArray()); vertices.set(key(point), point);
        } else values.push(...vertex[index]);
      }
      fragment.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
    });
    fragment.computeBoundingSphere();
    shards.push({ geometry: fragment, center, vertices: [...vertices.values()], restingNormal, volume: area * .003, material, metal: true });
  }
  if (geometry !== source) geometry.dispose();
  return shards;
}
