import * as THREE from 'three';
import { mountControls } from '../ui/controls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Shared turntable viewer; any registered set can supply the same create API.
export function mountPieceViewer(pieceSet, { background = '#eeece6', lighting } = {}) {
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  const scene=new THREE.Scene();scene.background=new THREE.Color(background);
  lighting?.(scene);
  const perspective=new THREE.PerspectiveCamera(36,1,.1,30);
  const orthographic=new THREE.OrthographicCamera(-1,1,1.15,-1.15,.1,30);
  let camera=perspective;
  const viewSelector=document.querySelector("#piece-view");
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.enablePan=false;
  controls.minDistance=2;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.49;
  const reset=()=>{
    controls.enableDamping=false;controls.update();
    camera=perspective;controls.object=camera;controls.enableRotate=true;
    controls.maxPolarAngle=Math.PI*.49;camera.up.set(0,1,0);
    camera.position.set(2.3,1.7,3.7);controls.target.set(0,.68,0);controls.update();
    controls.enableDamping=true;if(viewSelector)viewSelector.value='perspective';
  };reset();
  const selector=document.querySelector('#piece-type');
  const pieceNames={pawn:'Pawn',rook:'Rook',bishop:'Bishop',knight:'Knight',queen:'Queen',king:'King'};
  for(const type of pieceSet.availablePieces){const option=document.createElement('option');option.value=type;option.textContent=pieceNames[type] || type;selector.append(option);}
  // Cache models so switching previews does not rebuild the studio textures.
  const models=new Map();let active;
  function select(type){if(active)scene.remove(active);if(!models.has(type))models.set(type,pieceSet.create(type,renderer));active=models.get(type);active.position.set(0,0,0);scene.add(active);}
  const requested=new URLSearchParams(location.search).get('piece');
  if(pieceSet.availablePieces.includes(requested))selector.value=requested;
  select(selector.value);selector.onchange=()=>{select(selector.value);if(viewSelector && viewSelector.value!=='perspective')setView(viewSelector.value);};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:background}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.003;scene.add(ground);
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,8,64,64,63);gradient.addColorStop(0,'rgba(50,20,22,.25)');gradient.addColorStop(1,'rgba(50,20,22,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.renderOrder=1;scene.add(shadow);
  function setView(view) {
    if(view==='perspective'){reset();requestRender();return;}
    controls.enableDamping=false;controls.update();
    camera=orthographic;controls.object=camera;controls.enableRotate=false;
    controls.maxPolarAngle=Math.PI;camera.zoom=1;
    const views=selector.value==='knight'?{front:[-4,1.1,0],side:[-.8,.65,4],top:[0,4,0]}:{front:[-4,0,0],side:[0,0,4],top:[0,4,0]};
    const direction=new THREE.Vector3(...views[view]);
    direction.applyQuaternion(active.quaternion);
    controls.target.set(0,.82,0);camera.position.copy(controls.target).add(direction);
    camera.up.set(...(view==='top'?[1,0,0]:[0,1,0]));
    if(view==='top')camera.up.applyQuaternion(active.quaternion);
    controls.update();camera.updateProjectionMatrix();requestRender();
  }
  if(viewSelector)viewSelector.onchange=()=>setView(viewSelector.value);
  document.querySelector('#reset').onclick=()=>{reset();requestRender();};
  const resize=()=>{renderer.setSize(innerWidth,innerHeight);perspective.aspect=innerWidth/innerHeight;perspective.updateProjectionMatrix();orthographic.left=-1.15*perspective.aspect;orthographic.right=1.15*perspective.aspect;orthographic.updateProjectionMatrix();};window.addEventListener('resize',resize);resize();
  // The isolated model is static; render only while the camera changes.
  const viewDirection=new THREE.Vector3(),inverseWorld=new THREE.Matrix4();
  function updateOpticalView(){
    scene.updateMatrixWorld(true);camera.getWorldDirection(viewDirection);
    active.traverse(mesh=>{
      const u=mesh.material?.uniforms;if(!u?.orthographic)return;
      u.orthographic.value=!!camera.isOrthographicCamera;
      inverseWorld.copy(mesh.matrixWorld).invert();
      u.localDirection.value.copy(viewDirection).transformDirection(inverseWorld);
    });
  }
  let pending=false;
  const requestRender=()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;controls.update();updateOpticalView();renderer.render(scene,camera);});}};
  controls.addEventListener('change',requestRender);
  window.addEventListener('resize',requestRender);
  selector.addEventListener('change',requestRender);
  mountControls();
  requestRender();
}
