import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTraceData } from '../pieces/ruby/knight-bvh.js';
import { gemstoneMaterial } from '../pieces/ruby/material.js';
import { tablePieceFactory, opticalBounceLimit } from './piece-cache.js';
import { rubySet } from '../pieces/ruby/index.js';

test('shared piece instances retain independent transforms and correct local camera uniforms', () => {
  let creations = 0;
  const factory = tablePieceFactory({ create() {
    creations++;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({ uniforms: { localEye: { value: new THREE.Vector3() } } })));
    return group;
  } }, {});
  const a = factory('pawn'), b = factory('pawn');
  assert.equal(creations, 1);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
  assert.equal(a.children[0].material, b.children[0].material);
  b.position.x = 3;
  a.updateMatrixWorld(true); b.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0,5,10);camera.updateMatrixWorld();
  for (const [model, x] of [[a,0],[b,-3]]) {
    const mesh = model.children[0];
    mesh.onBeforeRender(null, null, camera);
    assert.equal(mesh.material.uniforms.localEye.value.x, x);
    assert.equal(mesh.material.uniformsNeedUpdate, true);
  }
  assert.equal(a.position.x, 0);
});

test('BVH nearest surface agrees with exhaustive triangle intersection on concave and indexed meshes', () => {
  for (const geometry of [new THREE.TorusGeometry(.5,.18,8,16).toNonIndexed(), new THREE.SphereGeometry(.5,16,12)]) {
    const trace = buildTraceData(geometry), nodes=trace.nodes.image.data, tris=trace.triangles.image.data;
    const vertex = offset => new THREE.Vector3(tris[offset],tris[offset+1],tris[offset+2]);
    function triangle(ray, index) {
      const offset=index*12, a=vertex(offset), b=a.clone().add(vertex(offset+4)), c=a.clone().add(vertex(offset+8));
      const hit=ray.intersectTriangle(a,b,c,false,new THREE.Vector3());
      if(!hit)return Infinity;
      const distance=hit.distanceTo(ray.origin);
      return distance>.00005?distance:Infinity;
    }
    for(let i=0;i<150;i++) {
      const origin=new THREE.Vector3(Math.sin(i*2.3),Math.cos(i*.7),Math.sin(i*.4)).multiplyScalar(i%2?.3:1.3);
      const direction=origin.clone().negate().add(new THREE.Vector3(.1*Math.cos(i),.05,0)).normalize();
      const ray=new THREE.Ray(origin,direction);
      let brute=Infinity, accelerated=Infinity, index=0;
      for(let j=0;j<trace.triangleCount;j++)brute=Math.min(brute,triangle(ray,j));
      while(index<trace.nodeCount){
        const base=index*12;
        const box=new THREE.Box3(new THREE.Vector3(...nodes.slice(base,base+3)),new THREE.Vector3(...nodes.slice(base+4,base+7))).expandByScalar(.00002);
        if(!ray.intersectsBox(box)){index=nodes[base+10];continue;}
        if(nodes[base+8]<0){index++;continue;}
        for(let j=0;j<nodes[base+9];j++)accelerated=Math.min(accelerated,triangle(ray,nodes[base+8]+j));
        index=nodes[base+10];
      }
      assert.ok(brute===accelerated || Math.abs(brute-accelerated)<1e-6);
    }
    trace.nodes.dispose();trace.triangles.dispose();geometry.dispose();
  }
});

test('convex plane deduplication and concave acceleration preserve full optical bounce counts', () => {
  const box=new THREE.BoxGeometry().toNonIndexed();
  const convex=gemstoneMaterial(box,null);
  assert.equal(convex.uniforms.planes.value.length,6);
  const concave=gemstoneMaterial(new THREE.TorusGeometry().toNonIndexed(),null,null,true);
  assert.ok(concave.uniforms.bvhNodes);
  assert.equal(concave.uniforms.vertices,undefined);
  assert.match(concave.fragmentShader,/bounce<4/);
  convex.dispose();concave.dispose();
});

test('shared table materials isolate side tint and force inexpensive reflected optics', () => {
  const geometry = new THREE.IcosahedronGeometry(.28, 2);
  const material = gemstoneMaterial(geometry, null);
  const shader = material.fragmentShader;
  const mainCamera = new THREE.PerspectiveCamera();
  mainCamera.position.set(0,1,2);mainCamera.lookAt(0,0,0);mainCamera.updateMatrixWorld();
  const reflectedCamera = new THREE.PerspectiveCamera();
  reflectedCamera.position.y = -5;
  reflectedCamera.userData.rubyReflection=true;reflectedCamera.updateMatrixWorld();
  const factory = tablePieceFactory({ create() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));
    return group;
  } }, {domElement:{clientHeight:720}});
  for (const camera of [mainCamera, reflectedCamera]) {
    for(const side of ['black','white','black']) {
      const mesh = factory('pawn',side).children[0];mesh.updateMatrixWorld();
      mesh.onBeforeRender(null, null, camera);
      assert.equal(mesh.material.fragmentShader, shader);
      assert.equal(mesh.material.uniforms.sideTone.value,side==='black'?1:0);
      if(camera===reflectedCamera)assert.equal(mesh.material.uniforms.bounceLimit.value,1);
      else assert.ok(mesh.material.uniforms.bounceLimit.value===4);
    }
  }
  geometry.dispose();material.dispose();
});

test('main-view ruby retains four internal bounces while reflections use one',()=>{
  assert.equal(opticalBounceLimit(),4);
  assert.equal(opticalBounceLimit(true),1);
});

test('six assets obey tournament height order, fit their cells and keep the pawn head proportional',()=>{
  // The factories build real geometries and optical acceleration data. Only
  // environment capture is stubbed; no GPU is needed to measure their bounds.
  const previous=globalThis.document;
  globalThis.document={createElement(){return {getContext(){return {createRadialGradient(){return {addColorStop(){}}},fillRect(){}}}}}};
  const renderer={coordinateSystem:THREE.WebGLCoordinateSystem,xr:{enabled:false},getRenderTarget(){return null},getActiveCubeFace(){return 0},getActiveMipmapLevel(){return 0},setRenderTarget(){},render(){}};
  try {
    let previousHeight=0,total=0;
    for(const type of ['pawn','rook','knight','bishop','queen','king']) {
      const model=rubySet.create(type,renderer);model.updateMatrixWorld(true);
      const size=new THREE.Box3().setFromObject(model,true).getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.y-rubySet.dimensions[type].height)<.002,type+' height');
      assert.ok(size.y>previousHeight,type+' order');previousHeight=size.y;
      assert.ok(Math.max(size.x,size.z)<.80,type+' fits square');
      assert.deepEqual(model.scale.toArray(),[1,1,1]);
      let headVeins=0;
      model.traverse(mesh=>{if(!mesh.isMesh)return;
        assert.deepEqual(mesh.scale.toArray(),[1,1,1]);
        const position=mesh.geometry.attributes.position;
        assert.ok(Array.from(position.array).every(Number.isFinite));
        total+=((mesh.geometry.index?.count||position.count)/3)*({pawn:16,rook:4,knight:4,bishop:4,queen:2,king:2}[type]);
        const uniforms=mesh.material.uniforms;
        const paths=mesh.material.userData.veins.segments;
        const count=paths.length;
        if(uniforms.spans.value.length) assert.equal(count,0, type+' turned body has no head markings');
        headVeins+=count;
        if(count) {
          assert.equal(uniforms.hasVeins.value,1);
          const texture=uniforms.veinMap.value;
          assert.ok(texture.image.data.some(value=>value>128),type+' visible baked detail');
          assert.equal(texture.generateMipmaps,true);
          assert.equal(mesh.geometry.attributes.veinUv.count,position.count);
          assert.ok(Array.from(mesh.geometry.attributes.veinUv.array).every(value=>value>=0 && value<=1));
        }
        for(let vein=0;vein<count;vein++) {
          const a=new THREE.Vector3().fromArray(paths[vein][0]);
          const b=new THREE.Vector3().fromArray(paths[vein][1]);
          for(const t of [.1,.5,.9]) {
            const point=a.clone().lerp(b,t);
            const ray=new THREE.Ray(point,new THREE.Vector3(.819,.377,.432).normalize());
            const hits=[];
            const vertex=index=>new THREE.Vector3().fromBufferAttribute(position,mesh.geometry.index?mesh.geometry.index.getX(index):index);
            for(let face=0;face<(mesh.geometry.index?.count||position.count);face+=3) {
              const hit=ray.intersectTriangle(vertex(face),vertex(face+1),vertex(face+2),false,new THREE.Vector3());
              if(hit && !hits.some(p=>p.distanceToSquared(hit)<1e-12)) hits.push(hit);
            }
            assert.equal(hits.length%2,1,`${type} / ${mesh.name}: mineral path ${vein} must stay inside the head (${t})`);
          }
        }
      });
      assert.ok(headVeins>0,type+' has identifying head mineral paths');
      if(type==='pawn') {
        const head=model.getObjectByName('Small faceted pawn head');
        const headSize=new THREE.Box3().setFromObject(head,true).getSize(new THREE.Vector3());
        assert.ok(headSize.y/size.y>.27 && headSize.y/size.y<.29);
      }
    }
    assert.ok(total<60000,'full set geometry budget');
  } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
