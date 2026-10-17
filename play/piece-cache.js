import * as THREE from 'three';

// Both views use the original physical ruby shader. Only the already blurred
// reflection has a smaller internal-bounce budget; main-view optics stay intact.
export function opticalBounceLimit(reflected=false) {return reflected?1:4;}

// Geometry, BVH and material are shared. Per-draw uniforms keep clones and
// reflected cameras independent without duplicating GPU resources per piece.
export function tablePieceFactory(pieceSet, renderer, appearance = null) {
  const prototypes = new Map();
  const eye = new THREE.Vector3();
  const debug = typeof location==='undefined' ? null : new URLSearchParams(location.search);
  function updateEye(_renderer, _scene, camera) {
    const uniforms = this.material.uniforms;
    if (!uniforms?.localEye) return;
    camera.getWorldPosition(eye);
    uniforms.localEye.value.copy(this.worldToLocal(eye));
    if(uniforms.bounceLimit) {
      uniforms.bounceLimit.value=debug?.get('optics')==='full'?4:opticalBounceLimit(!!camera.userData.rubyReflection);
      uniforms.sideTone.value=this.userData.sideTone;
    }
    if (uniforms.gemFilter && appearance) {
      const style = appearance.resolve(this.userData.pieceSide, this.userData.appearanceId);
      // Preserve the original ruby exactly. Other gems need the same increased
      // optical depth in their dominant channel, regardless of which color it is.
      const baseline = this.material.userData.opticalAbsorption || [.35,12,9];
      const density = this.material.userData.paletteDensity || 1;
      if (style.palette.filter.every(value => value === 1)) {
        uniforms.gemFilter.value.set(1,1,1);
      } else {
        uniforms.gemFilter.value.set(...style.palette.absorption.map((value, channel) => value * density / baseline[channel]));
      }
      uniforms.veinTint.value.fromArray(style.palette.light);
    }
    // Consecutive clones share a material but have different local cameras.
    this.material.uniformsNeedUpdate = true;
  }
  return (type, side='white', id) => {
    if (!prototypes.has(type)) prototypes.set(type, pieceSet.create(type, renderer));
    const model = prototypes.get(type).clone(true);
    model.userData.dimensions=pieceSet.dimensions?.[type];
    model.traverse(object => { if (object.isMesh && object.material.uniforms?.localEye) {
      object.userData.pieceHeight=pieceSet.dimensions?.[type]?.height || 1.5;
      object.userData.sideTone=side==='black'?1:0;
      object.userData.pieceSide=side;
      object.userData.appearanceId=id;
      object.onBeforeRender = updateEye;
    } });
    return model;
  };
}
