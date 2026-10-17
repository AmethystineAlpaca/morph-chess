import * as THREE from 'three';
import { initialPosition, movePiece, squareName } from './position.js';
import { tablePieceFactory } from './piece-cache.js';

const names = { pawn: 'Pawn', rook: 'Rook', knight: 'Knight', bishop: 'Bishop', queen: 'Queen', king: 'King' };
export function attachTable({ scene, renderer, camera, controls, sampleHeight, invalidate = () => {} }, pieceSet, onChange, { appearance } = {}) {
  let pieces = initialPosition(pieceSet.availablePieces);
  let selected = null;
  const objects = new Map();
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const ringGeometries = new Map();
  const ringMaterials = {
    white: new THREE.MeshBasicMaterial({ color: '#fff0ce', side: THREE.DoubleSide }),
    black: new THREE.MeshBasicMaterial({ color: '#7184a5', side: THREE.DoubleSide }),
  };
  const createPiece = tablePieceFactory(pieceSet, renderer, appearance);
  for (const piece of pieces) {
    const model = createPiece(piece.type,piece.side,piece.id);
    const group = new THREE.Group();
    group.add(model);
    // Replace display angles with board-facing poses. The knight's muzzle is
    // modeled along -X; white advances toward -Z and black toward +Z.
    model.rotation.y = (piece.type === 'knight' ? -Math.PI / 2 : 0)
      + (piece.side === 'black' ? Math.PI : 0);
    model.traverse(object => { if (object.isMesh) object.castShadow = false; });
    if(!ringGeometries.has(piece.type)) {
      const radius=(pieceSet.dimensions?.[piece.type]?.base || .77)/2;
      ringGeometries.set(piece.type,new THREE.RingGeometry(radius+.008,radius+.035,48));
    }
    const ring = new THREE.Mesh(ringGeometries.get(piece.type), ringMaterials[piece.side]);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .012;
    group.add(ring);
    group.userData.pieceId = piece.id;
    objects.set(piece.id, group);
    scene.add(group);
  }
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(.96, .96), new THREE.MeshBasicMaterial({ color: '#f3ce7b', transparent: true, opacity: .36, depthWrite: false, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  function describe(piece) { return `${piece.side === 'white' ? 'Light' : 'Dark'} ${names[piece.type]} · ${squareName(piece.file, piece.rank)}`; }
  function select(piece) {
    selected = piece;
    onChange(piece ? `${describe(piece)} selected. Choose a destination.` : 'Select a piece, then a destination square');
    update();
    invalidate();
  }
  function update() {
    for (const piece of pieces) {
      const x = piece.file - 3.5, z = 3.5 - piece.rank;
      objects.get(piece.id).position.set(x, sampleHeight(x, z) + .01, z);
    }
    marker.visible = !!selected;
    if (selected) marker.position.copy(objects.get(selected.id).position).y += .018;
  }
  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects([...objects.values()], true);
    if (intersections.length) {
      let object = intersections[0].object;
      while (object && !object.userData.pieceId) object = object.parent;
      const piece = pieces.find(item => item.id === object?.userData.pieceId);
      if (piece) return { file: piece.file, rank: piece.rank, piece };
    }
    // Refine against the animated liquid surface as well as flat boards.
    plane.constant = -sampleHeight(0, 0);
    for (let i = 0; i < 4; i++) {
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      plane.constant = -sampleHeight(hit.x, hit.z);
    }
    if (hit.x < -4 || hit.x >= 4 || hit.z <= -4 || hit.z > 4) return null;
    const file = Math.floor(hit.x + 4), rank = Math.floor(4 - hit.z);
    return { file, rank, piece: pieces.find(item => item.file === file && item.rank === rank) };
  }
  let down = null;
  const activePointers = new Set();
  canvas.addEventListener('pointerdown', event => {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { down = null; return; }
    if (event.button === 0) down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  });
  canvas.addEventListener('pointermove', event => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.dragged = true;
  });
  canvas.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); down = null; });
  canvas.addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    const click = down && down.id === event.pointerId && !down.dragged;
    down = null;
    if (!click) return;
    const target = pick(event);
    if (!target) { select(null); return; }
    if (!selected) { select(target.piece || null); return; }
    if (target.piece === selected) { select(null); return; }
    const moving = selected;
    const swapped = !!target.piece;
    movePiece(pieces, selected.id, target.file, target.rank);
    select(null);
    onChange(`${describe(moving)} · ${swapped ? 'Positions swapped' : 'Moved'}`);
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') select(null); });
  update();
  return {
    update,
    reset() { pieces = initialPosition(pieceSet.availablePieces); select(null); onChange('Starting position restored'); },
    view(top = false) {
      controls.minPolarAngle = .001;
      controls.target.set(0, .25, 0);
      camera.position.set(...(top ? [0, 15.8, .01] : [6.6, 11.2, 12.9]));
      controls.update();
      invalidate();
    },
  };
}
