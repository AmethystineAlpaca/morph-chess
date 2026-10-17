import { mountControls } from '../ui/controls.js';
import { squareName } from './position.js';

const icons = {
  brand: '<path d="m12 2 8 7-8 13L4 9Zm-8 7h16M8 6l4 16 4-16"/>',
  perspective: '<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  top: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-6 4H2v6h3l6 4ZM16 9l6 6m0-6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  pointer: '<path d="m5 3 14 10-7 1-4 7Zm7 11 5 7"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};
const glyphs = { pawn: '♟︎', rook: '♜︎', knight: '♞︎', bishop: '♝︎', queen: '♛︎', king: '♚︎' };
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const pieceName = piece => `${piece.side === 'white' ? 'Ruby' : 'Sapphire'} ${piece.type}`;

export function mountPlayInterface({ board, pieces, boards, pieceSets, context, table }) {
  const app = document.querySelector('#app');
  const header = document.createElement('header');
  header.className = 'play-header';
  header.innerHTML = `<div class="play-brand">${svg('brand')}<div><h1>Morph Chess</h1><span title="Move either side freely. No chess move restrictions.">Free play</span></div></div>
    <nav class="play-toolbar" aria-label="Board controls">
      <div class="view-switch" role="group" aria-label="Board view">
        <button type="button" data-view="perspective" aria-label="Perspective view" title="Perspective view">${svg('perspective')}<span>3D view</span></button>
        <button type="button" data-view="top" aria-label="Top view" title="Top view">${svg('top')}<span>Top view</span></button>
      </div>
      <button type="button" id="board-sound" class="play-tool sound-tool" aria-label="Sound" aria-pressed="true">${svg('sound')}<span>Sound</span></button>
    </nav>`;
  app.append(header);
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Customize board');
  panel.innerHTML = `<h2>Board & pieces</h2>
    <label for="board-choice">Board</label>
    <select id="board-choice">${Object.values(boards).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>
    <label for="piece-choice">Pieces</label>
    <select id="piece-choice">${Object.values(pieceSets).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>
    <p class="settings-note" id="style-note">Applying a style starts a fresh board.</p>
    <button type="button" id="apply-style" class="primary-action" aria-describedby="style-note" disabled>Apply style ${svg('arrow')}</button>
    <div class="reset-section">
      <button type="button" id="reset-position">${svg('reset')}Reset board</button>
      <div id="reset-confirmation" hidden><p>Restore the starting position?</p>
        <div class="settings-row"><button type="button" id="keep-position">Keep playing</button><button type="button" id="confirm-reset">Reset board</button></div>
      </div>
    </div>
    <details class="advanced-settings"><summary>Controls</summary>
      <dl><div><dt>Move</dt><dd>Select a piece, then a square.</dd></div>
      <div><dt>Capture</dt><dd>Choose an opposing piece.</dd></div>
      <div><dt>Same side</dt><dd>Switch selection only.</dd></div>
      <div><dt>Camera</dt><dd>Drag to orbit. Scroll or pinch to zoom.</dd></div>
      <div><dt>Keyboard</dt><dd>Tab to the board. Arrow keys to navigate, Enter to choose, Esc to deselect.</dd></div></dl>
    </details>
    <nav class="settings-links"><a href="/pieces/${pieces.id}/?board=${board.id}">Explore the pieces ${svg('arrow')}</a></nav>`;
  const controls = mountControls(panel);
  const toggle = controls.querySelector('summary');
  toggle.querySelector('span').textContent = 'Customize';
  toggle.setAttribute('aria-label', 'Customize board');
  header.querySelector('nav').append(controls);

  const footer = document.querySelector('footer');
  footer.className = 'play-bottom';
  footer.innerHTML = `<div class="action-card" data-state="idle">
      <div id="status-icon" class="status-icon" aria-hidden="true">${svg('pointer')}</div>
      <div id="move-status" role="status" aria-live="polite" aria-atomic="true"><strong id="status-title">Choose a piece</strong><p id="status-detail">Then choose a destination.</p></div>
      <button type="button" id="clear-selection" aria-label="Clear selection" title="Clear selection (Esc)" hidden>${svg('close')}</button>
    </div>
    <p class="gesture-hint" id="board-gesture-hint"><span class="desktop-gesture">Drag to orbit <span aria-hidden="true">·</span> Scroll to zoom</span><span class="touch-gesture">Drag to orbit <span aria-hidden="true">·</span> Pinch to zoom</span></p>`;
  footer.querySelector('#clear-selection').onclick = () => table.deselect();
  const card = footer.querySelector('.action-card');
  const statusIcon = footer.querySelector('#status-icon');
  const statusTitle = footer.querySelector('#status-title');
  const statusDetail = footer.querySelector('#status-detail');
  const soundButton = header.querySelector('#board-sound');
  let soundState;

  // A labelled HTML grid mirrors WebGL for keyboard users, screen readers,
  // and tools that cannot infer square positions from rendered pixels.
  const grid = document.createElement('div');
  grid.className = 'board-accessibility visually-hidden';
  grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', 'Chessboard');
  grid.setAttribute('aria-rowcount', '8'); grid.setAttribute('aria-colcount', '8');
  grid.setAttribute('aria-describedby', 'board-keyboard-instructions');
  const instructions = document.createElement('p');
  instructions.id = 'board-keyboard-instructions'; instructions.className = 'visually-hidden';
  instructions.textContent = 'Arrow keys choose a square. Enter or Space selects or moves. Escape clears selection. Pieces move freely; choosing another piece on the same side switches selection.';
  const cells = new Map();
  let focused = 'A1';
  for (let rank = 7; rank >= 0; rank--) {
    const row = document.createElement('div'); row.setAttribute('role', 'row'); row.setAttribute('aria-rowindex', String(8 - rank));
    for (let file = 0; file < 8; file++) {
      const name = squareName(file, rank), cell = document.createElement('button');
      cell.type = 'button'; cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-colindex', String(file + 1));
      cell.dataset.square = name; cell.tabIndex = name === focused ? 0 : -1;
      cell.onclick = () => table.activateSquare(file, rank);
      cell.onfocus = () => {
        cells.get(focused).tabIndex = -1; cell.tabIndex = 0; focused = name;
        table.previewSquare({ file, rank });
      };
      cell.onkeydown = event => {
        let nextFile = file, nextRank = rank;
        if (event.key === 'ArrowLeft') nextFile--;
        else if (event.key === 'ArrowRight') nextFile++;
        else if (event.key === 'ArrowUp') nextRank++;
        else if (event.key === 'ArrowDown') nextRank--;
        else if (event.key === 'Home') nextFile = 0;
        else if (event.key === 'End') nextFile = 7;
        else return;
        event.preventDefault();
        nextFile = Math.max(0, Math.min(7, nextFile)); nextRank = Math.max(0, Math.min(7, nextRank));
        cells.get(squareName(nextFile, nextRank)).focus({ preventScroll: true });
      };
      cells.set(name, cell); row.append(cell);
    }
    grid.append(row);
  }
  grid.addEventListener('focusout', event => { if (!grid.contains(event.relatedTarget)) table.previewSquare(null); });
  header.after(grid, instructions);
  context.renderer.domElement.setAttribute('aria-hidden', 'true');

  function setText(element, text) { if (element.textContent !== text) element.textContent = text; }
  function update(state) {
    const { selected, capturing, hovered, lastAction, muted } = state;
    let title = 'Choose a piece', detail = 'Then choose a destination.';
    const activePiece = selected || capturing || lastAction?.piece;
    card.dataset.state = capturing ? 'capturing' : selected ? 'selected' : 'idle';
    if (capturing) {
      title = `Capturing ${pieceName(capturing)}`; detail = `Taking ${squareName(capturing.file, capturing.rank)}…`;
    } else if (selected) {
      title = `${pieceName(selected)} · ${squareName(selected.file, selected.rank)}`;
      detail = 'Choose an empty square or an opponent.';
      if (hovered && (hovered.file !== selected.file || hovered.rank !== selected.rank)) {
        detail = hovered.piece ? hovered.piece.side === selected.side ? `Select ${pieceName(hovered.piece)} instead` : `Capture ${pieceName(hovered.piece)} · ${squareName(hovered.file, hovered.rank)}` : `Move to ${squareName(hovered.file, hovered.rank)}`;
      }
    } else if (lastAction) {
      title = `${pieceName(lastAction.piece)} → ${squareName(lastAction.piece.file, lastAction.piece.rank)}`;
      detail = lastAction.kind === 'capture' ? `Captured ${pieceName(lastAction.target)}. Choose your next piece.` : 'Choose your next piece.';
    } else if (state.message === 'Starting position restored') {
      title = 'Board reset'; detail = 'Choose any piece to begin.';
    }
    if (state.message.startsWith('Could not')) { title = 'Capture interrupted'; detail = 'Choose a destination to try again.'; }
    if (!capturing && grid.contains(document.activeElement)) {
      if (selected?.id && selected.id === hovered?.piece?.id) detail = 'Arrow keys to choose a destination.';
      else {
        const action = selected && hovered?.piece && hovered.piece.side !== selected.side ? 'capture' : selected && !hovered?.piece ? 'move' : 'select';
        detail = `${focused} · ${hovered?.piece ? pieceName(hovered.piece) : 'Empty square'} · Enter to ${action}`;
      }
    }
    setText(statusTitle, title); setText(statusDetail, detail);
    const nextIcon = activePiece ? `${activePiece.side}/${activePiece.type}` : 'pointer';
    if (statusIcon.dataset.piece !== nextIcon) {
      statusIcon.dataset.piece = nextIcon; statusIcon.dataset.side = activePiece?.side || '';
      statusIcon.innerHTML = activePiece ? glyphs[activePiece.type] : svg('pointer');
    }
    footer.querySelector('#clear-selection').hidden = !selected || !!capturing;
    grid.setAttribute('aria-busy', String(!!capturing));
    const occupied = new Map(state.pieces.map(piece => [squareName(piece.file, piece.rank), piece]));
    for (const [name, cell] of cells) {
      const piece = occupied.get(name), label = `${name}, ${piece ? pieceName(piece) : 'empty'}`;
      if (cell.getAttribute('aria-label') !== label) { cell.setAttribute('aria-label', label); cell.textContent = label; }
      cell.setAttribute('aria-selected', String(!!piece && piece.id === selected?.id));
      cell.setAttribute('aria-disabled', String(!!capturing));
      if (piece) cell.dataset.pieceId = piece.id; else delete cell.dataset.pieceId;
    }
    panel.querySelector('#reset-position').disabled = !lastAction && !capturing;
    if (soundState !== muted) {
      soundState = muted; soundButton.innerHTML = `${svg(muted ? 'muted' : 'sound')}<span>Sound</span>`;
      soundButton.setAttribute('aria-pressed', String(!muted)); soundButton.title = muted ? 'Turn sound on' : 'Mute sound';
    }
  }
  soundButton.onclick = () => {
    const muted = !table.getState().muted; table.setMuted(muted);
    try { localStorage.setItem('morph-chess-muted', String(muted)); } catch { /* Optional preference. */ }
  };
  try { table.setMuted(localStorage.getItem('morph-chess-muted') === 'true'); } catch { /* Storage can be disabled. */ }
  const boardChoice = panel.querySelector('#board-choice'), pieceChoice = panel.querySelector('#piece-choice');
  boardChoice.value = board.id; pieceChoice.value = pieces.id;
  const apply = panel.querySelector('#apply-style');
  function styleChanged() { apply.disabled = boardChoice.value === board.id && pieceChoice.value === pieces.id; }
  boardChoice.onchange = styleChanged; pieceChoice.onchange = styleChanged;
  apply.onclick = () => {
    const url = new URL(location.href);
    url.searchParams.set('board', boardChoice.value); url.searchParams.set('pieces', pieceChoice.value);
    location.assign(url);
  };
  const confirmation = panel.querySelector('#reset-confirmation'), reset = panel.querySelector('#reset-position');
  function closeConfirmation() { confirmation.hidden = true; reset.hidden = false; }
  reset.onclick = () => { reset.hidden = true; confirmation.hidden = false; panel.querySelector('#keep-position').focus(); };
  panel.querySelector('#keep-position').onclick = () => { closeConfirmation(); reset.focus(); };
  panel.querySelector('#confirm-reset').onclick = () => { table.reset(); closeConfirmation(); controls.open = false; toggle.focus(); };
  controls.addEventListener('toggle', () => { if (!controls.open) closeConfirmation(); });
  function updateView() {
    const top = context.controls.getPolarAngle() < .02;
    for (const button of header.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String((button.dataset.view === 'top') === top));
  }
  for (const button of header.querySelectorAll('[data-view]')) button.onclick = () => { table.view(button.dataset.view === 'top'); updateView(); };
  context.controls.addEventListener('change', updateView);
  let compact = matchMedia('(max-width:700px)').matches;
  window.addEventListener('resize', () => {
    const nextCompact = matchMedia('(max-width:700px)').matches;
    // Reframe an overhead board on orientation changes; preserve an orbit view.
    if (compact !== nextCompact && context.controls.getPolarAngle() < .02) table.view(true);
    compact = nextCompact;
  });
  table.view(matchMedia('(max-width:700px)').matches);
  updateView(); update(table.getState());
  return { update };
}
