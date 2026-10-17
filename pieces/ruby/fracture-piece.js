import * as THREE from 'three';
import { fractureGeometry } from './fracture-geometry.js';
import { bakeFractureMotion } from './fracture-motion.js';
import { orientFractureSurface, fractureMetalSurface } from './fracture-surface.js';

export const FRACTURE_PIECES = Object.freeze([
  { type: 'pawn', name: 'Pawn', fragments: 196 },
  { type: 'rook', name: 'Rook', fragments: 240 },
  { type: 'knight', name: 'Knight', fragments: 260 },
  { type: 'bishop', name: 'Bishop', fragments: 260 },
  { type: 'queen', name: 'Queen', fragments: 340 },
  { type: 'king', name: 'King', fragments: 360 },
]);

export function solidVolume(geometry) {
  const position = geometry.attributes.position, index = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
    volume += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(volume);
}

// Work on each original closed component, so crowns keep their openings and
// the knight keeps its carved silhouette until the exact instant it breaks.
export function fracturePiece(model, type) {
  const specification = FRACTURE_PIECES.find(piece => piece.type === type);
  if (!specification) throw new Error(`Unknown fracture piece: ${type}`);
  model.updateMatrixWorld(true);
  const components = [];
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (mesh.name.startsWith('Crown arch')) {
      const repaired = orientFractureSurface(geometry); geometry.dispose(); geometry = repaired;
    }
    const metal = !mesh.material.uniforms?.localEye;
    components.push({ geometry, name: mesh.name, volume: metal ? 0 : solidVolume(geometry), metal, material: mesh.material });
  });
  const total = components.reduce((sum, component) => sum + component.volume, 0);
  const shards = [];
  components.forEach((component, index) => {
    if (component.metal) {
      try { shards.push(...fractureMetalSurface(component.geometry, component.material)); }
      finally { component.geometry.dispose(); }
      return;
    }
    // Keep the user's approved pawn exactly: same mesh cuts, seeds and motion.
    const pawnHead = component.name === 'Small faceted pawn head';
    const count = type === 'pawn' ? (pawnHead ? 36 : 160)
      : Math.max(3, Math.round(specification.fragments * component.volume / total));
    const seed = type === 'pawn' ? (pawnHead ? 918 : 85173) : 85173 + FRACTURE_PIECES.indexOf(specification) * 1009 + index * 97;
    try { shards.push(...fractureGeometry(component.geometry, { count, seed })); }
    finally { component.geometry.dispose(); }
  });
  return bakeFractureMotion(shards);
}
