import { midnightSilverBoard } from './boards/midnight-silver/index.js';
import { rubySet } from './pieces/ruby/index.js';
import { nightOathSet } from './pieces/night-oath/index.js';
import { jellyOceanBoard } from './boards/jelly-ocean/index.js';
import { duskMirrorBoard } from './boards/dusk-mirror/index.js';

export const pieceSets = Object.freeze({ ruby: rubySet, 'night-oath': nightOathSet });
export const boards = Object.freeze({ 'jelly-ocean': jellyOceanBoard, 'midnight-silver': midnightSilverBoard, 'dusk-mirror': duskMirrorBoard });

// Temporarily hide the amber board from Free Play while keeping its assets and preview.
// Remove its ID here to make it selectable again.
const hiddenBoards = new Set(['jelly-ocean']);
export const visibleBoards = Object.freeze(Object.fromEntries(
  Object.entries(boards).filter(([id]) => !hiddenBoards.has(id)),
));
