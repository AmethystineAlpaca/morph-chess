import * as THREE from 'three';
import { designPoint } from './design.js';

export const MAX_GEM_VEINS = 24;

// Authoring paths for fixed mineral inclusions. The offline baker projects them
// into each head's material atlas; they are never traced during rendering.
export function setGemVeins(material, paths, { type, width = .006 } = {}) {
  const segments = [];
  for (const path of paths) {
    const points = path.map(point => {
      const p = point.isVector3 ? point.clone() : new THREE.Vector3(...point);
      return type ? designPoint(type, p) : p;
    });
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = a.distanceTo(b);
      if (length < .00001) continue;
      if (segments.length === MAX_GEM_VEINS) throw new Error('Head mineral path exceeds segment budget');
      segments.push([a.toArray(), b.toArray()]);
    }
  }
  material.userData.veins = { width, segments };
}

export function ringCenters(rings) {
  return rings.map(ring => ring.reduce((sum, p) => sum.add(p.isVector3 ? p : new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(ring.length));
}
