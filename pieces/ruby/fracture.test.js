import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bodyProfile } from './design.js';
import { fractureGeometry } from './fracture-geometry.js';
import { bakeFractureMotion, sampleFracture, FRACTURE_TIME, DURATION } from './fracture-motion.js';

function geometryVolume(geometry) {
  const positions = geometry.attributes.position, index = geometry.index;
  const point = i => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i);
  let volume = 0;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) volume += point(i).dot(point(i + 1).cross(point(i + 2))) / 6;
  return volume;
}

test('fracturing the actual concave pawn conserves its volume and closes the cut faces', () => {
  for (const source of [new THREE.LatheGeometry(bodyProfile('pawn'), 48), new THREE.IcosahedronGeometry(.135, 1).translate(0, .815, 0)]) {
    const original = source.attributes.position.array.slice();
    const shards = fractureGeometry(source, { count: 100 });
    assert.equal(shards.length, 100);
    assert.deepEqual(source.attributes.position.array, original);
    const originalVolume = geometryVolume(source);
    assert.ok(Math.abs(shards.reduce((total, shard) => total + geometryVolume(shard.geometry), 0) / originalVolume - 1) < 1e-5);
    for (const shard of shards) {
      const position = shard.geometry.attributes.position, areaBalance = new THREE.Vector3();
      assert.ok(shard.volume > 0);
      assert.ok([...position.array].every(Number.isFinite));
      for (let i = 0; i < position.count; i += 3) {
        const [a, b, c] = [i, i + 1, i + 2].map(index => new THREE.Vector3().fromBufferAttribute(position, index));
        const normal = b.sub(a).cross(c.sub(a));
        assert.ok(normal.lengthSq() > 1e-20);
        areaBalance.add(normal);
      }
      assert.ok(areaBalance.length() < 1e-7, 'every cut has an oppositely oriented closing face');
      shard.geometry.dispose();
    }
    source.dispose();
  }
});

test('falling fragments stay above the floor, settle, and replay without changing their poses', () => {
  const source = new THREE.LatheGeometry(bodyProfile('pawn'), 48);
  const shards = bakeFractureMotion(fractureGeometry(source, { count: 80 }));
  const object = new THREE.Object3D(), vertex = new THREE.Vector3();
  const restPoses = [];
  for (const shard of shards) {
    sampleFracture(shard, FRACTURE_TIME, object);
    assert.ok(object.position.distanceTo(shard.center) < .0021);
    for (let time = FRACTURE_TIME; time <= DURATION; time += .027) {
      sampleFracture(shard, time, object);
      for (const point of shard.vertices) assert.ok(vertex.copy(point).applyQuaternion(object.quaternion).add(object.position).y >= .0019);
      assert.ok(Math.hypot(object.position.x, object.position.z) < 1.5, 'debris stays near the pawn');
    }
    sampleFracture(shard, DURATION, object);
    restPoses.push([...object.position.toArray(), ...object.quaternion.toArray()]);
    const floorContact = Math.min(...shard.vertices.map(point => vertex.copy(point).applyQuaternion(object.quaternion).add(object.position).y));
    assert.ok(Math.abs(floorContact - .002) < 1e-6, 'a resting fragment touches the floor');
    const end = object.position.clone();
    sampleFracture(shard, DURATION - .5, object);
    assert.ok(end.distanceTo(object.position) < 1e-6, 'the settled pile does not keep drifting');
  }
  bakeFractureMotion(shards);
  shards.forEach((shard, index) => {
    sampleFracture(shard, DURATION, object);
    assert.deepEqual([...object.position.toArray(), ...object.quaternion.toArray()], restPoses[index]);
    shard.geometry.dispose();
  });
  source.dispose();
});
