import * as THREE from 'three';

// Inset each coplanar face, then re-hull its vertices. The new strips between
// faces are actual polished chamfers, not bright lines drawn on the crystal.
export function insetCrystalFaces(geometry, fraction = .025) {
  const faces=new Map(),position=geometry.attributes.position;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<position.count;i+=3){
    a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const key=[normal.x,normal.y,normal.z,normal.dot(a)].map(n=>n.toFixed(5)).join(',');
    if(!faces.has(key))faces.set(key,new Map());
    const face=faces.get(key);
    for(const p of [a,b,c])face.set(p.toArray().map(n=>n.toFixed(6)).join(','),p.clone());
  }
  const points=[];
  for(const face of faces.values()){
    const vertices=[...face.values()],center=vertices.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(vertices.length);
    for(const p of vertices)points.push(p.lerp(center,fraction));
  }
  return points;
}

// Each path carries an occasional short train of impulses. The empty interval
// is much longer than the impulse, so the volume never becomes a red net.
export function createNerveDetails(shared) {
  const group = new THREE.Group(); group.name = 'Subsurface impulses and crystal inclusions';
  const vertexShader = `varying vec2 vUv;varying float depth;
    void main(){vUv=uv;depth=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const fragmentShader = `
    uniform float time,power,phase,period,travel,halo;
    varying vec2 vUv;varying float depth;
    float packet(float offset){
      float head=(mod(time+phase,period)-offset)/travel;
      float d=head-vUv.x;
      float core=exp(-d*d*38000.);
      float tail=exp(-max(d,0.)*65.)*smoothstep(-.004,.003,d);
      return (core+tail*.27)*step(head,1.25)*step(0.,head);
    }
    void main(){
      float signal=packet(0.)+packet(.13)*.68+packet(.28)*.33;
      float endFade=smoothstep(0.,.035,vUv.x)*smoothstep(0.,.06,1.-vUv.x);
      float strength=signal*endFade*power*mix(1.,.08,halo);
      if(strength<.001)discard;
      vec3 red=mix(vec3(2.8,.018,.08),vec3(3.8,.30,.43),min(signal*.38,1.));
      gl_FragColor=vec4(red,strength);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function route(points, index, phase, period, travel) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    for (const halo of [0, 1]) {
      const geometry = new THREE.TubeGeometry(curve, 112, halo ? .022 : .004, 5, false);
      const material = new THREE.ShaderMaterial({
        uniforms: { time: shared.time, power: shared.power, phase: { value: phase }, period: { value: period }, travel: { value: travel }, halo: { value: halo } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, depthTest: false,
      });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `Buried impulse ${index}${halo ? ' / halo' : ''}`;
      // Composite the buried light after the solid glass, before the reflected
      // pieces and their actual geometry. Paths retain their true depth/parallax.
      mesh.renderOrder = .8; group.add(mesh);
    }
  }
  const paths = [
    [[-3.8,-.07,2.8],[-2.9,-.12,2.1],[-2.1,-.07,2.3],[-1.4,-.13,1.8],[-.8,-.08,.9],[.2,-.1,.6]],
    [[-.8,-.08,.9],[-1.3,-.13,.2],[-.7,-.16,-.6],[.1,-.08,-.9]],
    [[3.7,-.09,-2.3],[3.0,-.14,-1.9],[2.4,-.09,-2.2],[1.5,-.16,-1.3],[.6,-.1,-1.6]],
    [[-3.6,-.16,-2.6],[-2.7,-.08,-2.2],[-2.3,-.14,-1.4],[-1.7,-.06,-1.2]],
    [[3.7,-.08,2.6],[3,-.13,2.0],[2.3,-.06,2.2],[1.7,-.14,1.5],[1.0,-.1,.8]],
    [[2.3,-.06,2.2],[2.1,-.11,3.0],[1.2,-.08,3.6]],
    [[-1.7,-.15,-3.7],[-.8,-.11,-2.9],[-.1,-.07,-3.1],[.6,-.16,-2.5]],
    [[-3.8,-.19,.3],[-3,-.13,.6],[-2.4,-.2,.2],[-2,-.12,-.4]],
  ];
  const schedules = [[0,9.8,1.25],[-1,9.8,.55],[3.4,12.1,1.05],[7.3,13.7,.85],[1.6,11.3,1.15],[.9,11.3,.6],[5.2,14.9,.9],[6.4,12.8,.8]];
  paths.forEach((path, index) => route(path, index, ...schedules[index]));
  // A few finer impulses travel inside the sidewall, below the playing plane.
  for (let side = 0; side < 4; side++) {
    const points = [[-3.9,-.14,4.18],[-2.6,-.20,4.22],[-1.1,-.10,4.24],[.5,-.19,4.21],[2.1,-.13,4.23],[3.9,-.08,4.24]]
      .map(p => new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0,1,0),side*Math.PI/2).toArray());
    route(points, side+8, side*2.9+1.2, 13.5+side, 1.65);
  }
  return group;
}

// A flat seat with two minute edge facets. Equal cells and a level playing
// surface are retained; only the last fraction of a square rolls into the seam.
export function createOpticalTiles(height) {
  const vertices = [], uv = [];
  const tri = (a,b,c) => { vertices.push(...a,...b,...c); for(const p of [a,b,c])uv.push((p[0]+4)/8,(p[2]+4)/8); };
  const ring = (x,z,inset,y) => [[x+inset,y,z+inset],[x+inset,y,z+1-inset],[x+1-inset,y,z+1-inset],[x+1-inset,y,z+inset]];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++) {
    const x=col-4,z=row-4;
    const rings=[ring(x,z,.0009,height-.006),ring(x,z,.0035,height-.0018),ring(x,z,.008,height)];
    const top=rings[2];tri(top[0],top[1],top[2]);tri(top[0],top[2],top[3]);
    for(let j=0;j<2;j++)for(let k=0;k<4;k++) {
      const n=(k+1)%4,a=rings[j],b=rings[j+1];
      tri(a[k],a[n],b[k]);tri(a[n],b[n],b[k]);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return geometry;
}
