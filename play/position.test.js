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
test('free moves ignore turn and chess rules, and occupied squares swap without loss', () => {
  const pieces = initialPosition(types);
  const first = pieces[0], other = pieces[1];
  assert.equal(movePiece(pieces, first.id, 4, 4), true);
  assert.equal(movePiece(pieces, first.id, other.file, other.rank), true);
  assert.deepEqual([other.file, other.rank], [4, 4]);
  assert.equal(new Set(pieces.map(p => `${p.file},${p.rank}`)).size, 32);
  assert.equal(movePiece(pieces, first.id, -1, 3), false);
  assert.equal(movePiece(pieces, first.id, 1.5, 3), false);
});
test('unavailable knights leave their four squares empty', () => {
  assert.equal(initialPosition(types.filter(t => t !== 'knight')).length, 28);
});
