import { Chess } from 'chess.js';
const types = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const coordinates = square => ({ file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 });
export const algebraic = (file, rank) => `${'abcdefgh'[file]}${rank + 1}`;

// Keep stable render identities while chess.js owns every rule and game result.
export class ChessGame {
  constructor(fen) {
    this.chess = new Chess(fen);
    this.pieces = this.chess.board().flat().filter(Boolean).map((p, i) => ({ id: `piece-${i}`, type: types[p.type], side: p.color === 'w' ? 'white' : 'black', ...coordinates(p.square) }));
  }
  moves(square) { return this.chess.moves({ square, verbose: true }); }
  move(input) {
    const move = this.chess.move(input);
    const from = coordinates(move.from), to = coordinates(move.to);
    const moving = this.pieces.find(p => p.file === from.file && p.rank === from.rank);
    const capturedSquare = move.isEnPassant() ? { file: to.file, rank: from.rank } : to;
    const target = this.pieces.find(p => p.file === capturedSquare.file && p.rank === capturedSquare.rank);
    if (target) this.pieces = this.pieces.filter(p => p !== target);
    Object.assign(moving, to);
    if (move.promotion) moving.type = types[move.promotion];
    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const rook = this.pieces.find(p => p.rank === from.rank && p.file === (move.isKingsideCastle() ? 7 : 0));
      rook.file = move.isKingsideCastle() ? 5 : 3;
    }
    return { move, moving: { ...moving }, target: target && { ...target } };
  }
  result() {
    const c = this.chess;
    if (c.isCheckmate()) return `${c.turn() === 'w' ? 'Sapphire' : 'Ruby'} wins by checkmate`;
    if (c.isStalemate()) return 'Draw · Stalemate';
    if (c.isThreefoldRepetition()) return 'Draw · Threefold repetition';
    if (c.isInsufficientMaterial()) return 'Draw · Insufficient material';
    if (c.isDrawByFiftyMoves()) return 'Draw · Fifty-move rule';
    return null;
  }
}
