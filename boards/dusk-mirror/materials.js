import * as THREE from 'three';

function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

// Authored at several scales, then mipmapped: fine filaments remain quiet at
// a distance instead of turning into shimmering procedural noise.
function filamentTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d'), rand = random(6129);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 2048, 2048);
  const paths = [], nodes = [];
  for (let k = 0; k < 34; k++) {
    let x = rand() * 2048, y = rand() * 2048, angle = rand() * Math.PI * 2;
    const path = [[x, y]];
    for (let i = 0; i < 5 + Math.floor(rand() * 7); i++) {
      angle += (rand() - .5) * 1.1;
      const length = 30 + rand() * 100;
      x += Math.cos(angle) * length; y += Math.sin(angle) * length;
      path.push([x, y]);
      if (rand() < .035) nodes.push([x, y]);
      if (rand() < .16) {
        const a = angle + (rand() > .5 ? 1 : -1) * (.4 + rand());
        paths.push({ points: [[x, y], [x + Math.cos(a) * 55, y + Math.sin(a) * 55], [x + Math.cos(a + .2) * 140, y + Math.sin(a + .2) * 140]], strength: .13 + rand() * .15 });
      }
    }
    paths.push({ points: path, strength: .2 + rand() * .6 });
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const { points, strength } of paths) {
    for (const [width, opacity] of [[11, .02], [3, .11], [.8, .75]]) {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = `rgba(255,255,255,${strength * opacity})`; ctx.lineWidth = width; ctx.stroke();
    }
  }
  for (const [x, y] of nodes) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
    glow.addColorStop(0, '#fff'); glow.addColorStop(.12, '#aaa'); glow.addColorStop(.35, '#222'); glow.addColorStop(1, '#000');
    ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function createOptics(renderer) {
  const studio = new THREE.Scene(); studio.background = new THREE.Color('#342936');
  const cardCanvas=document.createElement('canvas');cardCanvas.width=cardCanvas.height=128;
  const paint=cardCanvas.getContext('2d'),gradient=paint.createRadialGradient(64,64,20,64,64,82);
  gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.65,'#d8d8d8');gradient.addColorStop(1,'#171717');
  paint.fillStyle=gradient;paint.fillRect(0,0,128,128);
  const softbox=new THREE.CanvasTexture(cardCanvas);softbox.colorSpace=THREE.SRGBColorSpace;
  for (const [position, size, color, energy] of [
    [[-5, 7, 4], [2.5, 8], '#fff0ef', 2.2],
    [[5, 4, -4], [2, 6], '#dbd4ed', 1.8],
    [[0, 9, -2], [7, 1.5], '#eee3ee', 1.5],
    [[-4, 1, -5], [1.2, 4], '#f33c66', .35],
    [[3, 2, 6], [1, 3], '#ffffff', 1.2],
    [[5, -2.5, 6], [3, 5], '#fff0f5', 2.2],
    [[-5, -1.5, 3], [2, 4], '#d9cbdc', 1.1],
  ]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map:softbox,color: new THREE.Color(color).multiplyScalar(energy), side: THREE.DoubleSide }));
    card.position.set(...position); card.lookAt(0, 0, 0); studio.add(card);
  }
  const cube = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 40, cube).update(renderer, studio);
  studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  softbox.dispose();
  const threads = filamentTexture(renderer);
  const shared = { time: { value: 0 }, power: { value: .65 }, veil: { value: .55 } };

  function glass({ checker = false, crystal = false } = {}) {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, studio: { value: cube.texture }, threads: { value: threads }, checker: { value: checker }, crystal: { value: crystal } },
      vertexShader: `varying vec3 vWorld; varying vec3 vNormal;
        void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;
        vNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform samplerCube studio; uniform sampler2D threads;
        uniform float time,power,veil; uniform bool checker,crystal;
        varying vec3 vWorld; varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){
          vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);
          if(!gl_FrontFacing)N=-N;
          vec2 square=floor(clamp(vWorld.xz+4.,vec2(0.),vec2(7.999)));
          float identity=hash(square+3.7);
          float lap=noise(vWorld.xz*2.2+identity*4.);
          float polish=noise(vWorld.xz*84.);
          float bevel=1.-smoothstep(.92,.999,abs(N.y));
          // Microscopic lap variation shifts highlights, never the playing
          // height. Broad cell faces stay smooth while the real bevels gleam.
          if(checker&&abs(N.y)>.98){
            float xSlope=(noise(vWorld.xz*2.2+vec2(.025,0.))-noise(vWorld.xz*2.2-vec2(.025,0.)))*.1;
            float zSlope=(noise(vWorld.xz*2.2+vec2(0.,.025))-noise(vWorld.xz*2.2-vec2(0.,.025)))*.1;
            N=normalize(N+vec3(xSlope,0.,zSlope));
          }
          float facing=max(dot(N,V),0.);
          float fresnel=.055+.945*pow(1.-facing,4.);
          vec3 R=reflect(-V,N),T=refract(-V,N,1./1.56);
          vec3 env=textureLod(studio,R,.45+lap*.65+polish*.1).rgb;
          vec3 behind=textureLod(studio,T,1.7).rgb;
          vec2 uv=(vWorld.xz+4.)/8.;
          float tile=mod(floor(clamp(vWorld.x+4.,0.,7.999))+floor(clamp(vWorld.z+4.,0.,7.999)),2.);
          vec2 deep=uv+T.xz*.037/max(.3,abs(T.y));
          // Slow domain advection bends the paths, while narrow travelling
          // envelopes reveal only a few passing strands, never a fixed web.
          vec2 drift=vec2(sin(time*.19+deep.y*5.),cos(time*.14+deep.x*4.))*.018;
          vec2 moving=deep+drift+vec2(time*.003,-time*.002);
          float travel=pow(.5+.5*sin(time*.85-moving.x*29.-moving.y*19.+noise(moving*6.)*5.),12.);
          float second=pow(.5+.5*sin(time*.57+moving.x*17.-moving.y*31.),18.);
          float field=pow(texture2D(threads,moving).r,.75)*travel;
          float other=pow(texture2D(threads,moving*1.37+vec2(.33,.17)+T.xz*.025).r,.8)*second;
          float fog=noise(deep*7.)*.5+noise(deep*19.)*.3+noise(deep*43.)*.15+noise(deep*97.)*.05;
          // Different optical depths produce a subtle shifting veil, so it
          // reads as inclusions inside glass rather than a surface print.
          float cloud=0.;
          for(int layer=0;layer<3;layer++){
            float d=float(layer)+1.;vec2 q=uv+T.xz*(.013+d*.019)/max(.32,abs(T.y));
            float f=noise(q*15.+vec2(d*4.1,d*2.3));
            float g=noise(q*39.+f*2.8+vec2(d*1.7));
            cloud+=(f*.6+g*.4)/3.;
          }
          float wisp=pow(1.-abs(noise(deep*22.+vec2(fog*2.,fog))*2.-1.),15.);
          vec3 color;
          float top=step(.65,abs(N.y));
          if(checker){
            vec3 dark=vec3(.014,.009,.023)*( .67+cloud*.7 );
            vec3 light=vec3(.094,.079,.105)*( .48+cloud*.95+fog*.13 );
            light*=.96+identity*.08;
            color=mix(light,dark,tile);
            color+=vec3(.19,.15,.21)*(other*.6+wisp*.04+pow(cloud,3.)*.3)*(1.-tile)*veil;
            color+=behind*mix(.045,.017,tile);
            vec2 edge=min(fract(vWorld.xz+4.),1.-fract(vWorld.xz+4.));
            float dist=min(edge.x,edge.y);
            float seam=1.-smoothstep(.0005,.0005+max(fwidth(dist)*.5,.0003),dist);
            color*=1.-seam*.4;
            color+=env*(fresnel*.75+bevel*.17);
            // Tiny chromatic dispersion occurs only at the cut edge.
            vec3 split=vec3(textureLod(studio,R+N*.006,.8).r,env.g,textureLod(studio,R-N*.006,.8).b);
            color+=split*bevel*.055;
            vec3 halfLight=normalize(V+normalize(vec3(-.6,1.,.4)));
            float glint=pow(max(dot(N,halfLight),0.),180.);
            color+=vec3(.43,.36,.42)*glint*(.55+identity*.45);
            color+=vec3(2.4,.005,.055)*(field*.24+other*.06)*power;
          }else{
            // Both the rim and its carved corner facets share the same volume.
            vec2 sideUV=abs(N.x)>abs(N.z)?vec2(vWorld.z*.17,vWorld.y*1.6):vec2(vWorld.x*.17,vWorld.y*1.6);
            sideUV+=vec2(time*.012,sin(time*.21+vWorld.x*.4+vWorld.z*.4)*.025);
            float trail=pow(.5+.5*sin(time*.9-sideUV.x*22.+sideUV.y*5.),10.);
            float side=pow(texture2D(threads,sideUV+T.xy*.045).r,.7)*trail;
            float inner=pow(texture2D(threads,sideUV*.7+vec2(.2,.48)).r,.8)*second;
            float energy=mix(side*.85+inner*.4,field*.7+other*.2,top);
            color=vec3(.021,.009,.027)+behind*vec3(.24,.12,.22)*(crystal?.85:.5);
            color+=env*(fresnel*1.2+(crystal?.24:.075));
            float striae=noise(vec2(vWorld.x+vWorld.z,vWorld.y)*vec2(18.,145.));
            color*=.97+striae*.06;
            color+=vec3(4.2,.008,.09)*energy*power;
            if(crystal){
              vec3 internal=textureLod(studio,reflect(T,-N),1.3).rgb;
              color+=internal*vec3(.2,.025,.055)*(1.-fresnel)*.4;
            }
          }
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
    });
    material.name = checker ? 'Smoked mirror / optical checker field' : crystal ? 'Carved dusk crystal' : 'Dark glass / suspended crimson filaments';
    return material;
  }
  function carvedCrystal(geometry) {
    const planes = [], positions = geometry.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const plane = new THREE.Vector4(n.x, n.y, n.z, n.dot(a));
      if (!planes.some(p => p.clone().sub(plane).length() < .0001)) planes.push(plane);
    }
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, planes: { value: planes }, studio: { value: cube.texture }, threads: { value: threads } },
      vertexShader: `varying vec3 p;varying vec3 n;void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform vec4 planes[${planes.length}];uniform samplerCube studio;uniform sampler2D threads;uniform float time,power;
        varying vec3 p,n;
        float fresnel(float a){return .055+.945*pow(1.-clamp(a,0.,1.),5.);}
        void main(){
          vec3 N=normalize(n),I=normalize(p-cameraPosition);
          float f=fresnel(-dot(I,N));
          vec3 color=textureLod(studio,reflect(I,N),.4).rgb*f;
          vec3 throughput=vec3(1.-f),direction=refract(I,N,1./1.62),origin=p+direction*.0003;
          for(int bounce=0;bounce<4;bounce++){
            float nearest=1000.;vec3 boundary=vec3(0,1,0);
            for(int j=0;j<${planes.length};j++){
              float denom=dot(planes[j].xyz,direction);
              if(denom>.00001){float d=(planes[j].w-dot(planes[j].xyz,origin))/denom;
                if(d>.00001&&d<nearest){nearest=d;boundary=planes[j].xyz;}}
            }
            if(nearest>999.)break;
            origin+=direction*nearest;
            throughput*=exp(-vec3(.65,4.2,2.7)*nearest);
            vec3 outRay=refract(direction,-boundary,1.62);
            float energy=1.;
            if(dot(outRay,outRay)>.001){energy=fresnel(dot(direction,boundary));color+=throughput*(1.-energy)*textureLod(studio,outRay,.6).rgb;}
            float filament=texture2D(threads,origin.xz*.3+origin.y*.4+vec2(time*.009,0.)).r;
            float pulse=pow(.5+.5*sin(time*.8-origin.y*6.-origin.x*3.),12.);
            color+=throughput*vec3(1.8,.003,.045)*filament*pulse*power;
            throughput*=energy;direction=reflect(direction,boundary);origin+=direction*.0003;
          }
          color+=throughput*textureLod(studio,direction,2.).rgb*.2;
          // A tiny trapped-light focus briefly gathers near the apex, offset
          // by corner position so the four tips never flash in unison.
          float focus=exp(-pow((p.y-.48)*12.,2.));
          float charge=pow(.5+.5*sin(time*.55+p.x*1.7+p.z*.8),24.);
          color+=vec3(.32,.002,.018)*focus*charge*power;
          // Fine polishing variation only modulates the reflected light; the
          // broad approved cuts remain perfectly legible in close-up.
          float polish=.985+.015*sin(p.y*257.+p.x*19.)*sin(p.z*193.+p.y*31.);
          color*=polish;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }
  const edge = new THREE.MeshPhysicalMaterial({ color: '#b5a0b0', metalness: .8, roughness: .17, envMap: cube.texture, envMapIntensity: .85 });
  return { glass, carvedCrystal, edge, shared, threads, cube };
}
