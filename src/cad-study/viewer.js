import * as THREE from 'three';
import { validateScene } from './schema.js';

function geometry(p) {
  if (p.shape === 'box') return new THREE.BoxGeometry(...p.size);
  if (p.shape === 'cylinder') return new THREE.CylinderGeometry(p.size[0], p.size[0], p.size[1], 32);
  const shape = new THREE.Shape();
  p.points.forEach(([x,z], i) => i ? shape.lineTo(x,z) : shape.moveTo(x,z)); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth:p.size[0], bevelEnabled:false });
  geo.rotateX(Math.PI/2); geo.translate(0,p.size[0]/2,0); return geo;
}
function environment() {
  const faces = Array.from({length:6}, (_,face) => {
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'), image=ctx.createImageData(128,128);
    for(let py=0;py<128;py++) for(let px=0;px<128;px++) {
      const u=(px+.5)/64-1,v=(py+.5)/64-1;
      let x=u,y=-v,z=1;
      if(face===0){x=1;z=-u;} if(face===1){x=-1;z=u;}
      if(face===2){x=u;y=1;z=v;} if(face===3){x=u;y=-1;z=-v;}
      if(face===5){x=-u;z=-1;}
      const norm=Math.hypot(x,y,z); x/=norm;y/=norm;z/=norm;
      const key=170*Math.exp(-12*((x+.54)**2+(y-.66)**2+(z-.52)**2));
      const base=15*(y+1)+12*Math.exp(-5*y*y), k=(py*128+px)*4;
      image.data[k]=17+base+key; image.data[k+1]=25+base+key;image.data[k+2]=30+base+key*.91;image.data[k+3]=255;
    }
    ctx.putImageData(image,0,0);return canvas;
  });
  const texture=new THREE.CubeTexture(faces);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

/** Trusted code accepts a validated data-only scene. Host owns UI and policy. */
export function createCadStudy(host, input, {onSelect=()=>{}, onProgress=()=>{}}={}) {
  const model=validateScene(input), scene=new THREE.Scene(), root=new THREE.Group();scene.add(root);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const camera=new THREE.OrthographicCamera(-250,250,170,-170,.1,100000);
  const env=environment(), background=new THREE.Scene(); background.background=env;
  const backgroundCamera=new THREE.PerspectiveCamera(55,1,.1,100);
  scene.add(new THREE.HemisphereLight(0xe7eee7,0x34434c,2.2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(200,400,300);scene.add(light);
  const drives=model.groups.map(def=>{const node=new THREE.Group();node.position.fromArray(def.pivot);root.add(node);
    return {def,node,phase:0,curve:def.path?new THREE.CatmullRomCurve3(def.path.map(p=>new THREE.Vector3(...p)),false,'centripetal'):null};});
  const meshes=model.parts.map(p=>{
    const material=new THREE.MeshPhongMaterial({color:p.color,opacity:p.opacity??1,transparent:(p.opacity??1)<1,depthWrite:(p.opacity??1)===1,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry(p),material);mesh.position.fromArray(p.pos);if(p.rot)mesh.rotation.set(...p.rot);mesh.userData.part=p;
    const drive=drives.find(d=>d.def.id===p.group);
    if(drive){mesh.position.sub(new THREE.Vector3(...drive.def.pivot));drive.node.add(mesh);}else root.add(mesh);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:0x3b5552,transparent:true,opacity:.45}));mesh.add(edge);return mesh;
  });
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const scale=Math.max(20,Math.max(size.x,size.y,size.z)*1.6);
  let mode='cad',active=[],frame=0,last=0,dirty=true,disposed=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${model.name}: conceptual geometry, static until deliberate inspection`);host.append(canvas);
  function view(name='iso') {
    const offset=name==='top'?[0,1,.001]:name==='side'?[0,.1,1]:[.85,.75,1];
    camera.position.copy(center).add(new THREE.Vector3(...offset).multiplyScalar(scale));camera.lookAt(center);
    backgroundCamera.quaternion.copy(camera.quaternion);dirty=true;
  }
  function resize(){const aspect=host.clientWidth/Math.max(1,host.clientHeight),half=Math.max(scale*.34,scale*.43/aspect);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    backgroundCamera.aspect=aspect;backgroundCamera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);dirty=true;}
  function setMode(next){mode=next==='phong'?'phong':'cad';scene.background=mode==='cad'?new THREE.Color('#e0e6e1'):null;
    meshes.forEach(mesh=>{mesh.material.envMap=mode==='phong'?env:null;mesh.material.shininess=mode==='phong'?100:18;mesh.material.reflectivity=.3;mesh.material.combine=THREE.MixOperation;mesh.material.needsUpdate=true;mesh.children[0].visible=mode==='cad';});dirty=true;}
  function highlight(id){meshes.forEach(m=>m.material.emissive.set(m.userData.part.id===id?'#644314':'#000000'));dirty=true;}
  function activate(ids){active=ids.filter(id=>drives.some(d=>d.def.id===id));dirty=true;}
  function transforms(){for(const d of drives){const t=THREE.MathUtils.clamp((d.phase-d.def.stage[0])/(d.def.stage[1]-d.def.stage[0]),0,1),e=t*t*(3-2*t);
    d.node.position.fromArray(d.def.pivot);if(d.curve)d.node.position.add(d.curve.getPoint(e));if(d.def.axis)d.node.quaternion.setFromAxisAngle(new THREE.Vector3(...d.def.axis),e*d.def.angle);}}
  function render(){if(mode==='phong'){renderer.autoClear=true;renderer.render(background,backgroundCamera);renderer.clearDepth();renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=true;}else renderer.render(scene,camera);}
  function tick(now){if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));last=now;let changed=false;
    for(const d of drives){const target=active.includes(d.def.id)?1:0,next=reduced.matches?target:d.phase+Math.sign(target-d.phase)*Math.min(Math.abs(target-d.phase),dt/3.6);if(next!==d.phase){d.phase=next;changed=true;}}
    if(changed){transforms();onProgress(Math.max(0,...drives.map(d=>d.phase)));}if(changed||dirty){render();dirty=false;}frame=requestAnimationFrame(tick);}
  const ray=new THREE.Raycaster();
  function pick(event){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);
    return ray.intersectObjects(meshes,false).find(h=>(h.object.material.opacity??1)>.5)?.object.userData.part;}
  function move(event){if(event.pointerType==='touch')return;const p=pick(event);highlight(p?.id);
    const h=model.hotspots.find(h=>p?.group&&h.groups.includes(p.group)&&h.groups.length>1);activate(h?.groups||(p?.group?[p.group]:[]));}
  function leave(){highlight(null);activate([]);}function click(event){const p=pick(event);if(p)onSelect(p.id);}
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('click',click);
  const observer=new ResizeObserver(resize);observer.observe(host);view();setMode('cad');resize();frame=requestAnimationFrame(tick);
  return {activate,highlight,setMode,view,reset(){activate([]);drives.forEach(d=>d.phase=0);transforms();onProgress(0);dirty=true;},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('click',click);
      scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});env.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
