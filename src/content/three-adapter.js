// Optional browser-only adapter. Inject Three.js; never load scripts from document data.
import { validateGeometryDocument } from './geometry3d.js';
/** Stable clipping planes even for sub-millimetre geometry and very large scenes. */
export function cameraClipPlanes(extent) {
  const radius = Number.isFinite(extent) && extent > 0 ? extent : 1;
  const near = Math.max(radius / 10000, 1e-9);
  const far = Math.max(radius * 100, near * 100);
  return { near, far };
}

export function mountThreeScene(element, input, THREE, OrbitControls) {
  const model = validateGeometryDocument(input);
  if (!element || !THREE || !OrbitControls) throw new TypeError('Host must supply element, THREE and OrbitControls');
  if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') throw new TypeError('Interactive viewer requires animation frame APIs');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#17252d');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000000);
  camera.position.set(7, 6, 9);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)));
  element.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(5, 8, 10);
  scene.add(light);
  const axes = new THREE.AxesHelper(1);
  scene.add(axes);
  const meshes = [];
  for (const o of model.objects) {
    const [a,b,c] = o.size;
    const geometry = o.type === 'box' ? new THREE.BoxGeometry(a,b,c) :
      o.type === 'sphere' ? new THREE.SphereGeometry(a,32,20) :
      o.type === 'cylinder' ? new THREE.CylinderGeometry(a,a,b,32) :
      new THREE.TorusGeometry(a,b,16,64);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: o.color }));
    mesh.name = o.id;
    mesh.position.set(...o.position);
    mesh.rotation.set(...o.rotation);
    scene.add(mesh);
    meshes.push(mesh);
  }
  const bounds = new THREE.Box3();
  for (const mesh of meshes) bounds.expandByObject(mesh);
  if (!bounds.isEmpty()) {
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() || 1;
    axes.scale.setScalar(radius / 3);
    axes.position.copy(center);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius, radius, radius));
    camera.lookAt(center);
    controls.update();
    controls.minDistance = Math.max(radius / 100000, 1e-9);
    controls.maxDistance = radius * 100;
    const clipping = cameraClipPlanes(radius);
    camera.near = clipping.near;
    camera.far = clipping.far;
    camera.updateProjectionMatrix();
  }
  let frame = 0, disposed = false, contextLost = false;
  const schedule = requestAnimationFrame;
  const onContextLost = event => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; };
  const onContextRestored = () => { if (!disposed && contextLost) { contextLost = false; resize(); frame = schedule(render); } };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);
  function resize() {
    const width = Math.max(1, element.clientWidth || 640);
    const height = Math.max(1, element.clientHeight || 360);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(element);
  resize();
  function render() {
    if (disposed || contextLost) return;
    controls.update();
    renderer.render(scene, camera);
    frame = schedule(render);
  }
  render();
  return () => {
    disposed = true;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    observer?.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    controls.dispose();
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
    axes.geometry.dispose();
    axes.material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
