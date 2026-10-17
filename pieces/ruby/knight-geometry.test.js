import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKnightBodyGeometry, createKnightEarGeometry } from './knight-geometry.js';
import { createRookCrownGeometry } from './rook.js';

test('carved knight and rook have closed, consistently oriented optical boundaries', () => {
  for (const geometry of [createKnightBodyGeometry(), createKnightBodyGeometry({sculptedEyes:false,sculptedDetails:false}), createRookCrownGeometry(), createKnightEarGeometry(-1), createKnightEarGeometry(1)]) {
    const positions=geometry.attributes.position, edges=new Map();
    let volume=0;
    const vertex=i => new THREE.Vector3().fromBufferAttribute(positions,i);
    const key=i => vertex(i).toArray().map(v=>v.toFixed(6)).join(',');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    for(let i=0;i<positions.count;i+=3) {
      const a=vertex(i), b=vertex(i+1), c=vertex(i+2);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-14);
      volume+=a.dot(b.cross(c))/6;
      for(const [j,k] of [[i,i+1],[i+1,i+2],[i+2,i]]) {
        const aKey=key(j), bKey=key(k), edgeKey=[aKey,bKey].sort().join('|');
        const edge=edges.get(edgeKey) || {count:0,direction:0};
        edge.count++;edge.direction+=aKey<bKey?1:-1;edges.set(edgeKey,edge);
      }
    }
    assert.ok(volume>0,'the ruby volume faces outward');
    for(const edge of edges.values()) assert.deepEqual(edge,{count:2,direction:0});
    geometry.dispose();
  }
});
