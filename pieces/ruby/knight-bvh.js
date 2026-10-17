import * as THREE from 'three';

function dataTexture(values) {
  const width = Math.min(1024, Math.max(1, Math.ceil(values.length / 4)));
  const height = Math.ceil(values.length / (width * 4));
  const data = new Float32Array(width * height * 4);
  data.set(values);
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// A depth-first BVH with escape links needs no per-fragment stack. Indexed and
// non-indexed meshes are both accepted; triangles are never approximated by a hull.
export function buildTraceData(geometry) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index;
  const count = indices ? indices.count : positions.count;
  const triangles = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(positions, indices ? indices.getX(i) : i);
    b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1);
    c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2);
    const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
    if (e1.clone().cross(e2).lengthSq() < 1e-18) continue;
    const min = a.clone().min(b).min(c), max = a.clone().max(b).max(c);
    triangles.push({ a: a.clone(), e1, e2, min, max, center: min.clone().add(max).multiplyScalar(.5) });
  }
  if (!triangles.length) throw new Error('A ruby material requires non-degenerate triangles.');
  const nodes = [], ordered = [];
  function split(items) {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const centroidMin = min.clone(), centroidMax = max.clone();
    for (const item of items) {
      min.min(item.min); max.max(item.max);
      centroidMin.min(item.center); centroidMax.max(item.center);
    }
    const node = { min, max, start: -1, count: 0, escape: 0 };
    nodes.push(node);
    if (items.length <= 4) {
      node.start = ordered.length; node.count = items.length;
      ordered.push(...items);
    } else {
      const spread = centroidMax.sub(centroidMin);
      const axis = spread.x > spread.y && spread.x > spread.z ? 'x' : spread.y > spread.z ? 'y' : 'z';
      items.sort((left, right) => left.center[axis] - right.center[axis]);
      const middle = Math.floor(items.length / 2);
      split(items.slice(0, middle)); split(items.slice(middle));
    }
    node.escape = nodes.length;
  }
  split(triangles);
  const nodeValues = [], triangleValues = [];
  for (const node of nodes) nodeValues.push(
    node.min.x, node.min.y, node.min.z, 0,
    node.max.x, node.max.y, node.max.z, 0,
    node.start, node.count, node.escape, 0,
  );
  for (const triangle of ordered) for (const vertex of [triangle.a, triangle.e1, triangle.e2]) {
    triangleValues.push(vertex.x, vertex.y, vertex.z, 0);
  }
  const extent = nodes[0].max.clone().sub(nodes[0].min).length();
  return {
    nodes: dataTexture(nodeValues), triangles: dataTexture(triangleValues),
    nodeCount: nodes.length, triangleCount: triangles.length,
    epsilon: Math.max(extent * 0.000025, 0.000001),
  };
}


// Replace only boundary search. Keep the collection's shading, absorption,
// bounce count and intersection tolerances unchanged.
export function accelerateRubyIntersections(material, geometry) {
 const trace=buildTraceData(geometry);
 const helpers=`
 uniform sampler2D bvhNodes;
 uniform sampler2D bvhTriangles;
 vec4 nodeAt(int i){return texelFetch(bvhNodes,ivec2(i%${trace.nodes.image.width},i/${trace.nodes.image.width}),0);}
 vec3 triAt(int i){return texelFetch(bvhTriangles,ivec2(i%${trace.triangles.image.width},i/${trace.triangles.image.width}),0).xyz;}
 bool hitsBox(vec3 origin,vec3 inv,vec3 low,vec3 high,float limit){
 vec3 a=(low-origin)*inv,b=(high-origin)*inv;
 vec3 nearT=min(a,b),farT=max(a,b);
 float enter=max(nearT.x,max(nearT.y,nearT.z));
 float leave=min(farT.x,min(farT.y,farT.z));
 return leave>=max(enter,0.)&&enter<limit;
 }
 `;
 const search=`
 vec3 inverseDirection=(step(vec3(0.),direction)*2.-1.)/max(abs(direction),vec3(1e-9));
 int nodeIndex=0;
 for(int visit=0;visit<${trace.nodeCount};visit++){
   if(nodeIndex>=${trace.nodeCount})break;
   vec3 low=nodeAt(nodeIndex*3).xyz-vec3(.00002);
   vec3 high=nodeAt(nodeIndex*3+1).xyz+vec3(.00002);
   vec3 meta=nodeAt(nodeIndex*3+2).xyz;
   if(!hitsBox(origin,inverseDirection,low,high,nearest)){nodeIndex=int(meta.z);continue;}
   if(meta.x<0.){nodeIndex++;continue;}
   for(int leaf=0;leaf<4;leaf++){
     if(leaf>=int(meta.y))break;
     int j=(int(meta.x)+leaf)*3;
     vec3 a=triAt(j),e1=triAt(j+1),e2=triAt(j+2);
     vec3 h=cross(direction,e2);float determinant=dot(e1,h);
     if(abs(determinant)<.000001)continue;
     float inv=1./determinant;vec3 s=origin-a;
     float u=inv*dot(s,h);if(u<-.00001||u>1.00001)continue;
     vec3 q=cross(s,e1);float v=inv*dot(direction,q);
     if(v<-.00001||u+v>1.00001)continue;
     float t=inv*dot(e2,q);
     if(t>.00005&&t<nearest){nearest=t;boundary=normalize(cross(e1,e2));}
   }
   nodeIndex=int(meta.z);
 }
 `;
 const start=material.fragmentShader.indexOf('for(int j=0;j<');
 const end=material.fragmentShader.indexOf('if(nearest>999.0)',start);
 if(start<0||end<0)throw new Error('Expected concave ruby intersection loop.');
 material.fragmentShader=(material.fragmentShader.slice(0,start)+search+material.fragmentShader.slice(end))
   .replace('uniform sampler2D vertices;',helpers);
 material.uniforms.vertices.value.dispose();delete material.uniforms.vertices;
 material.uniforms.bvhNodes={value:trace.nodes};material.uniforms.bvhTriangles={value:trace.triangles};
 material.userData.acceleration={triangles:trace.triangleCount,nodes:trace.nodeCount};
 material.addEventListener('dispose',()=>{trace.nodes.dispose();trace.triangles.dispose();});
 return material;
}
