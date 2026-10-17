import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPosition, movePiece } from './position.js';
const types = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
test('standard setup places 32 unique pieces with queens on D and kings on E', () => {
  const pieces = initialPosition(types);
  assert.equal(pieces.length, 32);
  assert.equal(new Set(pieces.map(p => `${p.file},${p.rank}`)).size, 32);
  for (const side of ['white', 'black']) {
    assert.equal(pieces.filter(p => p.side === side && p.type === 'pawn').length, 8);
    assert.equal(pieces.find(p => p.side === side && p.type === 'queen').file, 3);
    assert.equal(pieces.find(p => p.side === side && p.type === 'king').file, 4);
  }
});
test('free moves ignore turn and chess rules, but allied and unchanged destinations do nothing', () => {
  const pieces = initialPosition(types);
  for (const side of ['white', 'black']) {
    const [first, other] = pieces.filter(piece => piece.side === side);
    assert.equal(movePiece(pieces, first.id, 4, side === 'white' ? 3 : 4), true);
    const before = structuredClone(pieces);
    assert.equal(movePiece(pieces, first.id, other.file, other.rank), false);
    assert.equal(movePiece(pieces, first.id, first.file, first.rank), false);
    assert.equal(movePiece(pieces, first.id, -1, 3), false);
    assert.equal(movePiece(pieces, first.id, 1.5, 3), false);
    assert.deepEqual(pieces, before);
  }
  assert.equal(new Set(pieces.map(p => `${p.file},${p.rank}`)).size, 32);
});
test('either side can capture any opposing piece, including a king, through occupied squares', () => {
  const pieces = initialPosition(types);
  const white = pieces.find(p => p.side === 'white' && p.type === 'rook');
  const blackKing = pieces.find(p => p.side === 'black' && p.type === 'king');
  const destination = [blackKing.file, blackKing.rank];
  assert.equal(movePiece(pieces, white.id, ...destination), true);
  assert.deepEqual([white.file, white.rank], destination);
  assert.equal(pieces.includes(blackKing), false);
  assert.equal(pieces.some(p => p.file === 0 && p.rank === 0), false);
  assert.equal(pieces.length, 31);
  const black = pieces.find(p => p.side === 'black' && p.type === 'pawn');
  assert.equal(movePiece(pieces, black.id, ...destination), true);
  assert.equal(pieces.includes(white), false);
  assert.equal(pieces.length, 30);
  assert.equal(new Set(pieces.map(p => `${p.file},${p.rank}`)).size, 30);
  const before = structuredClone(pieces);
  assert.equal(movePiece(pieces, white.id, 3, 3), false);
  assert.deepEqual(pieces, before);
  assert.equal(initialPosition(types).length, 32);
});
test('unavailable knights leave their four squares empty', () => {
  assert.equal(initialPosition(types.filter(t => t !== 'knight')).length, 28);
});
