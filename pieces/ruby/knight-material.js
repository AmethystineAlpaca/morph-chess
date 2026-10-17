import { gemstoneMaterial } from './material.js';
import { cutRubyMaterial } from './cut-ruby.js';

// The upper carving uses the bishop's dark studio and absorption. Turned
// feet retain the polished collection shader; concave parts keep exact optics.
export function createKnightRubyMaterial(geometry, environment, profile=null, detail=false, opticalGeometry=geometry) {
  const material=profile ? gemstoneMaterial(opticalGeometry,environment,profile)
    : cutRubyMaterial(opticalGeometry,environment,true);
  if(geometry.hasAttribute('rubyEyeShade')) {
    // Graded occlusion within shallow cuts preserves the moving ruby highlights
    // and fades at the tips. There is no uniformly black symbol on the cheek.
    material.vertexShader='attribute float rubyEyeShade; varying float eyeRecess;\n'+material.vertexShader
      .replace('void main(){','void main(){eyeRecess=rubyEyeShade;');
    material.fragmentShader='varying float eyeRecess;\n'+material.fragmentShader
      .replace('gl_FragColor=vec4(color,1.0);',
        'color*=mix(1.,.16,eyeRecess);\n        gl_FragColor=vec4(color,1.0);');
  }
  material.name=detail?'Ruby recessed anatomy':profile?'Ruby / polished foot':'Ruby / bishop reference cuts';
  if(detail) material.fragmentShader=material.fragmentShader
    .replaceAll('vec3(.70,17.0,12.0)','vec3(22.0,80.0,60.0)')
    .replace('lightAt(reflect(incoming,normal))*f*.35;', 'lightAt(reflect(incoming,normal))*f*.16;');
  return material;
}
