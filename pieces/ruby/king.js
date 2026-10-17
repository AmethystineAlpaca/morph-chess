import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { jewelryStudio, gemstoneMaterial } from './material.js';
import { bodyProfile } from './design.js';
import { cutRubyStudio, cutRubyMaterial } from './cut-ruby.js';
import { setGemVeins } from './glow-veins.js';

// Approved model — 2026-10-17. Concept 03: open imperial crown, central pear-cut ruby and small cross.
// Height 1.72, foot diameter .76, origin at foot center.
export function createRubyKing(renderer) {
  const lighting=jewelryStudio(renderer);
  const cutLighting=cutRubyStudio(renderer);
  const king=new THREE.Group();
  king.name='Ruby king — arched crown / concept 03';
  const eye=new THREE.Vector3();
  function add(geometry,name,profile=null,concave=false) {
    const material=profile ? gemstoneMaterial(geometry,lighting.cube.texture,profile,concave)
      : cutRubyMaterial(geometry,cutLighting.cube.texture,concave);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.renderOrder=2;
    mesh.onBeforeRender=(_renderer,_scene,camera)=>{
      camera.getWorldPosition(eye);
      mesh.material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
    };
    king.add(mesh);return mesh;
  }
  function turned(points,name) {
    const profile=points.map(([r,y])=>new THREE.Vector2(r,y));
    return add(new THREE.LatheGeometry(profile,48),name,profile);
  }
  const profile=bodyProfile('king');
  add(new THREE.LatheGeometry(profile,48),'Tapered royal stem',profile);
  turned([[0,.98],[.21,.98],[.265,1.015],[.265,1.065],[.23,1.10],[0,1.10]],'Single crown circlet');

  // True open arches: triangle intersections preserve the negative spaces.
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2;
    const point=(r,y)=>new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const curve=new THREE.CatmullRomCurve3([
      point(.205,1.09),point(.285,1.21),point(.315,1.34),
      point(.265,1.415),point(.16,1.435),point(.035,1.405),
    ]);
    // Broad diamond-section arches echo the mitre's long carved planes.
    const steps=8, sides=4;
    const tube=new THREE.TubeGeometry(curve,steps,.05,sides,false);
    const geometry=tube.toNonIndexed();
    const positions=Array.from(geometry.attributes.position.array);
    // Close the tube ends using its exact ring vertices.
    for(const end of [0,1]) {
      const center=curve.getPointAt(end);
      const ring=Array.from({length:sides},(_,j)=>new THREE.Vector3().fromBufferAttribute(tube.attributes.position,end*steps*(sides+1)+j));
      for(let j=0;j<sides;j++) {
        const triangle=end?[center,ring[j],ring[(j+1)%sides]]:[center,ring[(j+1)%sides],ring[j]];
        for(const p of triangle) positions.push(p.x,p.y,p.z);
      }
    }
    tube.dispose();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry.computeVertexNormals();
    const arch=add(geometry,`Crown arch ${i+1}`,null,true);
    setGemVeins(arch.material,[Array.from({length:9},(_,j)=>curve.getPointAt(.04+j*.115))],{width:.006});
  }
  const vertices=[];
  for(const [r,y,phase] of [[.07,1.095,0],[.105,1.19,.12],[.155,1.31,0],[.12,1.395,.12],[.045,1.44,0]]) {
    for(let j=0;j<10;j++) {
      const a=j/10*Math.PI*2+phase;
      vertices.push(new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a)));
    }
  }
  const center=add(new ConvexGeometry(vertices),'Pear-cut central ruby');
  setGemVeins(center.material,[[[0,1.16,0],[.026,1.30,.018],[0,1.41,0]]],{width:.006});
  const orb=add(new THREE.IcosahedronGeometry(.065,1).scale(1,.72,1),'Cross support jewel');
  orb.position.y=1.465;
  const cross=new THREE.Shape([
    [-.037,1.485],[.037,1.485],[.032,1.575],[.12,1.575],
    [.12,1.64],[.032,1.64],[.04,1.71],[-.04,1.71],
    [-.032,1.64],[-.12,1.64],[-.12,1.575],[-.032,1.575],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const crossGeometry=new THREE.ExtrudeGeometry(cross,{
    depth:.08,bevelEnabled:true,bevelThickness:.012,bevelSize:.01,
    bevelSegments:1,steps:1,curveSegments:1,
  });
  crossGeometry.translate(0,0,-.04);
  const crossMesh=add(crossGeometry,'Beveled ruby cross',null,true);
  setGemVeins(crossMesh.material,[[[0,1.51,0],[0,1.68,0]],[[-.093,1.608,0],[.093,1.608,0]]],{width:.007});
  return king;
}
