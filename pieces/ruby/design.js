import * as THREE from 'three';

// One board square = one unit. Dimensions belong to the asset, not placement.
export const RUBY_DIMENSIONS = Object.freeze({
  pawn: { height: .95, base: .46 }, rook: { height: 1.05, base: .52 },
  knight: { height: 1.16, base: .56 }, bishop: { height: 1.30, base: .60 },
  queen: { height: 1.54, base: .70 }, king: { height: 1.72, base: .76 },
});
const heights = {
  rook: [[0,0],[.855,.65],[1.02,.76],[1.205,.90],[1.335,1.05]],
  bishop: [[0,0],[.86,.65],[.96,.73],[1.17,.92],[1.39,1.10],[1.52,1.18],[1.68,1.30]],
  queen: [[0,0],[1.16,.99],[1.225,1.055],[1.595,1.425],[1.74,1.54]],
  knight: [[0,0],[.491,.24],[.80,.47],[1.20,.80],[1.64,1.16]],
};
export function designPoint(type, point) {
  const keys=heights[type], width={rook:.80,bishop:.90,queen:.84,knight:.72}[type];
  const originalY=point.y;
  let end=1;
  while(end<keys.length-1 && originalY>keys[end][0]) end++;
  const [a,b]=[keys[end-1],keys[end]];
  point.y=THREE.MathUtils.lerp(a[1],b[1],(originalY-a[0])/(b[0]-a[0]));
  point.x*=width; point.z*=width;
  return point;
}
// Bake proportions before constructing optical boundaries/BVH.
export function designGeometry(type, geometry) {
  const positions=geometry.attributes.position, point=new THREE.Vector3();
  for(let i=0;i<positions.count;i++) {
    designPoint(type,point.fromBufferAttribute(positions,i));
    positions.setXYZ(i,point.x,point.y,point.z);
  }
  positions.needsUpdate=true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
// One shoulder and one collar: continuous volume, fewer optical surface tests.
export function bodyProfile(type) {
  const r=RUBY_DIMENSIONS[type].base/2;
  const top={pawn:.735,rook:.67,bishop:.67,queen:1.005,king:.99}[type];
  return [[0,0],[r*.88,0],[r,.035],[r,.075],[r*.90,.12],
    [r*.74,.16],[r*.68,.20],[r*.54,top*.39],[r*.38,top*.60],
    [r*.37,top*.74],[r*.45,top*.85],[r*.61,top*.91],
    [r*.65,top*.94],[r*.65,top*.97],[r*.52,top],[0,top]]
    .map(([radius,y])=>new THREE.Vector2(radius,y));
}
