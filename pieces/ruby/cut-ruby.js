import { jewelryStudio, gemstoneMaterial } from './material.js';

// The bishop's dark cut ruby is the reference for every identifying head.
// Turned feet keep their polished finish, with the same red optical core.
export function cutRubyStudio(renderer) {
  return jewelryStudio(renderer, { background: '#35232b', cardScale: .95 });
}

export function cutRubyMaterial(geometry, environment, concave = false) {
  const material = gemstoneMaterial(geometry, environment, null, concave);
  material.fragmentShader = material.fragmentShader
    .replaceAll('vec3(.35,12.0,9.0)', 'vec3(.70,17.0,12.0)')
    .replace('.rgb*.35;', '.rgb*.08;')
    .replace('vec3(.70,17.0,12.0)*nearest', 'vec3(.70,17.0,12.0)*(nearest+.10)')
    .replace('textureLod(studio,worldDirection,.65)', 'textureLod(studio,worldDirection,2.0)')
    .replace('lightAt(reflect(incoming,normal))*f;', 'lightAt(reflect(incoming,normal))*f*.35;');
  material.name = 'Bishop reference / deep wine ruby cuts';
  material.userData.opticalAbsorption = [.70,17,12];
  material.userData.paletteDensity = 2;
  return material;
}
