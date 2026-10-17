import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// Concept B: an equine side silhouette divided into three intentional planes.
// A mitered inset makes the perimeter chamfer. A tapered eyelid cut is carved
// into each cheek, fading back into the broad plane at its tips.
const outline = [
  [-.14,.235], [-.18,.355], [.025,.77], [-.07,.79],
  [-.20,.74], [-.25,.69], [-.315,.71], [-.34,.79],
  [-.12,1.04], [0,1.065], [.20,.94], [.25,.58], [.13,.235],
].map(p => new THREE.Vector2(...p));

// Outline is clockwise. Its right-hand edge normals point into the solid.
function insetPolygon(points, distance) {
  return points.map((point,i) => {
    const before=point.clone().sub(points[(i+points.length-1)%points.length]).normalize();
    const after=points[(i+1)%points.length].clone().sub(point).normalize();
    const a=new THREE.Vector2(before.y,-before.x), b=new THREE.Vector2(after.y,-after.x);
    return point.clone().add(a.clone().add(b).multiplyScalar(distance/(1+a.dot(b))));
  });
}

export function createKnightBodyGeometry({ sculptedEyes=true, sculptedDetails=true } = {}) {
  const inset=insetPolygon(outline,.018), n=outline.length;
  const vertices=[], indices=[];
  // The long diagonal runs from the front foot to the back of the poll. Each
  // cheek remains coplanar even though it is tessellated for the GPU.
  const ridgeA=inset[1], ridgeB=inset[10];
  const ridgeDirection=ridgeB.clone().sub(ridgeA).normalize();
  const ridgeNormal=new THREE.Vector2(ridgeDirection.y,-ridgeDirection.x);
  const noseA=inset[3], noseB=inset[8];
  const noseDirection=noseB.clone().sub(noseA).normalize();
  const noseNormal=new THREE.Vector2(noseDirection.y,-noseDirection.x);
  const depth=(p,i) => .155 - .20*Math.abs(p.clone().sub(ridgeA).dot(ridgeNormal))
    - (i>=4 && i<=7 ? .10*Math.max(0,-p.clone().sub(noseA).dot(noseNormal)) : 0);
  for(const side of [1,-1]) {
    for(const p of outline) vertices.push([p.x,p.y,side*.05]);
    for(const [i,p] of inset.entries()) vertices.push([p.x,p.y,side*depth(p,i)]);
  }
  // Recesses are carved into the same watertight boundary. The two muzzle
  // details are smaller and shallower than the eye, leaving the large facets.
  const eyeShade=vertices.map(()=>0), cuts=[];
  const eyelid=new THREE.Shape();
  eyelid.moveTo(-.045,0);
  eyelid.bezierCurveTo(-.025,-.011,.015,-.009,.045,.004);
  eyelid.bezierCurveTo(.025,.014,-.008,.010,-.045,0);
  if(sculptedEyes) cuts.push({panel:1, center:[-.045,.957], angle:.25,
    points:eyelid.getPoints(5).slice(0,-1), half:.045, recess:.008, shade:1, depthIndex:2});
  if(sculptedDetails) {
    const nostril=new THREE.Shape();
    nostril.moveTo(-.018,0);
    nostril.bezierCurveTo(-.010,-.008,.011,-.008,.019,.002);
    nostril.bezierCurveTo(.006,.009,-.007,.005,-.018,0);
    cuts.push({panel:2,center:[-.282,.798],angle:.65,
      points:nostril.getPoints(4).slice(0,-1),half:.019,recess:.005,shade:.62,depthIndex:5});
    // A tapered lip seam follows the muzzle's lower plane, with closed ends.
    cuts.push({panel:2,center:[-.264,.745],angle:.36,
      points:[[-.036,0],[-.017,-.0035],[.019,-.002],[.036,.001],[.012,.0035],[-.016,.003]].map(p=>new THREE.Vector2(...p)),
      half:.036,recess:.0035,shade:.46,depthIndex:5});
  }
  for(const cut of cuts) {
    const center=new THREE.Vector2(...cut.center);
    const transform=p=>p.clone().rotateAround(new THREE.Vector2(),cut.angle).add(center);
    cut.outline=cut.points.map(transform);cut.rings=[];
    for(const side of [1,-1]) {
      const outer=[],inner=[],innerPoints=[];
      const sample=center.clone(),d=depth(sample,cut.depthIndex),epsilon=.0001;
      const dx=(depth(sample.clone().add(new THREE.Vector2(epsilon,0)),cut.depthIndex)-d)/epsilon;
      const dy=(depth(sample.clone().add(new THREE.Vector2(0,epsilon)),cut.depthIndex)-d)/epsilon;
      const normal=new THREE.Vector3(-dx,-dy,side).normalize();
      for(const ring of [outer,inner]) for(const [i,point] of cut.points.entries()) {
        const strength=Math.sqrt(Math.max(0,1-(point.x/cut.half)**2));
        const recessed=ring===inner;
        const p=transform(recessed ? new THREE.Vector2(point.x*.82,point.y*.20+.0006) : point);
        const vertex=new THREE.Vector3(p.x,p.y,side*depth(p,cut.depthIndex))
          .addScaledVector(normal,recessed?-cut.recess*strength:0);
        ring.push(vertices.length);vertices.push(vertex.toArray());
        eyeShade.push(recessed?strength*cut.shade*(i>cut.points.length/2?.9:.45):0);
        if(recessed)innerPoints.push(new THREE.Vector2(vertex.x,vertex.y));
      }
      cut.rings.push({outer,inner,innerPoints,side});
    }
  }
  const quad=(a,b,c,d) => indices.push(a,b,c,a,c,d);
  for(let i=0;i<n;i++) {
    const j=(i+1)%n;
    // Front bevel, the narrow edge, and the back bevel share exact boundaries.
    quad(i,n+i,n+j,j);
    quad(i,j,2*n+j,2*n+i);
    quad(2*n+i,2*n+j,3*n+j,3*n+i);
  }
  const panels=[
    [0,1,10,11,12], // back of neck, one broad plane
    [1,2,3,8,9,10], // throat and cheek, one broad plane
    [3,4,5,6,7,8], // tapered muzzle, one broad plane
  ];
  for(const [panelIndex,panel] of panels.entries()) {
    const panelCuts=cuts.filter(cut=>cut.panel===panelIndex);
    if(panelCuts.length) {
      const triangles=THREE.ShapeUtils.triangulateShape(panel.map(i=>inset[i]),panelCuts.map(cut=>cut.outline));
      for(const [sideIndex,side] of [1,-1].entries()) {
        const mapped=[...panel.map(i=>(sideIndex?3*n:n)+i),...panelCuts.flatMap(cut=>cut.rings[sideIndex].outer)];
        const face=(a,b,c)=>indices.push(a,side>0?b:c,side>0?c:b);
        for(const triangle of triangles) face(...triangle.map(i=>mapped[i]));
        for(const cut of panelCuts) {
          const {outer,inner,innerPoints}=cut.rings[sideIndex];
          for(let i=0;i<outer.length;i++) {
            const j=(i+1)%outer.length;
            face(outer[i],outer[j],inner[j]);face(outer[i],inner[j],inner[i]);
          }
          for(const triangle of THREE.ShapeUtils.triangulateShape(innerPoints,[]))
            face(...triangle.map(i=>inner[i]));
        }
      }
      continue;
    }
    const triangles=THREE.ShapeUtils.triangulateShape(panel.map(i=>inset[i]),[]);
    for(const triangle of triangles) {
      const [a,b,c]=triangle.map(i=>panel[i]);
      indices.push(n+a,n+b,n+c,3*n+a,3*n+c,3*n+b);
    }
  }
  // Keep every boundary outward-facing for the ruby's internal ray tracing.
  let volume=0;
  for(let i=0;i<indices.length;i+=3) {
    const [a,b,c]=indices.slice(i,i+3).map(j=>new THREE.Vector3(...vertices[j]));
    volume+=a.dot(b.cross(c));
  }
  if(volume<0) for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const indexed=new THREE.BufferGeometry();
  indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  indexed.setAttribute('rubyEyeShade',new THREE.Float32BufferAttribute(eyeShade,1));
  indexed.setIndex(indices);
  const geometry=indexed.toNonIndexed();indexed.dispose();
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

export function createKnightEarGeometry(side) {
  const center=side*.085, points=[];
  for(const sign of [-1,1]) {
    points.push(new THREE.Vector3(-.09,1.015,center+sign*.035));
    points.push(new THREE.Vector3(.005,1.035,center+sign*.035));
    points.push(new THREE.Vector3(-.12,1.16,center+sign*.009));
  }
  return new ConvexGeometry(points);
}
