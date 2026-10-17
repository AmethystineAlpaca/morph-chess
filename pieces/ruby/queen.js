import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { jewelryStudio, gemstoneMaterial } from './material.js';
import { bodyProfile, designGeometry } from './design.js';
import { cutRubyStudio, cutRubyMaterial } from './cut-ruby.js';
import { ringCenters, setGemVeins } from './glow-veins.js';

// Multi-view concept approved 2026-10-17: broad six-petal coronet and cut tips.
// Height 1.54, foot diameter .70; crown retains its six open petals.
export function createRubyQueen(renderer) {
  const lighting = jewelryStudio(renderer);
  const cutLighting = cutRubyStudio(renderer);
  const queen = new THREE.Group();
  queen.name = 'Ruby queen — classic coronet / concept 01';
  const eye = new THREE.Vector3();
  function add(geometry, profile = null, concave = false) {
    if (!profile) designGeometry('queen',geometry);
    const material = profile ? gemstoneMaterial(geometry, lighting.cube.texture, profile, concave)
      : cutRubyMaterial(geometry, cutLighting.cube.texture, concave);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(eye);
      mesh.material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
    };
    queen.add(mesh);
    return mesh;
  }
  const profile=bodyProfile('queen');
  add(new THREE.LatheGeometry(profile,48),profile);
  function jewel(points) {
    return add(new ConvexGeometry(points.map(p => new THREE.Vector3(...p))));
  }
  // Low polygonal cup joins the six broad prongs into one carved crown.
  // Each convex component has its own exact facet intersections in the shader.
  const cup = [];
  for (let i=0;i<12;i++) {
    const angle=i*Math.PI/6;
    for(const [r,y] of [[.205,1.16],[.235,1.225]])
      cup.push([r*Math.cos(angle),y,r*Math.sin(angle)]);
  }
  jewel(cup);
  // Sweep eight-sided jewel sections along a gradually flaring curve.
  // Trace the actual triangles: a convex hull would straighten the inner bend.
  const sections = [
    // radius, height, tangential half-width, radial half-depth
    [.19,1.17,.145,.065],
    [.218,1.245,.132,.074],
    [.258,1.32,.100,.070],
    [.303,1.395,.067,.050],
    [.348,1.465,.033,.027],
    [.369,1.49,.026,.023],
    // Broad diamond terminals follow the outward lean of each crown petal.
    [.39,1.515,.055,.047],
    [.415,1.555,.043,.037],
    [.44,1.595,.002,.002],
  ];
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    const rings=sections.map(([radius,y,width,depth]) =>
      Array.from({length:8},(_,j) => {
        const theta=j*Math.PI/4;
        const r=radius+Math.sin(theta)*depth;
        const t=Math.cos(theta)*width;
        return new THREE.Vector3(r*Math.cos(angle)-t*Math.sin(angle),y,
          r*Math.sin(angle)+t*Math.cos(angle));
      }));
    const vertices=[];
    const triangle=(a,b,c)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
    for(let k=0;k<rings.length-1;k++) for(let j=0;j<8;j++) {
      const next=(j+1)%8;
      triangle(rings[k][j],rings[k][next],rings[k+1][j]);
      triangle(rings[k][next],rings[k+1][next],rings[k+1][j]);
    }
    for(let j=1;j<7;j++) {
      triangle(rings[0][0],rings[0][j+1],rings[0][j]);
      const last=rings.at(-1);
      triangle(last[0],last[j],last[j+1]);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    const petal=add(geometry,null,true);
    const centers=ringCenters(rings);centers[0].lerp(centers[1],.2);centers.at(-1).lerp(centers.at(-2),.16);
    setGemVeins(petal.material,[centers],{type:'queen',width:.006});
  }
  const center=[];
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    for(const [r,y] of [[.14,1.20],[.155,1.35],[.115,1.50],[.052,1.535]])
      center.push([r*Math.cos(angle),y,r*Math.sin(angle)]);
  }
  const centerMesh=jewel(center);
  setGemVeins(centerMesh.material,[[[0,1.23,0],[.025,1.38,.02],[0,1.50,0]]],{type:'queen',width:.006});
  // A sharply cut elongated finial, seated in the central crown spindle.
  const finial=[];
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    for(const [r,y] of [[.042,1.53],[.095,1.58],[.105,1.645],[.065,1.70]])
      finial.push([r*Math.cos(angle),y,r*Math.sin(angle)]);
  }
  finial.push([0,1.74,0]);
  const tip=jewel(finial);
  setGemVeins(tip.material,[[[0,1.56,0],[.018,1.64,0],[0,1.71,0]]],{type:'queen',width:.005});
  // Present the six points between symmetry axes so their silhouettes separate.
  queen.rotation.y=Math.PI/6;
  return queen;
}
