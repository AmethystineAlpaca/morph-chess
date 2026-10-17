import * as THREE from 'three';
import { seededRandom } from './fracture-geometry.js';

export const FRACTURE_TIME = .65;
export const DURATION = 3.8;
const FPS = 60, STEP = 1 / 120, DOWN = new THREE.Vector3(0, -1, 0);
const rotated = new THREE.Vector3(), turn = new THREE.Quaternion();

export function lowestPoint(vertices, quaternion) {
  let lowest = Infinity;
  for (const vertex of vertices) lowest = Math.min(lowest, rotated.copy(vertex).applyQuaternion(quaternion).y);
  return lowest;
}

// Small, deterministic floor-contact simulation baked once. Playback and
// scrubbing use the same poses at every refresh rate, including slow motion.
export function bakeFractureMotion(shards, seed = 1028) {
  const random = seededRandom(seed), frameCount = Math.ceil((DURATION - FRACTURE_TIME) * FPS) + 1;
  for (const shard of shards) {
    const position = shard.center.clone(), quaternion = new THREE.Quaternion();
    const angle = Math.atan2(position.z, position.x) + (random() - .5) * 2.3;
    const speed = .52 + random() * 1.12;
    const velocity = new THREE.Vector3(Math.cos(angle) * speed, -.12 - random() * .18, Math.sin(angle) * speed);
    const spin = new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize();
    let angularSpeed = 3 + random() * 9, contactTime = null, resting = null;
    const frames = new Float32Array(frameCount * 7);
    for (let frame = 0; frame < frameCount; frame++) {
      for (let substep = 0; frame && substep < 2; substep++) {
        const time = (frame - 1) / FPS + (substep + 1) * STEP;
        velocity.y -= 9.81 * STEP;
        position.addScaledVector(velocity, STEP);
        turn.setFromAxisAngle(spin, angularSpeed * STEP); quaternion.premultiply(turn).normalize();
        const bottom = position.y + lowestPoint(shard.vertices, quaternion);
        if (bottom < .002) {
          position.y += .002 - bottom;
          velocity.y = velocity.y < -.25 ? -velocity.y * .18 : 0;
          velocity.x *= .80; velocity.z *= .80; angularSpeed *= .72;
          if (contactTime === null) contactTime = time;
          if (!resting) {
            const normal = shard.restingNormal.clone().applyQuaternion(quaternion);
            resting = new THREE.Quaternion().setFromUnitVectors(normal, DOWN).multiply(quaternion);
          }
        }
        if (contactTime !== null && time - contactTime > .16) {
          quaternion.slerp(resting, 1 - Math.exp(-STEP * 15));
          position.y = Math.max(position.y, .002 - lowestPoint(shard.vertices, quaternion));
          if (time - contactTime > .65) {
            quaternion.copy(resting);
            position.y = .002 - lowestPoint(shard.vertices, quaternion);
            velocity.set(0, 0, 0); angularSpeed = 0;
          }
        }
      }
      position.toArray(frames, frame * 7); quaternion.toArray(frames, frame * 7 + 3);
    }
    shard.frames = frames;
  }
  return shards;
}

const nextRotation = new THREE.Quaternion();
export function sampleFracture(shard, time, object) {
  const progress = THREE.MathUtils.clamp((time - FRACTURE_TIME) * FPS, 0, shard.frames.length / 7 - 1);
  const first = Math.floor(progress), next = Math.min(first + 1, shard.frames.length / 7 - 1), mix = progress - first;
  object.position.fromArray(shard.frames, first * 7);
  rotated.fromArray(shard.frames, next * 7); object.position.lerp(rotated, mix);
  object.quaternion.fromArray(shard.frames, first * 7 + 3);
  nextRotation.fromArray(shard.frames, next * 7 + 3); object.quaternion.slerp(nextRotation, mix);
  // Rotation interpolation can lower a corner between baked frames.
  object.position.y = Math.max(object.position.y, .002 - lowestPoint(shard.vertices, object.quaternion));
}
