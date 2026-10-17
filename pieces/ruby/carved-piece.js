import * as THREE from 'three';
import { jewelryStudio, gemstoneMaterial } from './material.js';
import { bodyProfile, designGeometry } from './design.js';
import { cutRubyStudio, cutRubyMaterial } from './cut-ruby.js';

// Shared revised body for R2/B4; their upper identifying shapes stay distinct.
export function carvedPiece(renderer, name, type) {
  const { cube } = jewelryStudio(renderer);
  const cutLighting=cutRubyStudio(renderer);
  const group = new THREE.Group();
  group.name = name;
  const eye = new THREE.Vector3();
  function add(geometry, name, profile = null, concave = false) {
    // Construct optical acceleration only after baking the revised proportions.
    const upper = profile === null;
    if (upper) designGeometry(type,geometry);
    const material = upper
      ? cutRubyMaterial(geometry,cutLighting.cube.texture,concave)
      : gemstoneMaterial(geometry,cube.texture,profile,concave);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(eye);
      mesh.material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
    };
    group.add(mesh);
    return mesh;
  }
  const profile=bodyProfile(type);
  add(new THREE.LatheGeometry(profile,48),'Tapered foot, waist and single collar',profile);
  return { group, add };
}

// Closed ring loft with outward-facing triangles, also used for concave cuts.
export function ringLoft(rings) {
  const vertices = [];
  const tri = (a,b,c) => vertices.push(...a,...b,...c);
  const n = rings[0].length;
  for(let k=0;k<rings.length-1;k++) for(let j=0;j<n;j++) {
    const next=(j+1)%n;
    tri(rings[k][j],rings[k+1][j],rings[k][next]);
    tri(rings[k][next],rings[k+1][j],rings[k+1][next]);
  }
  for(let j=1;j<n-1;j++) {
    tri(rings[0][0],rings[0][j],rings[0][j+1]);
    tri(rings.at(-1)[0],rings.at(-1)[j+1],rings.at(-1)[j]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}
