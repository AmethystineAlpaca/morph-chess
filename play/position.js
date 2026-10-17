const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
export const squareName = (file, rank) => `${'ABCDEFGH'[file]}${rank + 1}`;
export function initialPosition(available) {
  const pieces = [];
  for (const side of ['white', 'black']) {
    for (let file = 0; file < 8; file++) {
      for (const [type, rank] of [[backRank[file], side === 'white' ? 0 : 7], ['pawn', side === 'white' ? 1 : 6]]) {
        if (available.includes(type)) pieces.push({ id: `${side}-${type}-${file}`, side, type, file, rank });
      }
    }
  }
  return pieces;
}
// Free movement: empty squares or opposing pieces only; allies stay in place.
// There are deliberately no turns, legal-move checks, or king restrictions.
export function movePiece(pieces, id, file, rank) {
  const piece = pieces.find(item => item.id === id);
  if (!piece || !Number.isInteger(file) || !Number.isInteger(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) return false;
  if (piece.file === file && piece.rank === rank) return false;
  const other = pieces.find(item => item !== piece && item.file === file && item.rank === rank);
  if (other?.side === piece.side) return false;
  if (other) pieces.splice(pieces.indexOf(other), 1);
  [piece.file, piece.rank] = [file, rank];
  return true;
}
