import { mountBoard, DEFAULTS } from './board.js';

export const duskMirrorBoard = Object.freeze({
  id: 'dusk-mirror', name: 'Dusk Mirror', squareSize: 1,
  defaults: DEFAULTS, mount: mountBoard,
});
