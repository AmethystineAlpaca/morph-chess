import * as THREE from 'three';
import { jewelryStudio } from './material.js';
import { createKnightBodyGeometry, createKnightEarGeometry } from './knight-geometry.js';
import { createKnightRubyMaterial } from './knight-material.js';
import { cutRubyStudio } from './cut-ruby.js';
import { setGemVeins } from './glow-veins.js';

export function createRubyKnight(renderer) {
  const group = new THREE.Group();
  group.name = 'Ruby knight — broad geometric cuts / concept B';
  const lighting = jewelryStudio(renderer);
  const cutLighting = cutRubyStudio(renderer);
  const eye = new THREE.Vector3();
  function add(geometry, name, profile = null, opticalGeometry = geometry) {
    const material = createKnightRubyMaterial(geometry, (profile?lighting:cutLighting).cube.texture, profile, false, opticalGeometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = 2;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(eye);
      mesh.material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
    };
    group.add(mesh);
    return mesh;
  }
  const profile = [[0,0],[.25,0],[.28,.03],[.28,.065],[.255,.105],
    [.21,.15],[.155,.20],[.15,.24],[0,.24]]
    .map(([r,y]) => new THREE.Vector2(r,y));
  add(new THREE.LatheGeometry(profile,48), 'Turned ruby plinth', profile);
  // Eyelid, nostril and lip seam are carved into the visible mesh. Internal
  // refraction follows the broad envelope, avoiding far-side detail ghosts.
  const opticalBody=createKnightBodyGeometry({sculptedEyes:false,sculptedDetails:false});
  const head=add(createKnightBodyGeometry(), 'Broad ruby planes with carved eyelid, nostril and lip seam', null, opticalBody);
  // Two buried cheek paths describe the poll, muzzle and rising neck from both
  // sides. They stay below the existing eye carving and away from the outline.
  const veins=[];
  for(const side of [-1,1]) {
    const z=side*.052;
    veins.push([[.04,.40,z],[.12,.67,z],[.10,.91,z],[-.025,.995,z],[-.14,.925,z],[-.275,.79,z]]);
    veins.push([[.10,.91,z],[-.055,.86,z],[-.20,.785,z]]);
  }
  setGemVeins(head.material,veins,{width:.006});
  opticalBody.dispose();
  for (const side of [-1,1]) {
    const ear=add(createKnightEarGeometry(side), 'Tapered ruby ear');
    setGemVeins(ear.material,[[[-.047,1.045,side*.085],[-.102,1.13,side*.085]]],{width:.004});
  }
  group.rotation.y = .85;
  return group;
}
