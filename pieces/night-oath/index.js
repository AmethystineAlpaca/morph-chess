import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rubySet } from '../ruby/index.js';
import { designPoint } from '../ruby/design.js';
import { cutRubyMaterial, cutRubyStudio } from '../ruby/cut-ruby.js';
import { oathMetals, metalwork, coatSurface, foldedLeaf, closedLoft, softenGold } from './metal.js';

const dimensions = Object.freeze(Object.fromEntries(Object.entries(rubySet.dimensions).map(([type, size]) => [type, Object.freeze({ ...size, base: size.base + .008 })])));

function foot(work, type) {
  const r = rubySet.dimensions[type].base / 2;
  work.turned([[0, -.001], [r * .89, -.001], [r + .004, .029], [r + .0045, .038], [r + .004, .077],
    [r * .91 + .004, .123], [r * .75 + .004, .166], [r * .71 + .004, .18],
    [r * .69, .18], [r * .69, .16]],
  ['recess', 'baseEdge', 'baseEdge', 'base', 'base', 'base', 'baseEdge', 'baseEdge', 'recess']);
}

function shoulder(group, work, type) {
  if (type === 'knight') return;
  const top = { pawn: .735, rook: .67, bishop: .67, queen: 1.005, king: .99 }[type];
  const stem = group.children.find(mesh => mesh.geometry?.type === 'LatheGeometry');
  work.add(coatSurface(stem.geometry, top * .905), 'satin');
  work.add(coatSurface(stem.geometry, top * .935, top * .952, .006), 'edge');
}

function collar(work, radius, y, height = .045) {
  work.turned([[radius * .86, y], [radius, y + height * .23], [radius + .005, y + height * .43],
    [radius, y + height * .76], [radius * .87, y + height], [radius * .81, y + height * .82]],
  ['satin', 'edge', 'edge', 'satin', 'recess']);
}

function replaceWithMetal(group, name, work, finish = 'satin') {
  const mesh = group.getObjectByName(name);
  if (!mesh) throw new Error(`Night Oath fitting needs the current Ruby part: ${name}`);
  mesh.updateMatrix();
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
  work.add(mesh.geometry.type === 'LatheGeometry' ? geometry : softenGold(geometry), finish);
  group.remove(mesh);
  // This factory owns this newly created material and geometry. Ruby's
  // factories and all other Ruby instances remain completely independent.
  mesh.geometry.dispose(); mesh.material.dispose();
}

function king(group, work, renderer) {
  replaceWithMetal(group, 'Single crown circlet', work);
  replaceWithMetal(group, 'Cross support jewel', work);
  replaceWithMetal(group, 'Beveled ruby cross', work);
  for (let i = 0; i < 4; i++) {
    // The short seat is clipped from the actual new diamond-section arch.
    work.add(coatSurface(group.getObjectByName(`Crown arch ${i + 1}`).geometry, 1.07, 1.185));
    work.add(coatSurface(group.getObjectByName(`Crown arch ${i + 1}`).geometry, 1.178, 1.187, .006), 'edge');
    work.add(coatSurface(group.getObjectByName(`Crown arch ${i + 1}`).geometry, 1.407), 'edge');
  }
  // Double-sided flush setting remains visible when the opposing army turns.
  for (const side of [-1, 1]) {
    const points = [[0, 1.515, .052], [-.019, 1.548, .052], [-.019, 1.642, .052],
      [0, 1.678, .052], [.019, 1.642, .052], [.019, 1.548, .052],
      [0, 1.565, .064], [0, 1.63, .064]].map(([x, y, z]) => new THREE.Vector3(x, y, z * side));
    const geometry = new ConvexGeometry(points);
    const material = cutRubyMaterial(geometry, cutRubyStudio(renderer).cube.texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Ruby inset in the gold cross'; mesh.renderOrder = 2;
    const eye = new THREE.Vector3();
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(eye); material.uniforms.localEye.value.copy(mesh.worldToLocal(eye));
    };
    group.add(mesh);
  }
}

function queen(_group, work) {
  for (let i = 0; i < 6; i++) work.add(foldedLeaf([
    [.235, 1.17, .115, .013], [.285, 1.255, .100, .015],
    [.325, 1.325, .075, .014], [.352, 1.39, .025, .010], [.36, 1.415, .001, .002],
  ], i * Math.PI / 3, p => designPoint('queen', p)));
}

function bishop(group, work) {
  // A solid folded lip follows the short blade from its root to its tip, on
  // BOTH faces. The diagonal remains legible when the opposing side turns.
  const sections = [[.96, -.025, .16, .145, -.145], [1.17, -.005, .218, .178, -.035],
    [1.39, .025, .168, .12, .077], [1.52, .055, .105, .067, .12]];
  for (const side of [-1, 1]) {
    const rings = sections.map(([y, cx, width, depth, cut], i) => {
      const x = i === sections.length - 1 ? cx + width - .002 : cut + .033;
      const angle = Math.acos((x - cx) / width);
      const a = new THREE.Vector3(x, y, depth * Math.sin(angle));
      const b = new THREE.Vector3(cx + width * Math.cos(angle * 2 / 3), y, depth * Math.sin(angle * 2 / 3));
      const middle = a.clone().lerp(b, .48);
      return [[a.x - .003, y, a.z + .003], [middle.x, y, middle.z + .013], [b.x, y, b.z + .003],
        [b.x, y, b.z - .004], [a.x + .003, y, a.z - .004]]
        .map(([x, height, z]) => designPoint('bishop', new THREE.Vector3(x, height, z * side)));
    });
    work.add(closedLoft(rings));
  }
  work.add(coatSurface(group.getObjectByName('Solid mitre root beneath the slit').geometry, .65), 'satin');
}

function knight(group, work) {
  collar(work, .169, .197, .044);
  // The poll and back follow the current geometric horse outline, not the
  // retired faceted horse in the concept sheet. A continuous folded saddle
  // grips the narrow rear edge; both cheek planes and ears stay exposed.
  const body = group.getObjectByName('Broad ruby planes with carved eyelid, nostril and lip seam').geometry;
  const positions = body.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  function depth(x, y) {
    const ray = new THREE.Ray(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    let z = .05;
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      if (ray.intersectTriangle(a, b, c, false, hit)) z = Math.max(z, hit.z);
    }
    return z;
  }
  const outline = [[.13, .238], [.25, .58], [.20, .94], [.003, 1.063]];
  const path = [];
  for (let segment = 0; segment < outline.length - 1; segment++) for (let j = 0; j < 5; j++) {
    const t = j / 5;
    path.push([THREE.MathUtils.lerp(outline[segment][0], outline[segment + 1][0], t),
      THREE.MathUtils.lerp(outline[segment][1], outline[segment + 1][1], t)]);
  }
  path.push(outline.at(-1));
  const section = ([x, y]) => {
    const taper = THREE.MathUtils.smoothstep(y, .24, .4) * (1 - THREE.MathUtils.smoothstep(y, .96, 1.065));
    const innerX = x - .025 - .025 * taper;
    const z = depth(innerX, y) + .004;
    return [[innerX, y, -z], [x + .018, y, -.066], [x + .040 + .015 * taper, y, -.025],
      [x + .046 + .015 * taper, y, 0], [x + .040 + .015 * taper, y, .025],
      [x + .018, y, .066], [innerX, y, z], [innerX - .006, y, 0]].map(p => new THREE.Vector3(...p));
  };
  work.add(closedLoft(path.map(section)));
  // Three low-relief folds wrap the broad mane. They sit on the shell and
  // catch moving strip reflections without obscuring the horse's face.
  for (const row of [4, 8, 12]) {
    const ring = section(path[row]);
    const curve = new THREE.CatmullRomCurve3(ring.slice(0, 7).map((p, i) => p.clone().add(new THREE.Vector3(.001, -.014 * Math.sin(i / 6 * Math.PI), 0))));
    work.add(new THREE.TubeGeometry(curve, 16, .0035, 5, false), 'edge');
  }
  knightMetalEyes(work, depth);
}

function knightMetalEyes(work, depth) {
  // Follow the current carved eyelid, including its five-segment curves.
  // A solid, gently domed insert fills the opening. Its curved polish catches
  // a wider range of reflections than a flat plate, while the tips stay sharp.
  const eyelid = new THREE.Shape();
  eyelid.moveTo(-.045, 0);
  eyelid.bezierCurveTo(-.025, -.011, .015, -.009, .045, .004);
  eyelid.bezierCurveTo(.025, .014, -.008, .010, -.045, 0);
  const local = eyelid.getPoints(5).slice(0, -1);
  const center = new THREE.Vector2(-.045, .957);
  const contour = local.map(p => p.clone().rotateAround(new THREE.Vector2(), .25).add(center));
  const outer = contour.map((point, i) => {
    const before = point.clone().sub(contour[(i + contour.length - 1) % contour.length]).normalize();
    const after = contour[(i + 1) % contour.length].clone().sub(point).normalize();
    const n1 = new THREE.Vector2(before.y, -before.x), n2 = new THREE.Vector2(after.y, -after.x);
    const miter = n1.clone().add(n2).multiplyScalar(1 / Math.max(.08, 1 + n1.dot(n2))).clampLength(0, 2);
    const taper = Math.sqrt(Math.max(0, 1 - (local[i].x / .045) ** 2));
    const width = .0005 + (i >= 5 ? .0042 : .0020) * taper;
    return point.clone().addScaledVector(miter, width);
  });
  // Sample outside the recess to recover the actual cheek plane, so the
  // gold fills the carved eye instead of following its recessed valley.
  const leftDepth = depth(center.x - .06, center.y);
  const dx = (depth(center.x + .06, center.y) - leftDepth) / .12;
  const dy = (depth(center.x, center.y + .03) - depth(center.x, center.y - .03)) / .06;
  const surface = (x, y) => leftDepth + (x - center.x + .06) * dx + (y - center.y) * dy;
  const domeCenter = outer.reduce((sum, p) => sum.add(p), new THREE.Vector2()).multiplyScalar(1 / outer.length);
  for (const side of [-1, 1]) {
    const points = [];
    for (const [scale, lift] of [[1, -.003], [1, .001], [.90, .0038], [.62, .0065], [.28, .0078]]) {
      for (const edge of outer) {
        const p = edge.clone().sub(domeCenter).multiplyScalar(scale).add(domeCenter);
        points.push(new THREE.Vector3(p.x, p.y, side * (surface(p.x, p.y) + lift)));
      }
    }
    points.push(new THREE.Vector3(domeCenter.x, domeCenter.y, side * (surface(domeCenter.x, domeCenter.y) + .0082)));
    work.add(softenGold(new ConvexGeometry(points)), 'edge');
  }
}

function rook(group, work) {
  const crown = group.getObjectByName('Carved hexagonal tower with bevelled merlons');
  // The six notches and the rotated inner well are taken from today's mesh.
  const lower = designPoint('rook', new THREE.Vector3(0, 1.115, 0)).y;
  work.add(coatSurface(crown.geometry, lower));
  const bevel = designPoint('rook', new THREE.Vector3(0, 1.312, 0)).y;
  work.add(coatSurface(crown.geometry, bevel, Infinity, .006), 'edge');
}

function pawn(_group, work) {
  // A shallow cup seats the lower facets while leaving the sphere readable.
  work.turned([[.088, .692], [.108, .714], [.126, .738], [.131, .752], [.128, .763],
    [.115, .763], [.108, .747], [.095, .727]],
  ['satin', 'satin', 'satin', 'edge', 'edge', 'recess', 'recess']);
}

const fittings = { king, queen, bishop, knight, rook, pawn };

export const nightOathSet = Object.freeze({
  id: 'night-oath', name: 'Night Oath · Champagne Gold', dimensions,
  availablePieces: rubySet.availablePieces,
  create(type, renderer) {
    // Start from a new instance of the CURRENT Ruby factory. Never patch its
    // source, prototypes, shared optics, or another set's cached meshes.
    const group = rubySet.create(type, renderer);
    group.name = `Night Oath / ${type}`;
    group.userData.pieceSet = 'night-oath';
    const work = metalwork(group, oathMetals(renderer));
    foot(work, type);
    shoulder(group, work, type);
    fittings[type](group, work, renderer);
    work.finish();
    return group;
  },
});
