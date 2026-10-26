import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const GEM_EFFECTS = Object.freeze([
  { id: 'original', name: 'Original', description: 'The original gemstone lighting.', density: 1, bloom: 0 },
  { id: 'prismatic', name: 'Brilliance', description: 'Sparkling facets, subtle dispersion and highlight glow.', background: '#291a29', density: .65, reflection: 1.25, lod: .18, energy: 11, bloom: .40, dispersion: .009 },
].map(Object.freeze));

function createEnvironment(renderer, preset) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(preset.background);
  function card(position, size, tint, power) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(power), side: THREE.DoubleSide }));
    mesh.position.set(...position); mesh.lookAt(0, .6, 0); scene.add(mesh);
  }
  card([-3,3,4], [.85,4.8], '#fff5e8', preset.energy);
  card([3,1.7,1], [.45,4.2], '#ffdbc1', preset.energy * .65);
  card([0,4,-2], [2.4,1.5], '#ffffff', preset.energy * .8);
  card([-2,1,-4], [1,3.5], '#e8dfff', preset.energy * .6);
  card([3,-1,-4], [.7,2.8], '#fff1e4', preset.energy * .65);
  if (preset.dispersion) { card([-4,0,1], [.14,3], '#d5e6ff', 12); card([2,3,-3], [.18,2], '#ffdbc5', 14); }
  const cube = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 30, cube).update(renderer, scene);
  scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  return cube;
}

// One controller owns only optical uniforms and cached light environments.
// Switching never creates pieces or touches gameplay, camera, or selection state.
export function createGemEffects({ renderer, invalidate = () => {} }) {
  let current = GEM_EFFECTS[0], bloom, baseBloom = 0;
  const materials = new Map(), environments = new Map(), listeners = new Set();
  const shared = {
    gemEffectActive: { value: 0 }, gemEffectDensity: { value: 1 },
    gemEffectReflection: { value: 1 }, gemEffectLod: { value: .65 }, gemEffectDispersion: { value: 0 },
  };
  function environment() {
    if (!environments.has(current.id)) environments.set(current.id, createEnvironment(renderer, current));
    return environments.get(current.id).texture;
  }
  function register(material) {
    if (!material?.uniforms?.studio || materials.has(material)) return;
    const originalEnvironment = material.uniforms.studio.value;
    const originalShader = material.fragmentShader;
    const reflected = originalShader.match(/lightAt\(reflect\(incoming,normal\)\)\*f(?:\*(\.[0-9]+|[0-9.]+))?;/);
    const reflectionScale = Number(reflected?.[1] || 1);
    const lightLookup = /return textureLod\(studio,worldDirection,([.\d]+)\)\.rgb;/;
    if (!lightLookup.test(originalShader) || !reflected) return;
    Object.assign(material.uniforms, shared);
    material.fragmentShader = `uniform float gemEffectActive, gemEffectDensity, gemEffectReflection, gemEffectLod, gemEffectDispersion;\n` + originalShader
      .replace(lightLookup, (_match, lod) => `
        if(gemEffectActive<.5) return textureLod(studio,worldDirection,${lod}).rgb;
        vec3 tangent=normalize(cross(worldDirection,abs(worldDirection.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.)));
        vec3 base=textureLod(studio,worldDirection,gemEffectLod).rgb;
        if(gemEffectDispersion<=0.) return base;
        vec3 spectrum=vec3(textureLod(studio,normalize(worldDirection+tangent*gemEffectDispersion),gemEffectLod).r,base.g,textureLod(studio,normalize(worldDirection-tangent*gemEffectDispersion),gemEffectLod).b);
        return mix(base,spectrum,.65);`)
      .replace(reflected[0], `lightAt(reflect(incoming,normal))*f*mix(${reflectionScale.toFixed(4)},gemEffectReflection,gemEffectActive);`)
      .replace('*opticalDensity*', '*opticalDensity*gemEffectDensity*');
    materials.set(material, originalEnvironment);
    material.addEventListener('dispose', () => materials.delete(material));
    if (current.id !== 'original') material.uniforms.studio.value = environment();
    material.needsUpdate = true;
  }
  return {
    get value() { return current.id; },
    register,
    apply(group) { group.traverse(object => { if (Array.isArray(object.material)) object.material.forEach(register); else register(object.material); }); },
    set(id) {
      const next = GEM_EFFECTS.find(preset => preset.id === id);
      if (!next || next === current) return;
      current = next;
      shared.gemEffectActive.value = current.id === 'original' ? 0 : 1;
      shared.gemEffectDensity.value = current.density;
      shared.gemEffectReflection.value = current.reflection || 1;
      shared.gemEffectLod.value = current.lod || .65;
      shared.gemEffectDispersion.value = current.dispersion || 0;
      const texture = current.id === 'original' ? null : environment();
      for (const [material, original] of materials) material.uniforms.studio.value = texture || original;
      if (bloom) { bloom.strength = baseBloom + current.bloom; bloom.enabled = bloom.strength > 0; }
      invalidate(); listeners.forEach(listener => listener(current));
    },
    connectComposer(composer, existingBloom = null) {
      bloom = existingBloom || new UnrealBloomPass(new THREE.Vector2(1,1), 0, .35, 1.1);
      baseBloom = existingBloom?.strength || 0;
      if (!existingBloom) composer.insertPass(bloom, 1);
      bloom.strength = baseBloom + current.bloom; bloom.enabled = bloom.strength > 0;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export function mountGemEffectSwitch(controller) {
  const section = document.createElement('section'); section.className = 'gem-effect-switch'; section.setAttribute('aria-label', 'Gem lighting');
  section.innerHTML = `<span class="gem-effect-label">Gem lighting</span><div class="gem-effect-options" role="group" aria-label="Gem lighting effects">${GEM_EFFECTS.map(preset => `<button type="button" data-gem-effect="${preset.id}" title="${preset.description}" aria-pressed="${preset.id === controller.value}">${preset.name}</button>`).join('')}</div><p class="gem-effect-description"></p>`;
  const update = preset => {
    for (const button of section.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.gemEffect === preset.id));
    section.querySelector('p').textContent = preset.description;
  };
  update(GEM_EFFECTS.find(preset => preset.id === controller.value));
  controller.subscribe(update);
  section.addEventListener('click', event => { const button = event.target.closest('[data-gem-effect]'); if (button) controller.set(button.dataset.gemEffect); });
  return section;
}
