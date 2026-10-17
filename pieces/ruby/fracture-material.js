import { gemstoneMaterial } from './material.js';

// Use the same ray-traced ruby as the intact pawn. Screen-space transmission
// mostly sees the dark floor here and turns small glass chips into black rocks.
export function fractureMaterial(geometry, environment) {
  const material = gemstoneMaterial(geometry, environment, null, true);
  material.uniforms.opticalDensity.value = 1.8;
  material.uniforms.bounceLimit.value = 3;
  material.uniforms.fractureNodeCount = { value: material.userData.acceleration.nodes };
  // All fragments share one shader program. Only the BVH textures and node
  // count vary, so hundreds of unique pieces do not compile hundreds of shaders.
  const count = material.userData.acceleration.nodes;
  material.fragmentShader = material.fragmentShader
    .replace('uniform sampler2D bvhNodes;', 'uniform int fractureNodeCount; uniform sampler2D bvhNodes;')
    .replace(/texelFetch\(bvhNodes,ivec2\(i%\d+,i\/\d+\),0\)/g, 'texelFetch(bvhNodes,ivec2(i%textureSize(bvhNodes,0).x,i/textureSize(bvhNodes,0).x),0)')
    .replace(/texelFetch\(bvhTriangles,ivec2\(i%\d+,i\/\d+\),0\)/g, 'texelFetch(bvhTriangles,ivec2(i%textureSize(bvhTriangles,0).x,i/textureSize(bvhTriangles,0).x),0)')
    .replace(`visit<${count}`, 'visit<fractureNodeCount')
    .replace(`nodeIndex>=${count}`, 'nodeIndex>=fractureNodeCount');
  return material;
}
