// Render the cover from the same board, pieces, lighting and postprocessing as
// Free Play. Only the camera composition and the surrounding HTML are different.
import { duskMirrorBoard } from '../../boards/dusk-mirror/index.js';
import { rubySet } from '../../pieces/ruby/index.js';
import { attachTable } from '../../play/table.js';
import { createAppearanceState } from '../../play/appearance.js';

let renderFrame;
const context = duskMirrorBoard.mount({
  interactive: true,
  createOverlay: context => {
    context.renderer.setAnimationLoop = callback => { renderFrame = callback; };
    return attachTable(context, rubySet, () => {}, { appearance: createAppearanceState() });
  },
});
const { renderer, camera, controls, model, invalidate } = context;
controls.enabled = false;
controls.enableDamping = false;
controls.target.set(0, .25, 0);
camera.position.set(6.6, 10.6, 12.9);
camera.zoom = 1.13;
camera.setViewOffset(innerWidth, innerHeight, 0, 45, innerWidth, innerHeight);
camera.updateProjectionMatrix();
controls.update();
// Fix the subtle floor animation so every render has the same background.
const updateModel = model.update.bind(model);
model.update = () => updateModel(3);
window.renderCover = () => { invalidate(); renderFrame(); };
await renderer.compileAsync(context.scene, camera);
await document.fonts.ready;
for (let frame = 0; frame < 3; frame++) window.renderCover();
window.coverReady = true;
