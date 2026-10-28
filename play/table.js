import * as THREE from 'three';
import { squareName } from './position.js';
import { ChessGame, algebraic } from './game.js';
import { StockfishEngine } from './engine.js';
import { tablePieceFactory } from './piece-cache.js';
import { createMoveSound } from './move-audio.js';
import { FractureAudio } from '../pieces/ruby/fracture-audio.js';
import { prepareCaptureEffect, SILENT_BREAK_DURATION } from './capture-effect.js';

const names = { pawn: 'Pawn', rook: 'Rook', knight: 'Knight', bishop: 'Bishop', queen: 'Queen', king: 'King' };
export function attachTable({ scene, renderer, camera, controls, sampleHeight, gemEffects, invalidate = () => {} }, pieceSet, onChange, { appearance } = {}) {
  let game = new ChessGame();
  let pieces = game.pieces.map(p => ({ ...p }));
  let phase = 'idle', humanSide = 'white', difficulty = 'casual', engine = null;
  let engineError = '', promotion = null, topView = false;
  let animationDone = null, pendingCapture = null;
  let shatterEnabled = true;
  let selected = null;
  let hovered = null, lastAction = null, muted = false;
  let message = 'Choose your side and start a game';
  const objects = new Map();
  const canvas = renderer.domElement;
  const moveSound = createMoveSound();
  let breakSound = null;
  try {
    breakSound = new FractureAudio([
      { url: new URL('../pieces/ruby/audio/break-wine-glass.wav', import.meta.url), gain: .7 },
      { url: new URL('../pieces/ruby/audio/breaking-glass-stereo.wav', import.meta.url), gain: .9 },
    ], 0);
    breakSound.ready.catch(() => {});
  } catch { /* Captures also work when Web Audio is unavailable. */ }
  const debris = new Set();
  let capturing = null, generation = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const ringGeometries = new Map();
  const ringMaterials = {
    white: new THREE.MeshBasicMaterial({ color: '#a5717e', side: THREE.DoubleSide }),
    black: new THREE.MeshBasicMaterial({ color: '#7184a5', side: THREE.DoubleSide }),
  };
  const createPiece = tablePieceFactory(pieceSet, renderer, appearance);
  function addPiece(piece) {
    const model = createPiece(piece.type,piece.side,piece.id);
    gemEffects?.apply(model);
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
    group.userData.type = piece.type;
    objects.set(piece.id, group);
    scene.add(group);
  }
  pieces.forEach(addPiece);
  function syncPieces() {
    for (const piece of pieces) {
      const object = objects.get(piece.id);
      if (object && object.userData.type !== piece.type) { scene.remove(object); objects.delete(piece.id); }
      if (!objects.has(piece.id)) addPiece(piece);
      objects.get(piece.id).visible = true;
    }
    for (const [id, object] of objects) if (!pieces.some(p => p.id === id)) object.visible = false;
  }
  function squareMarker(color, opacity, width) {
    const shape = new THREE.Shape();
    shape.moveTo(-.48, -.48); shape.lineTo(.48, -.48); shape.lineTo(.48, .48); shape.lineTo(-.48, .48); shape.closePath();
    const hole = new THREE.Path(), inner = .48 - width;
    hole.moveTo(-inner, -inner); hole.lineTo(-inner, inner); hole.lineTo(inner, inner); hole.lineTo(inner, -inner); hole.closePath();
    shape.holes.push(hole);
    const group = new THREE.Group();
    for (const [geometry, alpha] of [[new THREE.ShapeGeometry(shape), opacity], [new THREE.PlaneGeometry(.96, .96), opacity * .12]]) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 3;
      group.add(mesh);
    }
    group.visible = false;
    scene.add(group);
    return group;
  }
  const marker = squareMarker('#ffe3a6', 1, .045);
  const hoverMarker = squareMarker('#eef3ff', .85, .022);
  const legalMarkers = Array.from({ length: 32 }, () => squareMarker('#cce7ad', .85, .025));
  function legalMoves() { return selected && phase === 'playing' && isHumanTurn() ? game.moves(algebraic(selected.file, selected.rank)) : []; }
  function isHumanTurn() { return game.chess.turn() === (humanSide === 'white' ? 'w' : 'b'); }
  function getState() {
    return {
      pieces: pieces.map(piece => ({ ...piece })), selected: selected && { ...selected },
      hovered: hovered && { ...hovered, piece: pieces.find(piece => piece.file === hovered.file && piece.rank === hovered.rank) },
      capturing: capturing && { ...capturing }, lastAction, muted, shatterEnabled, message,
      phase, humanSide, difficulty, engineError, promotion, legalSquares: [...new Set(legalMoves().map(m => m.to.toUpperCase()))],
      check: game.chess.isCheck(), result: game.result(), humanTurn: isHumanTurn(),
      history: game.chess.history(), fen: game.chess.fen(),
    };
  }
  function notify(text = message) { message = text; onChange(message, getState()); }
  function unlockSound() { moveSound.unlock(); breakSound?.unlock().catch(() => {}); }
  function describe(piece) { return `${piece.side === 'white' ? 'Ruby' : 'Sapphire'} ${names[piece.type]} · ${squareName(piece.file, piece.rank)}`; }
  function select(piece) {
    selected = piece;
    notify(piece ? `${describe(piece)} selected. Choose a destination.` : 'Choose one of your pieces; highlighted squares are legal moves');
    update();
    invalidate();
  }
  function update() {
    for (const effect of debris) {
      const elapsed = (performance.now() - effect.started) / 1000;
      const timing = effect.update(elapsed, effect.duration);
      effect.group.position.y = sampleHeight(effect.group.position.x, effect.group.position.z) + .01;
      if (timing.arrived && !effect.arrived) {
        effect.arrived = true;
        finishAnimation(effect.result);
      }
      if (timing.done) { effect.dispose(); debris.delete(effect); }
      invalidate();
    }
    for (const piece of pieces) {
      const x = piece.file - 3.5, z = 3.5 - piece.rank;
      objects.get(piece.id).position.set(x, sampleHeight(x, z) + .01, z);
    }
    const moves = legalMoves();
    const squares = [...new Set(moves.map(move => move.to))];
    legalMarkers.forEach((hint, i) => {
      hint.visible = !!squares[i];
      if (squares[i]) {
        const x = squares[i].charCodeAt(0) - 97 - 3.5, z = 3.5 - (Number(squares[i][1]) - 1);
        hint.position.set(x, sampleHeight(x, z) + .035, z);
      }
    });
    marker.visible = !!selected;
    if (selected) marker.position.copy(objects.get(selected.id).position).y += .018;
    hoverMarker.visible = !!hovered && !capturing && !(selected?.file === hovered.file && selected?.rank === hovered.rank);
    if (hoverMarker.visible) {
      const x = hovered.file - 3.5, z = 3.5 - hovered.rank;
      hoverMarker.position.set(x, sampleHeight(x, z) + .029, z);
      const occupant = pieces.find(piece => piece.file === hovered.file && piece.rank === hovered.rank);
      const opponent = selected && occupant && selected.side !== occupant.side;
      for (const mesh of hoverMarker.children) mesh.material.color.set(opponent ? '#ff9f9b' : '#eef3ff');
    }
  }
  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects([...objects.values()].filter(object => object.visible), true);
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
  async function capture(moving, target, result) {
    const version = generation;
    capturing = target;
    select(null);
    notify(`${describe(moving)} · Capturing ${describe(target)}`);
    // Paint the click feedback before preparing the actual target's cuts.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (version !== generation || pendingCapture !== result) return;
    let effect;
    try {
      effect = await prepareCaptureEffect(objects.get(target.id).children[0], target, { renderer, camera, scene, appearance, gemEffects });
    } catch (error) {
      if (version !== generation || pendingCapture !== result) return;
      finishAnimation(result);
      console.error(error);
      return;
    }
    if (version !== generation || pendingCapture !== result) { effect.dispose(); return; }
    effect.group.position.copy(objects.get(target.id).position);
    effect.result = result;
    effect.moving = moving;
    effect.target = target;
    effect.duration = SILENT_BREAK_DURATION;
    if (breakSound?.context?.state === 'running') {
      breakSound.start(0, 1, { newTake: true });
      effect.duration = breakSound.selected?.buffer.duration || SILENT_BREAK_DURATION;
    }
    effect.started = performance.now();
    effect.update(0, effect.duration);
    objects.get(target.id).visible = false;
    scene.add(effect.group);
    debris.add(effect);
    invalidate();
  }
  let down = null;
  const activePointers = new Set();
  function previewSquare(square) {
    if (hovered?.file === square?.file && hovered?.rank === square?.rank) return;
    hovered = square ? { file: square.file, rank: square.rank } : null;
    update(); invalidate(); notify();
  }
  function finishAnimation(result) {
    pendingCapture = null;
    pieces = game.pieces.map(p => ({ ...p }));
    syncPieces();
    capturing = null;
    lastAction = { kind: result.target ? 'capture' : 'move', piece: result.moving, target: result.target, san: result.move.san };
    moveSound.play();
    const done = animationDone; animationDone = null;
    done?.();
  }
  async function playMove(input) {
    const version = generation;
    message = '';
    const result = game.move(input);
    const moving = pieces.find(p => p.id === result.moving.id);
    selected = null; promotion = null; phase = 'animating';
    if (result.target && shatterEnabled) {
      pendingCapture = result;
      await new Promise(resolve => { animationDone = resolve; capture(moving, result.target, result); });
    } else finishAnimation(result);
    if (version !== generation) return;
    phase = game.result() ? 'finished' : 'playing';
    update(); invalidate(); notify();
    if (phase === 'playing' && !isHumanTurn()) await computerMove();
  }
  async function computerMove() {
    const version = generation;
    phase = 'thinking'; notify();
    try {
      const history = game.chess.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
      const move = await engine.bestMove(history, difficulty);
      if (version !== generation) return;
      await playMove(move);
    } catch (error) {
      if (version !== generation) return;
      engineError = error.message; phase = 'error'; notify();
    }
  }
  function resetVisuals() {
    generation++;
    engine?.dispose(); engine = null;
    animationDone?.(); animationDone = null; pendingCapture = null;
    capturing = null; selected = null; promotion = null; down = null;
    breakSound?.stop();
    for (const effect of debris) effect.dispose();
    debris.clear();
    game = new ChessGame(); pieces = game.pieces.map(p => ({ ...p }));
    hovered = null; lastAction = null; engineError = ''; message = '';
    syncPieces(); update(); invalidate();
  }
  async function startGame(side = humanSide, level = difficulty) {
    resetVisuals(); humanSide = side; difficulty = level;
    setView(topView); unlockSound();
    await readyEngine();
  }
  async function readyEngine() {
    const version = generation;
    phase = 'loading'; engineError = ''; notify();
    try {
      engine?.dispose(); engine = new StockfishEngine();
      await engine.init(difficulty);
      if (version !== generation) return;
      phase = game.result() ? 'finished' : 'playing'; notify();
      if (phase === 'playing' && !isHumanTurn()) await computerMove();
    } catch (error) {
      if (version !== generation) return;
      engineError = error.message; phase = 'error'; notify();
    }
  }
  function activateSquare(file, rank) {
    if (phase !== 'playing' || !isHumanTurn() || promotion || !Number.isInteger(file) || !Number.isInteger(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) return;
    unlockSound();
    const target = pieces.find(piece => piece.file === file && piece.rank === rank);
    if (target?.side === humanSide) { select(target === selected ? null : target); return; }
    if (!selected) { notify('Choose one of your own pieces'); return; }
    const from = algebraic(selected.file, selected.rank), to = algebraic(file, rank);
    const choices = game.moves(from).filter(move => move.to === to);
    if (!choices.length) { notify('That move is not legal. Choose a highlighted square.'); return; }
    if (choices.some(move => move.promotion)) { promotion = { from, to }; notify(); return; }
    void playMove({ from, to });
  }
  function setView(top = false) {
    topView = top;
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update();
    const direction = humanSide === 'black' ? -1 : 1;
    controls.minPolarAngle = .001;
    controls.target.set(0, .25, 0);
    camera.position.set(...(top ? [0, innerWidth <= 700 ? 13.8 : 15.8, .01 * direction] : [6.6 * direction, 11.2, 12.9 * direction]));
    if (!top && innerWidth <= 700) camera.position.multiplyScalar(1.08);
    controls.update(); controls.enableDamping = damping;
    invalidate();
  }
  canvas.addEventListener('pointerdown', event => {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { down = null; return; }
    if (event.button === 0) {
      unlockSound();
      down = capturing ? null : { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.dragged = true;
    if (event.buttons || activePointers.size > 1) { canvas.style.cursor = 'grabbing'; previewSquare(null); return; }
    const target = pick(event);
    canvas.style.cursor = capturing ? 'progress' : target && (selected || target.piece) ? 'pointer' : 'grab';
    previewSquare(target && (selected || target.piece) ? target : null);
  });
  canvas.addEventListener('pointerleave', () => previewSquare(null));
  canvas.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); down = null; });
  canvas.addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    const click = down && down.id === event.pointerId && !down.dragged;
    down = null;
    if (!click || capturing) return;
    const target = pick(event);
    if (!target) { select(null); return; }
    activateSquare(target.file, target.rank);
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented) select(null); });
  update();
  return {
    update,
    getState,
    activateSquare,
    previewSquare,
    deselect() { select(null); },
    setMuted(value) { muted = !!value; moveSound.setMuted(muted); breakSound?.setMuted(muted); notify(); },
    setShatterEnabled(value) {
      shatterEnabled = !!value;
      if (!shatterEnabled) {
        breakSound?.stop();
        for (const effect of debris) effect.dispose();
        debris.clear();
        if (pendingCapture) finishAnimation(pendingCapture);
        update(); invalidate();
      }
      notify();
    },
    startGame,
    retryEngine() { if (phase === 'error') { generation++; void readyEngine(); } },
    promote(type) { if (promotion && ['q', 'r', 'b', 'n'].includes(type)) void playMove({ ...promotion, promotion: type }); },
    cancelPromotion() { promotion = null; notify(); },
    reset() { void startGame(); },
    view: setView,
  };
}
