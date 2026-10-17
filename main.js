import { visibleBoards, pieceSets } from './catalog.js';
import { attachTable } from './play/table.js';
import { mountControls } from './ui/controls.js';
import { createAppearanceState } from './play/appearance.js';
import './play/home.css';

const selection = new URLSearchParams(location.search);
const board = visibleBoards[selection.get('board')] || visibleBoards['midnight-silver'];
const pieces = pieceSets[selection.get('pieces')] || pieceSets.ruby;
let table;
const appearance = createAppearanceState();
const context = board.mount({ interactive: true, createOverlay: context => {
  table = attachTable(context, pieces, message => {
    const status = document.querySelector('#move-status');
    if (status) status.textContent = message;
  }, { appearance });
  return table;
} });
document.body.classList.add('home');
document.title = 'Morph Chess · Free Play';
document.querySelector('aside').hidden = true;
const panel = document.createElement('section');
panel.setAttribute('aria-label', 'Board settings');
panel.innerHTML = `<label for="board-choice">Board</label>
  <select id="board-choice" aria-describedby="board-choice-note">${Object.values(visibleBoards).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>
  <p id="board-choice-note" class="settings-note">Changing the board or piece set resets the position.</p>
  ${Object.keys(pieceSets).length > 1 ? `<label for="piece-choice">Piece set</label><select id="piece-choice">${Object.values(pieceSets).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>` : ''}
  <label for="table-view">View</label>
  <select id="table-view"><option value="perspective">Perspective</option><option value="top">Top</option><option value="custom" disabled>Custom view</option></select>
  <div class="settings-row"><button id="reset-position">Reset position</button></div>
  <details class="advanced-settings"><summary>How to play</summary><p>Select a piece, then a destination square. Pieces swap if the square is occupied. Press Esc to deselect.</p><p>Drag to rotate. Scroll or pinch to zoom. Light and dark base rings distinguish the two sides.</p></details>
  <nav class="settings-links"><a href="/pieces/${pieces.id}/">View pieces</a><a href="/boards/${board.id}/">View board only</a></nav>`;
const controls = mountControls(panel);
const boardChoice = panel.querySelector('#board-choice');
const pieceChoice = panel.querySelector('#piece-choice');
boardChoice.value = board.id;
if (pieceChoice) pieceChoice.value = pieces.id;
function changeTable() {
  const url = new URL(location.href);
  url.searchParams.set('board', boardChoice.value);
  url.searchParams.set('pieces', pieceChoice?.value || pieces.id);
  location.assign(url);
}
boardChoice.onchange = changeTable;
if (pieceChoice) pieceChoice.onchange = changeTable;
panel.querySelector('#reset-position').onclick = () => {
  table.reset();
  controls.open = false;
  controls.querySelector('summary').focus();
};
const viewChoice = panel.querySelector('#table-view');
viewChoice.onchange = () => table.view(viewChoice.value === 'top');
context.controls.addEventListener('start', () => { viewChoice.value = 'custom'; });
document.querySelector('footer').innerHTML = '<span id="move-status" role="status" aria-live="polite">Select a piece, then a destination square</span>';
table.view();

import { benchmark } from './play/performance.js';
benchmark(context);
