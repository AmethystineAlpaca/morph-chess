import * as THREE from 'three';
import { mountControls } from '../../ui/controls.js';
import { configureViewport, diagnostics } from '../../play/viewport.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Approved liquid-board preset. Startup and reset share these values.
export const DEFAULTS=Object.freeze({strength:10,bounce:1,gridTransparency:85});
// Piece sets are supplied by the composition page, never imported by the board.
export function mountBoard({ createOverlay, interactive=false } = {}) {
const canvas = document.querySelector('#scene');
const debug=diagnostics();let dirty=true;const invalidate=()=>{dirty=true;};
const segments=interactive?64:128;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch { document.querySelector('#error').hidden=false; document.querySelector('#error').textContent='WebGL is unavailable. Use a browser with hardware acceleration.'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
// Only static board geometry casts into this map; the pawn has a local soft contact shadow.
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
renderer.transmissionResolutionScale=interactive?.5:.75;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.02;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#eeece6');
const camera=new THREE.PerspectiveCamera(36,1,.1,100);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.enablePan=false; controls.minDistance=2.5;controls.maxDistance=25;
controls.minPolarAngle=.25;controls.maxPolarAngle=1.35;
function reset(){camera.position.set(11,11.5,14);controls.target.set(.65,0,0);controls.update();}
reset();
const pmrem=new THREE.PMREMGenerator(renderer);
const room=new RoomEnvironment();
const env=pmrem.fromScene(room,.03);scene.environment=env.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0xc6a36a,2));
const sun=new THREE.DirectionalLight(0xfff2d8,4);sun.position.set(-3,10,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9});sun.shadow.normalBias=.03;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#eeece6',roughness:.8}));floor.rotation.x=-Math.PI/2;floor.position.y=-.37;floor.receiveShadow=true;scene.add(floor);
const base=new THREE.Mesh(new THREE.BoxGeometry(9.1,.24,9.1),new THREE.MeshStandardMaterial({color:'#d6c3a0',roughness:.32,metalness:.25}));base.position.y=-.22;base.castShadow=true;base.receiveShadow=true;scene.add(base);
const palettes={amber:{liquid:'#ffbc28',deep:'#df8808',light:'#ffdf88',dark:'#b97925'},jade:{liquid:'#82e4c5',deep:'#288e82',light:'#b1dfc8',dark:'#3d8f82'},rose:{liquid:'#f4a4b7',deep:'#ba4f72',light:'#f6c6cf',dark:'#ac687e'}};
let palette=palettes.amber;
const floorUniforms={time:{value:0},lightColor:{value:new THREE.Color(palette.light)},darkColor:{value:new THREE.Color(palette.dark)},grid:{value:1}};
const boardMaterial=new THREE.ShaderMaterial({uniforms:floorUniforms,vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float grid;uniform vec3 lightColor;uniform vec3 darkColor;
void main(){vec2 p=vUv*8.;float checker=mod(floor(p.x)+floor(p.y),2.);vec3 col=mix(lightColor,darkColor,0.);vec2 q=p*2.5; q+=vec2(sin(q.y*.9+time*.7),cos(q.x*.8-time*.6))*.7;float a=sin(q.x+q.y+sin(q.x-time)*1.3);float b=cos(q.y-q.x+cos(q.y+time*.8)*1.4);float c=pow(max(0.,1.-abs(a+b)*.65),12.);col+=c*vec3(.36,.29,.14);gl_FragColor=vec4(col,1.);}`});
const bed=new THREE.Mesh(new THREE.PlaneGeometry(8,8),boardMaterial);bed.rotation.x=-Math.PI/2;bed.position.y=-.085;scene.add(bed);
const liquidMaterial=new THREE.MeshPhysicalMaterial({color:palette.liquid,metalness:0,roughness:.2,specularIntensity:.35,transmission:.84,thickness:.85,ior:1.36,clearcoat:.12,clearcoatRoughness:.3,attenuationColor:palette.deep,attenuationDistance:2.8,envMapIntensity:.65,side:THREE.DoubleSide});
const geometry=new THREE.PlaneGeometry(8,8,segments,segments);geometry.rotateX(-Math.PI/2);
// The checker pattern belongs to the deforming top surface, not the bed below.
const checkerCanvas=document.createElement('canvas');checkerCanvas.width=checkerCanvas.height=1024;
const checkerContext=checkerCanvas.getContext('2d');
const checkerTexture=new THREE.CanvasTexture(checkerCanvas);checkerTexture.colorSpace=THREE.SRGBColorSpace;
checkerTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
let gridTransparency=DEFAULTS.gridTransparency/100;
function paintChecker(){
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const tint=new THREE.Color(palette.liquid).lerp(new THREE.Color((row+col)%2 ? palette.dark : palette.light),1-gridTransparency);
    checkerContext.fillStyle='#'+tint.getHexString();
    checkerContext.fillRect(col*128,row*128,128,128);
  }
  checkerTexture.needsUpdate=true;
}
paintChecker();
const surfaceMaterial=liquidMaterial.clone();surfaceMaterial.color.set('#ffffff');
surfaceMaterial.map=checkerTexture;surfaceMaterial.transmission=.82;
const surface=new THREE.Mesh(geometry,surfaceMaterial);scene.add(surface);
// Coordinates stay outside the playing area; A1 is the dark near-left square.
const coordinates=new THREE.Group();scene.add(coordinates);
function coordinate(text,x,z){
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d');ctx.font='500 78px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#665238';ctx.fillText(text,64,67);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));
  label.position.set(x,.04,z);label.scale.set(.31,.31,1);coordinates.add(label);
}
for(let i=0;i<8;i++){
  coordinate('ABCDEFGH'[i],i-3.5,4.32);
  coordinate('ABCDEFGH'[i],i-3.5,-4.32);
  coordinate(String(i+1),-4.32,3.5-i);
  coordinate(String(i+1),4.32,3.5-i);
}
// Vertical walls share the animated surface boundary to keep the liquid volume closed.
const sides=[];
for(let k=0;k<4;k++){const g=new THREE.PlaneGeometry(8,.78,segments,1);const m=new THREE.Mesh(g,liquidMaterial);scene.add(m);sides.push({geometry:g,mesh:m,k});}
const clock=new THREE.Clock();let time=0,paused=false,strength=DEFAULTS.strength/100,bounce=DEFAULTS.bounce/100;const impulses=[];
function impulse(x,z,power){if(paused)return;impulses.push({x,z,power,t:time});if(impulses.length>28)impulses.shift();}
function height(x,z){let h=.69+strength*(.095*Math.sin(x*1.7+time*1.3)*Math.cos(z*1.6-time*.9)+.042*Math.sin(x*3.8+z*2.2-time*2)+.012*Math.sin(x*8.5-z*5.3+time*2.3));
for(const w of impulses){const age=time-w.t,dist=Math.hypot(x-w.x,z-w.z);const speed=2.2+bounce*1.8;const front=dist-speed*age;h+=w.power*Math.sin(front*(4.5+bounce*2))*Math.exp(-front*front*1.4)*Math.exp(-age*(1.35-bounce*.65))/(1+dist*.35);h-=w.power*.8*Math.exp(-dist*dist*3)*Math.exp(-age*5);}
return h;}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.69),hit=new THREE.Vector3();let last=null,lastTime=0,down=null;
function locate(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(!raycaster.ray.intersectPlane(waterPlane,hit)||Math.abs(hit.x)>4||Math.abs(hit.z)>4)return null;return hit.clone();}
canvas.addEventListener('pointermove',e=>{const p=locate(e);if(p&&e.buttons===0&&time-lastTime>.045){const distance=last?p.distanceTo(last):.1;if(distance>.035){impulse(p.x,p.z,Math.min(.065,.016+distance*.055));last=p;lastTime=time;}}});
canvas.addEventListener('pointerleave',()=>{last=null;down=null;});
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const p=locate(e);if(p)impulse(p.x,p.z,.34);}down=null;});
function resetDefaults(){
  reset();
  strength=DEFAULTS.strength/100;
  bounce=DEFAULTS.bounce/100;
  gridTransparency=DEFAULTS.gridTransparency/100;
  for(const [id,value] of [['strength',DEFAULTS.strength],['bounce',DEFAULTS.bounce],['grid-transparency',DEFAULTS.gridTransparency]]){
    document.querySelector('#'+id).value=value;
    document.querySelector('#'+id+'-value').value=value+'%';
  }
  impulses.length=0;paused=false;
  document.querySelector('#pause').textContent='Pause animation';
  document.querySelector('#pause').setAttribute('aria-pressed','false');
  document.querySelector('#grid').checked=true;
  document.querySelector('#grid').onchange({target:document.querySelector('#grid')});
  paintChecker();
}
document.querySelector('#reset').onclick=resetDefaults;
document.querySelector('#strength').oninput=e=>{strength=e.target.value/100;document.querySelector('#strength-value').value=e.target.value+'%';};
document.querySelector('#bounce').oninput=e=>{bounce=e.target.value/100;document.querySelector('#bounce-value').value=e.target.value+'%';};
document.querySelector('#grid-transparency').oninput=e=>{
  gridTransparency=e.target.value/100;
  document.querySelector('#grid-transparency-value').value=e.target.value+'%';
  paintChecker();
};
document.querySelector('#grid').onchange=e=>{
  surfaceMaterial.map=e.target.checked?checkerTexture:null;
  surfaceMaterial.color.set(e.target.checked?'#ffffff':palette.liquid);
  surfaceMaterial.transmission=e.target.checked?.82:.84;
  surfaceMaterial.needsUpdate=true;coordinates.visible=e.target.checked;
};
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume animation':'Pause animation';e.target.setAttribute('aria-pressed',String(paused));};
document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{palette=palettes[button.dataset.theme];liquidMaterial.color.set(palette.liquid);liquidMaterial.attenuationColor.set(palette.deep);surfaceMaterial.attenuationColor.set(palette.deep);if(!document.querySelector('#grid').checked)surfaceMaterial.color.set(palette.liquid);paintChecker();floorUniforms.lightColor.value.set(palette.light);floorUniforms.darkColor.value.set(palette.dark);document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b===button));});
const viewport = configureViewport({renderer,camera,interactive,invalidate,maxRatio:1.25,budget:1800000});
controls.addEventListener('change',invalidate);
document.querySelector('aside').addEventListener('input',invalidate);
document.querySelector('aside').addEventListener('click',invalidate);
document.addEventListener('visibilitychange',invalidate);
// Optional diagnostics are visible only when explicitly opened with ?profile=1.
const profiling=new URLSearchParams(location.search).has('profile');
const perfLabel=document.createElement('div');
if(profiling){perfLabel.style.cssText='position:absolute;left:48px;top:190px;font:12px monospace;color:#665238';document.querySelector('#app').append(perfLabel);}
let perfStart=performance.now(),perfFrames=0;
function animate(){requestAnimationFrame(animate);
const dt=Math.min(clock.getDelta(),.04);
if(document.hidden)return;
const moved=controls.update();
if(paused&&!dirty&&!moved)return;
dirty=false;
if(profiling){perfFrames++;const elapsed=performance.now()-perfStart;if(elapsed>=2500){perfLabel.textContent=`${(perfFrames*1000/elapsed).toFixed(1)} fps · ${(elapsed/perfFrames).toFixed(1)} ms/frame`;perfStart=performance.now();perfFrames=0;}}
if(!paused)time+=dt;while(impulses.length&&time-impulses[0].t>7)impulses.shift();floorUniforms.time.value=time;
if(!paused || !geometry.userData.initialized){
const pos=geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));pos.needsUpdate=true;geometry.computeVertexNormals();
for(const {geometry:g,k} of sides){const p=g.attributes.position;for(let i=0;i<p.count;i++){const u=(i%(segments+1))/segments*8-4;let x,z;if(k===0){x=u;z=4;}else if(k===1){x=4;z=-u;}else if(k===2){x=-u;z=-4;}else{x=-4;z=u;}p.setXYZ(i,x,i<segments+1?height(x,z):-.08,z);}p.needsUpdate=true;g.computeVertexNormals();}
geometry.userData.initialized=true;}
overlay?.update?.();
renderer.info.reset();renderer.render(scene,camera);}
const context={scene,renderer,camera,controls,sampleHeight:height,squareSize:1,invalidate,viewport};
const overlay=createOverlay?.(context);
resetDefaults();paused=!debug.motion;renderer.shadowMap.needsUpdate=true;animate();
if(!interactive)mountControls();
return context;
}
