import { RUBY_DIMENSIONS } from './design.js';
import { createRubyKing } from './king.js';
import { createRubyPawn } from './pawn.js';
import { createRubyKnight } from './knight.js';
import { createRubyQueen } from './queen.js';
import { createRubyRook } from './rook.js';
import { createRubyBishop } from './bishop.js';
import { applyVeinAtlas } from './vein-atlas.js';

export const rubySet = Object.freeze({
  id: 'ruby', name: 'Ruby', dimensions: RUBY_DIMENSIONS, availablePieces: Object.freeze(['pawn', 'rook', 'knight', 'bishop', 'queen', 'king']),
  // Models use one chess square = one unit; origin is the center of the foot.
  create(type, renderer, { bakedVeins = true } = {}) {
    const factory={pawn:createRubyPawn,rook:createRubyRook,bishop:createRubyBishop,knight:createRubyKnight,queen:createRubyQueen,king:createRubyKing}[type];
    if(factory){
      const model=factory(renderer);
      // Keep the original optical depth after changing actual geometric sizes.
      // This restores deep ruby interiors rather than thin, candy-like glass.
      model.traverse(mesh=>{
        if(!mesh.material?.uniforms?.opticalDensity)return;
        mesh.material.uniforms.opticalDensity.value=type==='pawn'?(mesh.name==='Small faceted pawn head'?2.07:1.67):({rook:1.4,bishop:1.2,knight:1.39,queen:1.19,king:1}[type]);
        if (bakedVeins) applyVeinAtlas(mesh);
      });
      return model;
    }
    throw new Error(`Ruby piece is not implemented: ${type}`);
  },
});
