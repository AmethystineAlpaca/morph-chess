import * as THREE from 'three';

// The surface texture is deliberately band-limited: its narrowest feature is
// several texels wide, and mipmaps take over when the finish recedes on screen.
// This records the gentle pressure of hand polishing, not scratches or wear.
function makeFinishMaps(renderer, kind) {
  const size=512;
  const heightCanvas=document.createElement('canvas');
  const roughCanvas=document.createElement('canvas');
  heightCanvas.width=heightCanvas.height=roughCanvas.width=roughCanvas.height=size;
  const heightContext=heightCanvas.getContext('2d'),roughContext=roughCanvas.getContext('2d');
  const heightData=heightContext.createImageData(size,size),roughData=roughContext.createImageData(size,size);
  const fract=n=>n-Math.floor(n);
  const hash=(x,y,seed)=>fract(Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453);
  const smooth=t=>t*t*t*(t*(t*6-15)+10);
  const noise=(u,v,count,seed)=>{
    const x=u*count,y=v*count,ix=Math.floor(x),iy=Math.floor(y),tx=smooth(x-ix),ty=smooth(y-iy);
    const a=hash(ix%count,iy%count,seed),b=hash((ix+1)%count,iy%count,seed);
    const c=hash(ix%count,(iy+1)%count,seed),d=hash((ix+1)%count,(iy+1)%count,seed);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,tx),THREE.MathUtils.lerp(c,d,tx),ty);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const cloud=noise(u,v,5,17),lap=noise(u,v,14,31),grain=noise(u,v,38,47);
    let height,roughness;
    if(kind==='stone'){
      // Broad undulations in the lap-polished mineral beneath its glossy coat.
      height=.5+(cloud-.5)*.34+(lap-.5)*.16+(grain-.5)*.055;
      roughness=.84+(cloud-.5)*.09+(lap-.5)*.09+(grain-.5)*.025;
    }else{
      // A subtly wandering satin lay; enough width to remain quiet in motion.
      // Its low contrast is important on a metal highlight at grazing angles.
      const polish=noise(u,v,27,63);
      const sweep=Math.sin((v*16+Math.sin(u*Math.PI*2)*.32)*Math.PI*2);
      height=.5+(cloud-.5)*.24+(lap-.5)*.1+sweep*.012+(polish-.5)*.04;
      roughness=.81+(cloud-.5)*.09+(lap-.5)*.07+sweep*.026+(polish-.5)*.035;
    }
    const offset=(y*size+x)*4;
    const h=Math.round(height*255),r=Math.round(roughness*255);
    heightData.data.set([h,h,h,255],offset);roughData.data.set([r,r,r,255],offset);
  }
  heightContext.putImageData(heightData,0,0);roughContext.putImageData(roughData,0,0);
  const texture=canvas=>{
    const map=new THREE.CanvasTexture(canvas);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.colorSpace=THREE.NoColorSpace;
    map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;map.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
    return map;
  };
  return {height:texture(heightCanvas),roughness:texture(roughCanvas)};
}

// A dark photographic studio with wide diffused cards lets tiny bevels move
// through a gentle highlight. Thin bare cards made the inlays look like wires.
export function createStudio(renderer) {
  const studio = new THREE.Scene(); studio.background = new THREE.Color('#0b1020');
  const card = (position, size, color, energy) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(energy),side:THREE.DoubleSide}));
    mesh.position.set(...position);mesh.lookAt(0,0,0);studio.add(mesh);
  };
  card([-5,7,3],[3.4,9],'#fff2df',3.2);
  card([5,4,-5],[1.9,8],'#c8deff',2.6);
  card([0,8,-2],[7,2.4],'#eff5ff',2.15);
  card([2,2,6],[1.2,5],'#ffffff',1.1);
  card([-3,1,-5],[5,3],'#9cb0ce',.28);
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.055);
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();return environment;
}

export function createStoneMaterials(renderer, onLoad = () => {}) {
  const maps=[];
  const finish=makeFinishMaps(renderer,'stone');
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=2;
  const paint=placeholder.getContext('2d');paint.fillStyle='#17253e';paint.fillRect(0,0,2,2);
  const image = new THREE.TextureLoader().load(new URL('./textures/midnight-marble.png',import.meta.url).href,()=>{
    // Reallocate GPU storage: the full-resolution image replaces a 2 × 2 placeholder.
    for(const map of maps)map.dispose();
    for(const map of maps)map.needsUpdate=true;
    onLoad();
  },undefined,()=>{
    const error=document.querySelector('#error');if(error){error.hidden=false;error.textContent='Unable to load the stone texture. Please refresh the page.';}
  });
  image.image=placeholder;image.needsUpdate=true;
  image.colorSpace=THREE.SRGBColorSpace;image.wrapS=image.wrapT=THREE.RepeatWrapping;
  image.minFilter=THREE.LinearMipmapLinearFilter;image.magFilter=THREE.LinearFilter;
  image.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const materials=[];
  function stone(light,index=0,frame=false){
    const map=image.clone();map.needsUpdate=true;maps.push(map);
    map.repeat.set(frame?.12:.23,frame?.12:.23);
    map.offset.set((index*.237)%1,(index*.419)%1);map.rotation=(index%4)*Math.PI/2;
    const roughnessMap=finish.roughness.clone(),bumpMap=finish.height.clone();
    for(const surfaceMap of [roughnessMap,bumpMap]){
      surfaceMap.repeat.setScalar(frame?.24:1.2);
      surfaceMap.offset.set((index*.173)%1,(index*.317)%1);
      surfaceMap.rotation=(index%4)*Math.PI/2;surfaceMap.needsUpdate=true;
    }
    const mat=new THREE.MeshPhysicalMaterial({
      map,roughness:.24,roughnessMap,bumpMap,bumpScale:frame?.006:.0035,
      metalness:0,ior:1.53,specularIntensity:.95,
      clearcoat:frame?.68:.53,clearcoatRoughness:.17,envMapIntensity:.8,
    });
    mat.name=frame?'Lap-polished midnight stone surround':light?'Polished blue chalcedony':'Polished midnight stone';
    // Both stones share the photographed mineral structure; light chalcedony is
    // remapped in linear space, retaining veins and clouds rather than whitening.
    mat.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float mineral = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
        ${light ? 'float tone=clamp(pow(mineral, .52)*1.55,0.,1.); diffuseColor.rgb=mix(vec3(.16,.20,.27),vec3(.34,.41,.51),tone);' : 'diffuseColor.rgb = mix(vec3(.006,.012,.025), diffuseColor.rgb * vec3(.65,.76,.96), .43);'}
      `);
    };
    mat.customProgramCacheKey=()=>light?'chalcedony':'midnight';materials.push(mat);return mat;
  }
  return {stone,materials};
}

// Shared jewelry finishes. Geometry supplies real chased recesses and bevels;
// these maps provide only the small polishing variation across their faces.
// Keep this materials array separate from the stone finish slider.
export function createCraftMetalMaterials(renderer) {
  const finish=makeFinishMaps(renderer,'metal');
  const make=(name,color,roughness,bumpScale,extra={})=>{
    const material=new THREE.MeshPhysicalMaterial({
      color,metalness:1,roughness,roughnessMap:finish.roughness,
      bumpMap:finish.height,bumpScale,envMapIntensity:1.3,
      clearcoat:.12,clearcoatRoughness:.2,...extra,
    });
    material.name=name;return material;
  };
  const silver=make('Hand-burnished champagne silver','#d5c8b0',.29,.0032);
  const bright=make('Polished bevels of warm silver','#eee1c8',.23,.0018,{clearcoat:.22});
  const gold=make('Pale gold jewelry settings','#d7b779',.3,.0028);
  const satin=make('Satin-cut silver relief','#a69d8c',.4,.0042,{envMapIntensity:1.1});
  const recess=make('Dark blue metal in chased recesses','#263041',.41,.002,{metalness:.85,clearcoat:.08,envMapIntensity:.8});
  return {silver,bright,gold,satin,recess,shaded:satin,darkMetal:recess,materials:[silver,bright,gold,satin,recess]};
}
