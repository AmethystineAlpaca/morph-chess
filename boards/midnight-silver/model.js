import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStoneMaterials, createCraftMetalMaterials } from './materials.js';

export const SURFACE_HEIGHT=.025;
export function createBoardModel(renderer, onLoad){
  const group=new THREE.Group(),ornaments=new THREE.Group();group.add(ornaments);
  const {stone,materials}=createStoneMaterials(renderer, onLoad);
  const {silver,bright,shaded,darkMetal,gold,satin,recess}=createCraftMetalMaterials(renderer);
  const frameStone=stone(false,3,true);
  const add=(geometry,material,x=0,y=0,z=0,parent=group)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const slab=(width,height,y,material,r=.035)=>{
    const geometry=new RoundedBoxGeometry(width,height,width,3,r);
    if(material===frameStone){
      // World-scaled veins on vertical walls, rather than a square photograph
      // stretched over a long, narrow face of the stone slab.
      const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
      for(let i=0;i<p.count;i++){
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
        if(ny>nx&&ny>nz)uv.setXY(i,p.getX(i),p.getZ(i));
        else if(nx>nz)uv.setXY(i,p.getZ(i),p.getY(i)+y);
        else uv.setXY(i,p.getX(i),p.getY(i)+y);
      }
    }
    return add(geometry,material,0,y);
  };
  // Stepped jewelry-box profile: narrow highlight, shadow reveal, stone body,
  // lower silver fillet, and a separate beveled plinth.
  slab(9.48,.09,-.49,darkMetal);
  slab(9.52,.05,-.425,bright,.015);
  slab(9.43,.35,-.245,frameStone,.045);
  slab(9.49,.032,-.075,silver,.012);
  slab(9.39,.048,-.038,darkMetal,.012);
  slab(8.12,.035,-.043,shaded,.012);
  const tileGeometry=new RoundedBoxGeometry(.994,.075,.994,2,.008);
  const dark=Array.from({length:8},(_,i)=>stone(false,i));
  const light=Array.from({length:8},(_,i)=>stone(true,i+8));
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const material=(row+col)%2===0?light[(row*3+col)%8]:dark[(row*3+col)%8];
    add(tileGeometry,material,col-3.5,SURFACE_HEIGHT-.0375,row-3.5);
  }
  const settings=[[-4.34,-4.34],[-4.34,4.34],[4.34,-4.34],[4.34,4.34],[0,-4.34],[0,4.34],[-4.34,0],[4.34,0]];
  const frame=new THREE.Shape();frame.moveTo(-4.68,-4.68);frame.lineTo(4.68,-4.68);frame.lineTo(4.68,4.68);frame.lineTo(-4.68,4.68);frame.closePath();
  const hole=new THREE.Path();hole.moveTo(-4.025,-4.025);hole.lineTo(-4.025,4.025);hole.lineTo(4.025,4.025);hole.lineTo(4.025,-4.025);hole.closePath();frame.holes.push(hole);
  // Actual openings in the stone, with separate dished seats and metal bezels.
  // These shallow settings cast their own contact shadows at inspection scale.
  for(const [x,z] of settings){
    const pocket=new THREE.Path();pocket.absarc(x,-z,.283,0,Math.PI*2,true);frame.holes.push(pocket);
  }
  const frameGeometry=new THREE.ExtrudeGeometry(frame,{depth:.12,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.018,bevelThickness:.018,curveSegments:48});frameGeometry.rotateX(-Math.PI/2);
  add(frameGeometry,frameStone,0,-.12);
  const wires=[],grooves=[],brightFacets=[],darkFacets=[];
  const bezelProfile=[[.249,-.025],[.273,-.025],[.284,-.009],[.287,.011],[.297,.018],[.297,.024],[.291,.028],[.28,.024],[.275,.015],[.256,.006]].map(([r,y])=>new THREE.Vector2(r,y));
  const bezelGeometry=new THREE.LatheGeometry(bezelProfile,96);
  const seatGeometry=new THREE.CylinderGeometry(.26,.262,.024,80);
  for(const [x,z] of settings){
    add(bezelGeometry,gold,x,0,z);
    const seat=add(seatGeometry,recess,x,-.007,z);seat.castShadow=false;
    // Four polished staking heads are nearly flush with each bezel shoulder.
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+Math.PI/4;
      const head=add(new THREE.SphereGeometry(.014,12,8),bright,x+Math.cos(a)*.281,.023,z+Math.sin(a)*.281);
      head.scale.y=.38;head.castShadow=false;head.receiveShadow=false;
    }
  }

  // Sub-pixel metalwork must not sample its own low-resolution shadow map.
  // The surrounding slab still casts and receives the board's real shadows.
  function detailMesh(geometry,material,parent){
    const mesh=add(geometry,material,0,0,0,parent);
    mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
  }
  function wire(points,r=.008,parent=group,material=silver){
    // Sample every authored corner, including the short chamfers. Uniform
    // arc-length samples skip these corners and produce diagonal/twisted rails.
    const vertices=points.map(p=>new THREE.Vector3(...p));
    const count=vertices.length-1,closed=vertices[0].equals(vertices[count]);
    const path=new THREE.Curve();
    path.getPointAt=(u,target=new THREE.Vector3())=>{
      const t=u*count,i=Math.min(Math.floor(t),count-1);
      return target.copy(vertices[i]).lerp(vertices[i+1],t-i);
    };
    path.getTangentAt=(u,target=new THREE.Vector3())=>{
      const t=u*count,i=Math.round(t);
      if(Math.abs(t-i)<1e-6){
        const before=i>0?i-1:(closed?count-1:0);
        const after=i<count?i+1:(closed?1:count);
        const incoming=vertices[i].clone().sub(vertices[before]).normalize();
        const outgoing=vertices[after].clone().sub(vertices[i]).normalize();
        return target.copy(incoming).add(outgoing).normalize();
      }
      const k=Math.min(Math.floor(t),count-1);
      return target.subVectors(vertices[k+1],vertices[k]).normalize();
    };
    const geometry=new THREE.TubeGeometry(path,count,r,12,false);
    if(parent===ornaments&&material===silver){
      // A wider, flattened dark shoulder reads as the chase cut around the
      // metal insert; the silver itself has its root buried into the surface.
      const groove=new THREE.TubeGeometry(path,count,r+.006,12,false);
      const positions=groove.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setY(i,.019+(positions.getY(i)-.023)*.10);
      groove.computeVertexNormals();grooves.push(groove);wires.push(geometry);
    }else detailMesh(geometry,material,parent);
  }
  function ring(r,y,thickness,material=silver){const k=.035;wire([[-r+k,y,-r],[r-k,y,-r],[r,y,-r+k],[r,y,r-k],[r-k,y,r],[-r+k,y,r],[-r,y,r-k],[-r,y,-r+k],[-r+k,y,-r]],thickness,group,material);}
  ring(4.02,.026,.012,bright);ring(4.65,.026,.011,bright);
  ring(4.726,-.13,.009);ring(4.724,-.335,.008);ring(4.735,-.405,.009,bright);
  function ellipse(x,z,rx,rz,angle=0){const pts=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,u=Math.cos(a)*rx,v=Math.sin(a)*rz;pts.push([x+u*Math.cos(angle)-v*Math.sin(angle),.023,z+u*Math.sin(angle)+v*Math.cos(angle)]);}wire(pts,.007,ornaments);}
  // Tiny faceted inlays have a raised central ridge and alternate bright/dark
  // faces. Their highlights move with the camera, unlike a painted decal.
  function star(x,z,r,compass){
    if(compass){
      // A solid star body connects the faceted upper relief to its recessed bed.
      const outline=new THREE.Shape();
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8,rad=i%2?r*.32:(i%4?r*.66:r);
        const u=x+Math.cos(a)*rad,v=-z-Math.sin(a)*rad;
        i?outline.lineTo(u,v):outline.moveTo(u,v);
      }
      outline.closePath();
      const relief=new THREE.ExtrudeGeometry(outline,{depth:.013,bevelEnabled:true,bevelSize:.003,bevelThickness:.0025,bevelSegments:2,steps:1});relief.rotateX(-Math.PI/2);
      add(relief,satin,0,.006,0,ornaments);
    }
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,tip=i%2?r*.66:r,spread=.38;
      const c=[x,.044,z],p=[x+Math.cos(a)*tip,.024,z+Math.sin(a)*tip];
      const l=[x+Math.cos(a-spread)*r*.32,.022,z+Math.sin(a-spread)*r*.32];
      const q=[x+Math.cos(a+spread)*r*.32,.022,z+Math.sin(a+spread)*r*.32];
      for(const [vertices,mat] of [[ [...c,...l,...p],bright],[[...c,...p,...q],shaded]]){
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([vertices[0],vertices[2],vertices[3],vertices[5],vertices[6],vertices[8]],2));geo.computeVertexNormals();
        (mat===bright?brightFacets:darkFacets).push(geo);
      }
    }
    if(compass)for(let i=0;i<16;i++){const a=i/16*Math.PI*2;wire([[x+Math.cos(a)*r*1.15,.023,z+Math.sin(a)*r*1.15],[x+Math.cos(a)*r*(i%3?1.22:1.3),.023,z+Math.sin(a)*r*(i%3?1.22:1.3)]],.005,ornaments);}
  }
  for(const x of [-4.34,4.34])for(const z of [-4.34,4.34])star(x,z,.215,true);
  for(let side=0;side<4;side++){
    const a=side*Math.PI/2;
    const xy=(x,z)=>[x*Math.cos(a)-z*Math.sin(a),x*Math.sin(a)+z*Math.cos(a)];
    star(...xy(0,-4.34),.21,true);
    for(const x of [-3.1,-1.45,1.45,3.1])star(...xy(x,-4.34),.105,false);
    for(const x of [-2.25,2.25]){
      const [u,v]=xy(x,-4.34);ellipse(u,v,.86,.20,a+.08);ellipse(u,v,.73,.115,a-.15);
    }
    for(const x of [-3.6,-.8,.8,3.6]){const [u,v]=xy(x,-4.34);ellipse(u,v,.019,.019);}
  }
  detailMesh(mergeGeometries(grooves),recess,ornaments);
  detailMesh(mergeGeometries(wires),silver,ornaments);
  bright.side=shaded.side=THREE.DoubleSide;
  detailMesh(mergeGeometries(brightFacets),bright,ornaments);
  detailMesh(mergeGeometries(darkFacets),shaded,ornaments);
  for(const geo of [...wires,...grooves,...brightFacets,...darkFacets])geo.dispose();
  // Small miter seams describe how the four polished frame members meet.
  // Each joint stops at the setting instead of crossing its decorative face.
  for(const sx of [-1,1])for(const sz of [-1,1]){
    for(const [a,b] of [[4.045,4.125],[4.555,4.645]]){
      wire([[sx*a,.017,sz*a],[sx*b,.017,sz*b]],.0045,group,recess);
    }
    // A tiny flush fixing pin on the side of each corner collar.
    const pin=add(new THREE.CylinderGeometry(.026,.026,.007,24),bright,sx*4.38,-.24,sz*4.719);
    pin.rotation.x=Math.PI/2;pin.castShadow=false;
  }
  // Turned metal feet echo the machined rim, including a dark inset reveal.
  const profile=[[.20,0],[.28,.02],[.30,.045],[.30,.065],[.25,.085],[.23,.105],[.23,.15],[.29,.18],[.29,.22]].map(([r,y])=>new THREE.Vector2(r,y));
  const footGeometry=new THREE.LatheGeometry(profile,48);
  // Very shallow axial tooling remains in the satin waist of each turned foot.
  const fp=footGeometry.attributes.position;
  for(let i=0;i<fp.count;i++){
    const x=fp.getX(i),z=fp.getZ(i),y=fp.getY(i),angle=Math.atan2(z,x);
    const pressure=Math.sin(Math.max(0,Math.min(1,(y-.06)/.12))*Math.PI);
    const scale=1+Math.cos(angle*24)*.008*pressure;fp.setX(i,x*scale);fp.setZ(i,z*scale);
  }
  footGeometry.computeVertexNormals();
  for(const x of [-4.35,4.35])for(const z of [-4.35,4.35]){
    add(footGeometry,silver,x,-.72,z);
    add(new THREE.CylinderGeometry(.274,.274,.014,48),recess,x,-.697,z);
    add(new THREE.CylinderGeometry(.276,.276,.009,48),bright,x,-.666,z);
  }
  return {group,ornaments,materials,surfaceHeight:SURFACE_HEIGHT};
}
