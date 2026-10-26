import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessGame, algebraic } from './game.js';

function consistent(game) {
  assert.equal(game.pieces.length, game.chess.board().flat().filter(Boolean).length);
  assert.equal(new Set(game.pieces.map(p => p.id)).size, game.pieces.length);
  for (const p of game.pieces) {
    const board = game.chess.get(algebraic(p.file, p.rank));
    assert.equal(board.color, p.side[0]);
    assert.equal(board.type, { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' }[p.type]);
  }
}
test('rejects illegal and out-of-turn moves without changing rendered pieces', () => {
  const game = new ChessGame(), before = JSON.stringify(game.pieces);
  assert.throws(() => game.move({from:'e2',to:'e5'}));
  assert.throws(() => game.move({from:'e7',to:'e5'}));
  assert.equal(JSON.stringify(game.pieces), before);
  game.move('e4'); consistent(game);
});
test('both castling directions move king and rook while preserving identities', () => {
  for (const san of ['O-O','O-O-O']) {
    const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const ids = game.pieces.map(p => p.id);
    game.move(san); consistent(game);
    assert.deepEqual(game.pieces.map(p => p.id), ids);
    game.move(san === 'O-O' ? 'O-O-O' : 'O-O'); consistent(game);
  }
});
test('castling through check and moves exposing the king are rejected', () => {
  const game = new ChessGame('k4r2/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.throws(() => game.move('O-O'));
  const pinned = new ChessGame('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.throws(() => pinned.move({from:'e2',to:'d2'}));
});
test('en passant removes the captured pawn from its actual square', () => {
  const game = new ChessGame();
  for (const move of ['e4','a6','e5','d5']) game.move(move);
  const result = game.move('exd6');
  assert.equal(result.target.file, 3); assert.equal(result.target.rank, 4);
  assert.equal(game.pieces.length,31); consistent(game);
});
test('all promotion choices, including capture promotion, preserve the pawn identity', () => {
  for (const promotion of ['q','r','b','n']) {
    const game = new ChessGame('1r5k/P7/8/8/8/8/8/7K w - - 0 1');
    const id = game.pieces.find(p => p.type === 'pawn').id;
    const result = game.move({from:'a7',to:'b8',promotion});
    assert.equal(result.moving.id,id); assert.equal(result.target.type,'rook'); consistent(game);
  }
});
test('checkmate, stalemate, material and repetition report a final result', () => {
  const game = new ChessGame();
  for (const move of ['f3','e5','g4','Qh4#']) game.move(move);
  assert.equal(game.result(),'Sapphire wins by checkmate');
  assert.match(new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').result(),/Stalemate/);
  assert.match(new ChessGame('7k/8/6K1/8/8/8/8/8 w - - 0 1').result(),/Insufficient/);
  const repetition = new ChessGame();
  for (const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) repetition.move(move);
  assert.match(repetition.result(), /Threefold/);
  consistent(game);
});
