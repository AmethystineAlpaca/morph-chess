import { visibleBoards, pieceSets } from './catalog.js';
import { attachTable } from './play/table.js';
import { mountPlayInterface } from './play/interface.js';
import { createAppearanceState } from './play/appearance.js';
import './play/home.css';

const selection = new URLSearchParams(location.search);
const board = visibleBoards[selection.get('board')] || visibleBoards['midnight-silver'];
const pieces = pieceSets[selection.get('pieces')] || pieceSets.ruby;
let table, interfaceView;
const appearance = createAppearanceState();
const context = board.mount({ interactive: true, createOverlay: context => {
  table = attachTable(context, pieces, (_message, state) => interfaceView?.update(state), { appearance });
  return table;
} });
document.body.classList.add('home');
document.title = 'Morph Chess · Free Play';
document.querySelector('aside').hidden = true;
interfaceView = mountPlayInterface({ board, pieces, boards: visibleBoards, pieceSets, context, table });

import { benchmark } from './play/performance.js';
benchmark(context);
