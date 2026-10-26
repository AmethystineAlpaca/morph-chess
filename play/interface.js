import './gem-effects.css';
import { mountControls } from '../ui/controls.js';
import { squareName } from './position.js';
import { mountGemEffectSwitch } from './gem-effects.js';

const icons = {
  piece: '<path d="M9 3h6v3h3v4l-4 3v4l4 3v1H6v-1l4-3v-4l-4-3V6h3ZM6 6h12M10 17h4"/>',
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
  header.innerHTML = `<div class="play-brand">${svg('brand')}<div><h1>Morph Chess</h1><span class="engine-badge">Powered by Stockfish AI</span></div></div>
    <a class="explore-pieces" href="${import.meta.env.BASE_URL}pieces/${pieces.id}/?board=${board.id}" target="_blank" rel="noopener" aria-label="Explore the Pieces (opens in a new tab)">${svg('piece')}<span>Explore the Pieces</span>${svg('arrow')}</a>
    <nav class="play-toolbar" aria-label="Board controls">
      <div class="view-switch" role="group" aria-label="Board view">
        <button type="button" data-view="perspective" aria-label="Perspective view" title="Perspective view">${svg('perspective')}<span>3D view</span></button>
        <button type="button" data-view="top" aria-label="Top view" title="Top view">${svg('top')}<span>Top view</span></button>
      </div>
      <button type="button" id="board-sound" class="play-tool sound-tool" aria-label="Sound" aria-pressed="true">${svg('sound')}<span>Sound</span></button>
    </nav>`;
  app.append(header);
  if (context.gemEffects) app.append(mountGemEffectSwitch(context.gemEffects));
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Customize board');
  panel.innerHTML = `<h2>Board & pieces</h2>
    <label for="board-choice">Board</label>
    <select id="board-choice">${Object.values(boards).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>
    <label for="piece-choice">Pieces</label>
    <select id="piece-choice">${Object.values(pieceSets).map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select>
    <p class="settings-note" id="style-note">Applying a style starts a fresh board.</p>
    <button type="button" id="apply-style" class="primary-action" aria-describedby="style-note" disabled>Apply style ${svg('arrow')}</button>
    <details class="advanced-settings"><summary>Controls</summary>
      <dl><div><dt>Move</dt><dd>Select a piece, then a square.</dd></div>
      <div><dt>Capture</dt><dd>Choose an opposing piece.</dd></div>
      <div><dt>Same side</dt><dd>Switch selection only.</dd></div>
      <div><dt>Camera</dt><dd>Drag to orbit. Scroll or pinch to zoom.</dd></div>
      <div><dt>Keyboard</dt><dd>Tab to the board. Arrow keys to navigate, Enter to choose, Esc to deselect.</dd></div></dl>
    </details>
    <nav class="settings-links"><a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1" target="_blank" rel="noopener">Stockfish 19 · Source</a><a href="${import.meta.env.BASE_URL}licenses/stockfish.txt" target="_blank" rel="noopener">Stockfish · GPL-3.0 license</a></nav>`;
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
    <div class="game-controls" aria-label="Game controls">
      <label>Your side<select id="player-side"><option value="white">First · Ruby</option><option value="black">Second · Sapphire</option></select></label>
      <label>AI difficulty<select id="ai-level"><option value="casual">Casual</option><option value="club">Club</option><option value="strong">Strong</option></select></label>
      <button type="button" id="start-game">Start game ${svg('arrow')}</button>
      <button type="button" id="retry-engine" hidden>Retry AI</button>
    </div>
    <p class="gesture-hint" id="board-gesture-hint"><span class="desktop-gesture">Drag to orbit <span aria-hidden="true">·</span> Scroll to zoom</span><span class="touch-gesture">Drag to orbit <span aria-hidden="true">·</span> Pinch to zoom</span></p>`;
  const sideChoice = footer.querySelector('#player-side'), levelChoice = footer.querySelector('#ai-level');
  const startButton = footer.querySelector('#start-game'), retryButton = footer.querySelector('#retry-engine');
  const promotionDialog = document.createElement('dialog');
  promotionDialog.className = 'game-dialog';
  promotionDialog.setAttribute('aria-labelledby', 'promotion-title');
  promotionDialog.innerHTML = `<h2 id="promotion-title">Promote your pawn</h2><p>Choose the piece for your promotion.</p><div class="promotion-options">${[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([value,label]) => `<button type="button" data-promote="${value}">${label}</button>`).join('')}</div><button type="button" data-cancel>Cancel</button>`;
  const restartDialog = document.createElement('dialog');
  restartDialog.className = 'game-dialog';
  restartDialog.setAttribute('aria-labelledby', 'restart-title');
  restartDialog.innerHTML = '<h2 id="restart-title">Start a new game?</h2><p>Your current game will be replaced. The new game uses your selected side and difficulty.</p><div class="dialog-actions"><button type="button" data-cancel>Keep playing</button><button type="button" data-restart>Restart game</button></div>';
  app.append(promotionDialog, restartDialog);
  const begin = () => { restartDialog.close(); void table.startGame(sideChoice.value, levelChoice.value); };
  startButton.onclick = () => {
    const state = table.getState();
    if (state.phase !== 'idle' && state.phase !== 'finished' && state.history.length) restartDialog.showModal();
    else begin();
  };
  restartDialog.querySelector('[data-restart]').onclick = begin;
  restartDialog.querySelector('[data-cancel]').onclick = () => restartDialog.close();
  retryButton.onclick = () => table.retryEngine();
  promotionDialog.querySelector('[data-cancel]').onclick = () => table.cancelPromotion();
  promotionDialog.addEventListener('cancel', () => table.cancelPromotion());
  for (const button of promotionDialog.querySelectorAll('[data-promote]')) button.onclick = () => table.promote(button.dataset.promote);
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
  instructions.textContent = 'Arrow keys choose a square. Enter or Space selects or moves. Escape clears selection. Only legal moves are allowed. Choose your own piece, then a highlighted square.';
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
        const direction = table.getState().humanSide === 'black' ? -1 : 1;
        let nextFile = file, nextRank = rank;
        if (event.key === 'ArrowLeft') nextFile -= direction;
        else if (event.key === 'ArrowRight') nextFile += direction;
        else if (event.key === 'ArrowUp') nextRank += direction;
        else if (event.key === 'ArrowDown') nextRank -= direction;
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
    const { phase, humanSide, humanTurn, check, result, promotion, engineError } = state;
    let title = 'Ready to play?', detail = 'Choose your side and difficulty, then start a game.';
    const activePiece = selected || capturing || lastAction?.piece;
    card.dataset.state = phase;
    if (phase === 'loading') { title = 'Loading Stockfish…'; detail = 'Preparing your AI opponent.'; }
    if (phase === 'thinking') { title = 'Stockfish is thinking…'; detail = `You play ${humanSide === 'white' ? 'Ruby · White' : 'Sapphire · Black'}.`; }
    if (phase === 'animating') { title = capturing ? `Capturing ${pieceName(capturing)}` : 'Moving…'; detail = 'The next turn begins when the move finishes.'; }
    if (phase === 'playing') {
      title = check ? 'Your king is in check' : 'Your turn';
      detail = `${humanSide === 'white' ? 'Ruby · White' : 'Sapphire · Black'} · Select a piece to see legal moves.`;
      if (selected) { title = `${pieceName(selected)} · ${squareName(selected.file, selected.rank)}`; detail = 'Choose a highlighted square.'; }
      if (state.message.startsWith('That move') || state.message.startsWith('Choose one of your own')) detail = state.message;
      if (promotion) { title = 'Choose a promotion'; detail = 'Queen, rook, bishop or knight.'; }
    }
    if (phase === 'finished') { title = result; detail = 'Select a side and start another game.'; }
    if (phase === 'error') { title = 'AI connection interrupted'; detail = engineError; }
    if (lastAction && phase === 'playing' && !selected) detail += ` Last move: ${lastAction.san}.`;
    startButton.innerHTML = `${phase === 'idle' ? 'Start game' : 'Restart game'} ${svg('arrow')}`;
    retryButton.hidden = phase !== 'error';
    if (promotion && !promotionDialog.open) promotionDialog.showModal();
    if (!promotion && promotionDialog.open) promotionDialog.close();
    grid.dataset.orientation = humanSide;
    grid.dataset.phase = phase;
    grid.dataset.fen = state.fen;
    setText(statusTitle, title); setText(statusDetail, detail);
    const nextIcon = activePiece ? `${activePiece.side}/${activePiece.type}` : 'pointer';
    if (statusIcon.dataset.piece !== nextIcon) {
      statusIcon.dataset.piece = nextIcon; statusIcon.dataset.side = activePiece?.side || '';
      statusIcon.innerHTML = activePiece ? glyphs[activePiece.type] : svg('pointer');
    }
    footer.querySelector('#clear-selection').hidden = !selected || !!capturing;
    grid.setAttribute('aria-busy', String(['loading', 'thinking', 'animating'].includes(phase)));
    const occupied = new Map(state.pieces.map(piece => [squareName(piece.file, piece.rank), piece]));
    for (const [name, cell] of cells) {
      const piece = occupied.get(name), label = `${name}, ${piece ? pieceName(piece) : 'empty'}`;
      if (cell.getAttribute('aria-label') !== label) { cell.setAttribute('aria-label', label); cell.textContent = label; }
      cell.setAttribute('aria-selected', String(!!piece && piece.id === selected?.id));
      cell.setAttribute('aria-disabled', String(phase !== 'playing' || !humanTurn || !!promotion));
      cell.dataset.legal = String(state.legalSquares.includes(name));
      if (piece) cell.dataset.pieceId = piece.id; else delete cell.dataset.pieceId;
    }
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
