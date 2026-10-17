import { nightOathSet } from './index.js';
import { mountPieceViewer } from '../../previews/piece-viewer.js';
import { lightMetalPreview } from './metal.js';
mountPieceViewer(nightOathSet, { background: '#15191f', lighting: lightMetalPreview });
