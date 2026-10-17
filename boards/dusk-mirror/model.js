import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createOptics } from './materials.js';
import { createOpticalTiles, createNerveDetails, insetCrystalFaces } from './details.js';

export const SURFACE_HEIGHT = .012;
export const BOARD_SIZE = 8;

export function createBoardModel(renderer) {
  const group = new THREE.Group(); group.name = 'Dusk Mirror — approved crystal board';
  const optics = createOptics(renderer);
  const glass = optics.glass();
  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const body = add(new RoundedBoxGeometry(8.46, .29, 8.46, 2, .065), glass, 'Continuous beveled smoke-glass body');
  body.position.y = -.16;
  add(createOpticalTiles(SURFACE_HEIGHT), optics.glass({ checker: true }), '64 optical cells / double lapped micro-bevel');
  // The underside keeps the optical grid visible through the smoky volume.
  const underside = add(new THREE.PlaneGeometry(8, 8), optics.glass({ checker: true }), 'Underside of the optical field');
  underside.rotation.x = Math.PI / 2; underside.position.y = -.307;

  const railGeometries = [], highlights = [], lowerArrises = [];
  const map = (x, y, z, side) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI / 2);
  for (let side = 0; side < 4; side++) {
    const positions = [], index = [], outerCurve = [], innerCurve = [], lowerCurve = [];
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments * 2 - 1, x = t * 4.2;
      const lift = .035 + Math.pow(Math.abs(t), 12) * .37;
      const width = .24 + Math.pow(Math.abs(t), 10) * .13;
      // Narrow secondary arrises separate the polished lip, broad inner scoop,
      // outer bevel and recessed lower edge without adding decorative trim.
      const profile = [[4.0,.006],[4.012,.011],[4.07,lift*.5],[4.0+width-.012,lift-.002],[4.0+width,lift],
        [4.0+width+.012,lift-.018],[4.0+width+.015,-.12+lift*.38],[4.18,-.275],[4.15,-.295],[4.0,-.24]];
      for (const [z, y] of profile) positions.push(...map(x, y, z, side).toArray());
      outerCurve.push(map(x, lift + .003, 4.0 + width, side));
      innerCurve.push(map(x, lift * .5 + .002, 4.07, side));
      lowerCurve.push(map(x,-.278,4.18,side));
      if (i < segments) for (let j = 0; j < profile.length; j++) {
        const a = i * profile.length + j, b = i * profile.length + (j + 1) % profile.length, c = a + profile.length, d = b + profile.length;
        index.push(a, b, c, b, d, c);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(index); geometry.computeVertexNormals();
    railGeometries.push(geometry);
    for (const [points, radius] of [[outerCurve, .005], [innerCurve, .0025]]) {
      highlights.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 128, radius, 5, false));
    }
    lowerArrises.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lowerCurve),96,.004,5,false));
  }
  add(mergeGeometries(railGeometries), glass, 'Four continuous concave crystal rails');
  const edges = add(mergeGeometries(highlights), optics.edge, 'Hairline polished arrises'); edges.castShadow = false;
  add(mergeGeometries(lowerArrises),optics.edge,'Fine lower return / separation from cast caustic').castShadow=false;
  [...railGeometries, ...highlights, ...lowerArrises].forEach(g => g.dispose());

  // Three irregular rings and an off-axis apex create broad gemstone facets.
  // Their bases overlap the swept rails, so the corner is an integrated carving.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const vertices = [];
    for (const [y, r, offset] of [[-.33, .18, 0], [-.045, .29, .005], [.25, .17, .04]]) {
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 2 * i / 8;
        const u = Math.cos(a) * r, v = Math.sin(a) * r * .7;
        vertices.push(new THREE.Vector3(sx * (4.19 + offset + (u + v) * .7071), y, sz * (4.19 + offset + (u - v) * .7071)));
      }
    }
    // A minute clipped apex catches light without an infinitely sharp CG tip.
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2;
      vertices.push(new THREE.Vector3(sx*(4.31+Math.cos(angle)*.006),.683,sz*(4.31+Math.sin(angle)*.006)));
    }
    const hull = new ConvexGeometry(vertices);
    const geometry = new ConvexGeometry(insetCrystalFaces(hull));hull.dispose();
    add(geometry, optics.carvedCrystal(geometry), `Faceted crown corner ${sx},${sz}`);
  }
  const details=createNerveDetails(optics.shared);group.add(details);
  return { group, optics, details, update(time) { optics.shared.time.value = time; } };
}
