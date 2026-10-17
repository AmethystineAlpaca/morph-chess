import * as THREE from 'three';

// A sparse composition leaves most of the mirror visible. Models are supplied
// by the set registry, so the board never depends on a specific piece factory.
export function attachPieceCollection({ renderer, scene, sampleHeight }, pieceSet) {
  const group = new THREE.Group(); group.name = 'Ruby collection on the Dusk Mirror';
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), fade = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  fade.addColorStop(0, 'rgba(5,0,4,.5)'); fade.addColorStop(.65, 'rgba(5,0,4,.2)'); fade.addColorStop(1, 'rgba(5,0,4,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const pairs = [];
  for (const [type, x, z] of [['rook', -2.5, 2.5], ['knight', -.5, 2.5], ['queen', 1.5, 2.5]]) {
    const piece = pieceSet.create(type, renderer); piece.position.set(x, sampleHeight(x, z), z);
    if (type === 'knight') piece.rotation.y = -.5;
    piece.traverse(o => { if (o.isMesh) o.castShadow = false; }); group.add(piece);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, piece.position.y + .003, z); shadow.renderOrder = 1; group.add(shadow);
    pairs.push([piece, shadow]);
  }
  scene.add(group);
  return { group, update() { for (const [piece, shadow] of pairs) { piece.position.y = sampleHeight(piece.position.x, piece.position.z); shadow.position.y = piece.position.y + .003; } } };
}

export function attachPieceSample({renderer,scene,camera,controls,sampleHeight},pieceSet){
const rubyPawn=pieceSet.create('pawn',renderer);
rubyPawn.position.set(.5,.69,.5);
scene.add(rubyPawn);
rubyPawn.traverse(o=>{if(o.isMesh)o.castShadow=false;});
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
const contactContext=contactCanvas.getContext('2d');
const contactGradient=contactContext.createRadialGradient(64,64,10,64,64,62);
contactGradient.addColorStop(0,'rgba(52,10,13,.24)');contactGradient.addColorStop(.6,'rgba(52,10,13,.12)');contactGradient.addColorStop(1,'rgba(52,10,13,0)');
contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
const contactTexture=new THREE.CanvasTexture(contactCanvas);contactTexture.colorSpace=THREE.SRGBColorSpace;
const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.05),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
contactShadow.rotation.x=-Math.PI/2;contactShadow.renderOrder=1;scene.add(contactShadow);
const inspectPawn=document.createElement('button');
inspectPawn.id='inspect-pawn';inspectPawn.textContent='Inspect Ruby Pawn ↗';
inspectPawn.style.cssText='display:block;width:100%;border-top:1px solid #ded9cc;margin-top:10px;padding-top:14px';
document.querySelector('aside').append(inspectPawn);
inspectPawn.onclick=()=>{controls.target.set(.5,1.4,.5);camera.position.set(2.8,2.55,4.2);controls.update();};

return {update(){
  rubyPawn.position.y=sampleHeight(rubyPawn.position.x,rubyPawn.position.z);
  contactShadow.position.set(rubyPawn.position.x,rubyPawn.position.y+.003,rubyPawn.position.z);
}};
}
