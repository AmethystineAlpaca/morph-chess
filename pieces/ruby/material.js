import * as THREE from 'three';
import { accelerateRubyIntersections } from './knight-bvh.js';
import { setGemVeins } from './glow-veins.js';

const studios = new WeakMap();

// An isolated jewelry studio gives the ruby white light cards and dark areas
// without changing the approved lighting of the liquid board.
export function jewelryStudio(renderer, {background='#60555a', cardScale=1, frontFill=0} = {}) {
  let cache = studios.get(renderer);
  if (!cache) { cache = new Map(); studios.set(renderer, cache); }
  const key = JSON.stringify([background, cardScale, frontFill]);
  if (cache.has(key)) return cache.get(key);
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(background);
  const cardTexture=document.createElement('canvas');
  cardTexture.width=cardTexture.height=128;
  const ctx=cardTexture.getContext('2d');
  const gradient=ctx.createRadialGradient(48,40,4,64,64,90);
  gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.55,'#d9d9d9');gradient.addColorStop(1,'#4a4a4a');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const softbox=new THREE.CanvasTexture(cardTexture);softbox.colorSpace=THREE.SRGBColorSpace;
  const card = (color, intensity, size, position) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size.map(v=>v*cardScale)),
      new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, map:softbox}));
    mesh.position.set(...position); mesh.lookAt(0, 0, 0); studio.add(mesh);
  };
  card('#ffffff', 7, [2, 4], [-3, 3, 4]);
  card('#fff4ed', 2.5, [1.2, 5], [4, 1, 1]);
  card('#ffffff', 3, [3, 2], [0, 5, -2]);
  card('#ffffff', 1.7, [2, 4], [-2, 0, -4]);
  card('#ffffff', 3, [1.5, 3], [3, -1, -4]);
  if(frontFill)card('#fff4f4',frontFill,[2,3],[-4,2,0]);
  card('#94858b', .45, [8, 8], [0, -4, 0]);
  const cube = new THREE.WebGLCubeRenderTarget(256, {type: THREE.HalfFloatType, generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter});
  new THREE.CubeCamera(.1, 30, cube).update(renderer, studio);
  studio.traverse(o => {o.geometry?.dispose(); o.material?.dispose();});
  softbox.dispose();
  const lighting = {cube};
  cache.set(key, lighting);
  return lighting;
}

// Trace the actual convex gemstone planes, including internal reflection and
// Beer–Lambert absorption. This avoids screen-space glass's milky appearance.
export function gemstoneMaterial(geometry, environment, profile = null, concave = false) {
  const positions = geometry.attributes.position;
  const planes = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < (profile ? 0 : positions.count); i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const plane = new THREE.Vector4(normal.x, normal.y, normal.z, normal.dot(a));
    // Coplanar triangles describe the same convex boundary. Test it once.
    if (!planes.some(p => p.clone().sub(plane).lengthSq() < 1e-12)) planes.push(plane);
  }
  if(profile) planes.push(new THREE.Vector4());
  const spans=profile ? profile.slice(0,-1).map((p,i)=>new THREE.Vector4(p.x,p.y,profile[i+1].x,profile[i+1].y)) : [];
  // Store concave mesh vertices in a texture to avoid mobile uniform limits.
  let vertexTexture=null;
  if(concave) {
    const data=new Float32Array(positions.count*4);
    for(let i=0;i<positions.count;i++) {
      data[i*4]=positions.getX(i);data[i*4+1]=positions.getY(i);data[i*4+2]=positions.getZ(i);
    }
    vertexTexture=new THREE.DataTexture(data,positions.count,1,THREE.RGBAFormat,THREE.FloatType);
    vertexTexture.needsUpdate=true;
  }
  const intersection = concave ? `
    for(int j=0;j<${positions.count / 3};j++) {
      vec3 a=texelFetch(vertices,ivec2(j*3,0),0).xyz;
      vec3 e1=texelFetch(vertices,ivec2(j*3+1,0),0).xyz-a;
      vec3 e2=texelFetch(vertices,ivec2(j*3+2,0),0).xyz-a;
      vec3 h=cross(direction,e2); float determinant=dot(e1,h);
      if(abs(determinant)<.000001) continue;
      float inv=1.0/determinant; vec3 s=origin-a;
      float u=inv*dot(s,h); if(u<-.00001 || u>1.00001) continue;
      vec3 q=cross(s,e1); float v=inv*dot(direction,q);
      if(v<-.00001 || u+v>1.00001) continue;
      float t=inv*dot(e2,q);
      if(t>.00005 && t<nearest){nearest=t;boundary=normalize(cross(e1,e2));}
    }` : profile ? `
    for(int j=0;j<${spans.length};j++) {
      vec4 span=spans[j];
      float dy=span.w-span.y;
      if(abs(dy)<.00001) {
        if(abs(direction.y)>.00001){
          float t=(span.y-origin.y)/direction.y;
          float r=length((origin+direction*t).xz);
          if(t>.0001 && t<nearest && r>=min(span.x,span.z)-.0001 && r<=max(span.x,span.z)+.0001){
            nearest=t;boundary=vec3(0.0,span.z>span.x?-1.0:1.0,0.0);
          }
        }
      } else {
        float slope=(span.z-span.x)/dy;
        float radius=span.x+slope*(origin.y-span.y);
        float dr=slope*direction.y;
        float aa=dot(direction.xz,direction.xz)-dr*dr;
        float bb=2.0*(dot(origin.xz,direction.xz)-radius*dr);
        float cc=dot(origin.xz,origin.xz)-radius*radius;
        float disc=bb*bb-4.0*aa*cc;
        if(disc>=0.0 && abs(aa)>.000001){
          for(int root=0;root<2;root++) {
            float t=(-bb+(root==0?-1.0:1.0)*sqrt(disc))/(2.0*aa);
            vec3 point=origin+direction*t;
            if(t>.0001 && t<nearest && point.y>=span.y-.00001 && point.y<=span.w+.00001){
              nearest=t;
              boundary=normalize(vec3(normalize(point.xz).x,-slope,normalize(point.xz).y));
            }
          }
        }
      }
    }` : `
    for(int j=0;j<${planes.length};j++){
      float denom=dot(planes[j].xyz,direction);
      if(denom>0.00001){
        float distance=(planes[j].w-dot(planes[j].xyz,origin))/denom;
        if(distance>0.00001 && distance<nearest){nearest=distance;boundary=planes[j].xyz;}
      }
    }`;
  const material = new THREE.ShaderMaterial({
    // Draw once after the liquid transmission pass: the foreground pawn must
    // not enter the screen-space image used to refract the board underneath it.
    transparent: true, blending: THREE.NoBlending, depthWrite: true,
    uniforms: { veinMap: {value:null}, hasVeins: {value:0}, gemFilter: {value:new THREE.Vector3(1,1,1)}, veinTint: {value:new THREE.Vector3(1,.025,.055)}, bounceLimit: {value:4}, sideTone: {value:0}, opticalDensity: {value:1}, orthographic: {value:false}, localDirection: {value:new THREE.Vector3(0,0,-1)}, spans: {value:spans}, planes: {value: planes}, vertices: {value:vertexTexture}, studio: {value: environment}, localEye: {value: new THREE.Vector3()} },
    vertexShader: `attribute vec2 veinUv; varying vec2 vVeinUv; varying vec3 localPosition; varying vec3 localNormal;
      void main(){vVeinUv=veinUv;localPosition=position;localNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform vec4 planes[${concave ? 1 : planes.length}];
      ${concave ? `uniform sampler2D vertices;` : ''}
      ${profile ? `uniform vec4 spans[${spans.length}];` : ''}
      uniform float bounceLimit, sideTone, opticalDensity;
      uniform vec3 gemFilter, veinTint;
      uniform sampler2D veinMap;
      uniform float hasVeins;
      varying vec2 vVeinUv;
      uniform samplerCube studio;
      uniform mat4 modelMatrix;
      uniform vec3 localEye;
      uniform bool orthographic;
      uniform vec3 localDirection;
      varying vec3 localPosition; varying vec3 localNormal;
      vec3 lightAt(vec3 direction) {
        vec3 worldDirection=normalize(mat3(modelMatrix)*direction);
        return textureLod(studio,worldDirection,.65).rgb;
      }
      float fresnel(float cosine) {return .076+ .924*pow(1.0-clamp(cosine,0.0,1.0),5.0);}
      void main(){
        vec3 normal=${profile ? 'normalize(localNormal)' : 'normalize(cross(dFdx(localPosition),dFdy(localPosition)))'};
        vec3 incoming=orthographic?normalize(localDirection):normalize(localPosition-localEye);
        if(dot(normal,incoming)>0.0) normal=-normal;
        float f=fresnel(-dot(incoming,normal));
        vec3 color=lightAt(reflect(incoming,normal))*f;
        vec3 throughput=vec3(1.0-f);
        vec3 direction=refract(incoming,normal,1.0/1.76);
        vec3 origin=localPosition+direction*${profile ? '.001' : '.0002'};
        for(int bounce=0;bounce<${profile ? 2 : 4};bounce++){
          if(float(bounce)>=bounceLimit || max(throughput.r,max(throughput.g,throughput.b))<.015) break;
          float nearest=1000.0; vec3 boundary=vec3(0.0,1.0,0.0);
          ${intersection}
          if(nearest>999.0) break;
          origin+=direction*nearest;
          vec3 transmission=exp(-vec3(.35,12.0,9.0)*nearest*opticalDensity*(1.+sideTone*.45)*gemFilter);
          throughput*=transmission;
          vec3 outgoing=refract(direction,-boundary,1.76);
          float reflection=1.0;
          if(dot(outgoing,outgoing)>.001){
            reflection=fresnel(dot(direction,boundary));
            color+=throughput*(1.0-reflection)*lightAt(outgoing);
          }
          throughput*=reflection;
          direction=reflect(direction,boundary);
          origin+=direction*${profile ? '.001' : '.0002'};
        }
        // Approximate the low-energy tail with a blurred studio lookup instead
        // of many unstable, subpixel internal paths through the narrow rings.
        color+=throughput*exp(-vec3(.35,12.0,9.0)*.35*gemFilter)*textureLod(studio,normalize(mat3(modelMatrix)*direction),3.0).rgb*.35;
        color*=mix(vec3(1.),vec3(.78,.70,.82),sideTone);
        if(hasVeins>.5) {
          float vein=texture2D(veinMap,vVeinUv).r;
          float facet=.76+.24*abs(dot(normal,normalize(vec3(.4,.7,.3))));
          vec3 inclusion=mix(veinTint,vec3(.8),.09)*facet;
          // Fixed, high-contrast mineral detail under the polished face. One
          // texture lookup; no emissive source, time or light-path integration.
          color=mix(color,inclusion+color*.18,vein*.92);
        }
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.userData.ruby=true;
  material.defaultAttributeValues.veinUv=[0,0];
  material.userData.opticalAbsorption=[.35,12,9];
  material.userData.paletteDensity=1;
  setGemVeins(material, []);
  if (concave) accelerateRubyIntersections(material, geometry);
  return material;
}

