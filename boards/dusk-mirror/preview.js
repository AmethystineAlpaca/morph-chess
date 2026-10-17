import { mountBoard } from './board.js';
import { attachPieceCollection } from '../../previews/board-pieces.js';

if (new URLSearchParams(location.search).get('pieces') === 'ruby') {
  const { rubySet } = await import('../../pieces/ruby/index.js');
  mountBoard({ createOverlay: context => attachPieceCollection(context, rubySet) });
} else {
  mountBoard();
}
