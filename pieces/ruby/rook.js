import * as THREE from 'three';
import { carvedPiece } from './carved-piece.js';
import { setGemVeins } from './glow-veins.js';

// Six broad tower faces, narrow corner cuts and integral tapered merlons.
// Each face is planar; extra vertices only mark the genuine bevel boundaries.
export function createRookCrownGeometry() {
  const vertices=[];
  const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
  const point=(r,y,i,width=1,twist=0)=>{
    const sector=Math.floor((i%24)/4), corner=i%4;
    const a=sector*Math.PI/3+twist, t=[-.43,-.35,.35,.43][corner]*r*width;
    const x=r*(corner===0 || corner===3 ? .965 : 1);
    return [x*Math.cos(a)-t*Math.sin(a),y,x*Math.sin(a)+t*Math.cos(a)];
  };
  const outer=[[.178,.855],[.205,.965],[.257,1.085],[.287,1.175]];
  for(let i=0;i<24;i++) {
    const j=(i+1)%24;
    for(let row=0;row<outer.length-1;row++) {
      const [r,y]=outer[row],[s,z]=outer[row+1];
      quad(point(r,y,i),point(s,z,i),point(s,z,j),point(r,y,j));
    }
    tri([0,.855,0],point(.178,.855,i),point(.178,.855,j));
    // The recessed well is rotated relative to the outer facets. These
    // oblique internal cuts retain dark reflections instead of bright panes.
    tri([0,1.015,0],point(.115,1.015,j,1,.20),point(.115,1.015,i,1,.20));
    quad(point(.115,1.015,i,1,.20),point(.115,1.015,j,1,.20),point(.174,1.175,j,1,.20),point(.174,1.175,i,1,.20));
    if(i%4===3) {
      quad(point(.287,1.175,i),point(.174,1.175,i,1,.20),point(.174,1.175,j,1,.20),point(.287,1.175,j));
      continue;
    }
    // A single beveled crown, slightly drawn inward at the top. The broad
    // front plane carries the dark ruby; sloping lips catch the narrow lights.
    const section=[[.287,1.175,1],[.279,1.314,.91],[.265,1.335,.86],
      [.187,1.335,.86,.20],[.174,1.314,.91,.20],[.174,1.175,1,.20]];
    const at=(row,index)=>point(row[0],row[1],index,row[2],row[3]||0);
    for(let row=0;row<section.length-1;row++)
      quad(at(section[row],i),at(section[row+1],i),at(section[row+1],j),at(section[row],j));
    for(let row=1;row<section.length-1;row++) {
      if(i%4===0) tri(at(section[0],i),at(section[row+1],i),at(section[row],i));
      if(i%4===2) tri(at(section[0],j),at(section[row],j),at(section[row+1],j));
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createRubyRook(renderer) {
  const { group, add } = carvedPiece(renderer,'Ruby rook — six broad fortress cuts','rook');
  const crown=add(createRookCrownGeometry(),'Carved hexagonal tower with bevelled merlons',null,true);
  const veins=[];
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3;
    const point=(r,y,t=0)=>[Math.cos(a)*r-Math.sin(a)*t,y,Math.sin(a)*r+Math.cos(a)*t];
    veins.push([point(.175,.91),point(.20,1.06),point(.228,1.18),point(.228,1.293)]);
    veins.push([point(.228,1.293,-.052),point(.228,1.293,.052)]);
  }
  setGemVeins(crown.material,veins,{type:'rook',width:.006});
  group.rotation.y=Math.PI/12;
  return group;
}
