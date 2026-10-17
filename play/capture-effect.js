import * as THREE from 'three';
import { fracturePiece } from '../pieces/ruby/fracture-piece.js';
import { fractureMaterial } from '../pieces/ruby/fracture-material.js';
import { sampleFracture, FRACTURE_TIME } from '../pieces/ruby/fracture-motion.js';

export const CAPTURE_PAUSE = .015;
export const CAPTURE_ADVANCE = 1;
export const DEBRIS_FADE = 1.35;
export const SILENT_BREAK_DURATION = 1.92;

export function captureTiming(elapsed, duration) {
  const fadeStart = duration + CAPTURE_PAUSE;
  // Let the capturing piece arrive while debris is still falling. Keep the
  // full landing and sound before fading the fragments out.
  const arrival = Math.max(0, fadeStart - CAPTURE_ADVANCE);
  const fade = THREE.MathUtils.clamp((elapsed - fadeStart) / DEBRIS_FADE, 0, 1);
  return { arrived: elapsed >= arrival, opacity: 1 - fade * fade * (3 - 2 * fade), done: fade >= 1 };
}

// Find the actual last landing in the baked motion, excluding its idle tail.
// Stretch that motion to the selected recording so landing and sound end together.
function landingTime(shards) {
  let last = 1;
  for (const { frames } of shards) {
    for (let frame = frames.length / 7 - 1; frame > last; frame--) {
      if (frames.subarray(frame * 7, frame * 7 + 7).some((value, i) => Math.abs(value - frames[(frame - 1) * 7 + i]) > .00001)) {
        last = frame;
        break;
      }
    }
  }
  return last / 60;
}

export async function prepareCaptureEffect(model, piece, { renderer, camera, scene, appearance }) {
  // Baking in local coordinates avoids pulling debris toward the board origin.
  // Only the model is fractured, never its side ring or shared source geometry.
  const source = model.clone(true);
  source.position.set(0, 0, 0);
  source.rotation.set(0, 0, 0);
  const shards = fracturePiece(source, piece.type);
  const group = new THREE.Group();
  group.name = 'Capture debris';
  group.rotation.copy(model.rotation);
  const materials = new Set(), metals = new Map(), eye = new THREE.Vector3();
  const opacity = { value: 1 };
  let environment;
  model.traverse(mesh => { if (mesh.material?.uniforms?.studio) environment = mesh.material.uniforms.studio.value; });
  const palette = appearance?.resolve(piece.side, piece.id).palette;
  function dispose() {
    group.removeFromParent();
    for (const shard of shards) shard.geometry.dispose();
    for (const material of materials) material.dispose();
    group.clear();
  }
  try {
    for (const shard of shards) {
      let material;
      if (shard.metal) {
        if (!metals.has(shard.material)) {
          const clone = shard.material.clone();
          // Three.js does not copy the custom gold-finish shader hooks.
          clone.onBeforeCompile = shard.material.onBeforeCompile;
          clone.customProgramCacheKey = shard.material.customProgramCacheKey;
          metals.set(shard.material, clone);
        }
        material = metals.get(shard.material);
      } else {
        material = fractureMaterial(shard.geometry, environment);
        material.uniforms.captureOpacity = opacity;
        material.fragmentShader = 'uniform float captureOpacity;\n' + material.fragmentShader
          .replace('gl_FragColor=vec4(color,1.0);', 'gl_FragColor=vec4(color,captureOpacity);');
        material.uniforms.sideTone.value = piece.side === 'black' ? 1 : 0;
        if (palette) {
          material.uniforms.gemFilter.value.fromArray(palette.filter);
          material.uniforms.veinTint.value.fromArray(palette.light);
        }
      }
      materials.add(material);
      material.transparent = true;
      material.depthWrite = false;
      const mesh = new THREE.Mesh(shard.geometry, material);
      if (!shard.metal) mesh.onBeforeRender = (_renderer, _scene, activeCamera) => {
        activeCamera.getWorldPosition(eye);
        material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
        material.uniforms.bounceLimit.value = activeCamera.userData.rubyReflection ? 1 : 3;
      };
      mesh.renderOrder = 2;
      mesh.position.copy(shard.center);
      group.add(mesh);
      shard.mesh = mesh;
    }
    await renderer.compileAsync(group, camera, scene);
  } catch (error) { dispose(); throw error; }
  const landing = landingTime(shards);
  return {
    group,
    dispose,
    update(elapsed, duration) {
      const timing = captureTiming(elapsed, duration);
      const time = FRACTURE_TIME + Math.min(1, Math.max(0, elapsed / duration)) * landing;
      for (const shard of shards) sampleFracture(shard, time, shard.mesh);
      opacity.value = timing.opacity;
      for (const material of metals.values()) material.opacity = timing.opacity;
      return timing;
    },
  };
}
