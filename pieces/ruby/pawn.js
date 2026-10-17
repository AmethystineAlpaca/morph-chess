import * as THREE from 'three';
import { jewelryStudio, gemstoneMaterial } from './material.js';
import { bodyProfile } from './design.js';
import { cutRubyStudio, cutRubyMaterial } from './cut-ruby.js';
import { setGemVeins } from './glow-veins.js';

export function createRubyPawn(renderer) {
  const lighting=jewelryStudio(renderer);
  const cutLighting=cutRubyStudio(renderer);
  const pawn=new THREE.Group();
  pawn.name='Ruby pawn — classic carved jewel';
  const profile=bodyProfile('pawn');
  const bodyGeometry=new THREE.LatheGeometry(profile,48);
  const body=new THREE.Mesh(bodyGeometry,gemstoneMaterial(bodyGeometry,lighting.cube.texture,profile));
  const headGeometry=new THREE.IcosahedronGeometry(.135,1);
  headGeometry.rotateZ(Math.atan((1+Math.sqrt(5))/2)-Math.PI/2);
  headGeometry.computeVertexNormals();
  const head=new THREE.Mesh(headGeometry,cutRubyMaterial(headGeometry,cutLighting.cube.texture));
  head.position.y=.815;
  head.name='Small faceted pawn head';
  setGemVeins(head.material,[
    [[-.065,-.05,0],[0,.018,.025],[.04,.077,0]],
    [[.055,-.06,-.025],[0,.018,.025],[-.015,.05,-.072]],
  ],{width:.005});
  head.rotation.y=.19;
  const eye=new THREE.Vector3();
  for(const mesh of [body,head]) mesh.onBeforeRender=(_renderer,_scene,camera)=>{
    camera.getWorldPosition(eye);
    mesh.material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
  };
  for(const mesh of [body,head]) {mesh.castShadow=true;mesh.receiveShadow=true;mesh.renderOrder=2;pawn.add(mesh);}
  pawn.rotation.y=Math.PI/24;
  return pawn;
}
