// Host-side interchange for the reviewed primitive geometry contract.
// Export is deliberately mesh-based, not precision CAD/STEP/BREP.
import { validateGeometryDocument } from './geometry3d.js';

export function exportSceneOBJ(input, THREE) {
  const model = validateGeometryDocument(input);
  if (!THREE) throw new TypeError('Host must supply Three.js');
  const lines = ['# ragbaz.geometry/1', '# units: ' + model.units];
  let vertexBudget = 0;
  const MAX_VERTICES = 1_000_000;
  let offset = 1;
  for (const object of model.objects) {
    const [a,b,c] = object.size;
    const mesh = object.type === 'box' ? new THREE.BoxGeometry(a,b,c) :
      object.type === 'sphere' ? new THREE.SphereGeometry(a,32,20) :
      object.type === 'cylinder' ? new THREE.CylinderGeometry(a,a,b,32) :
      new THREE.TorusGeometry(a,b,16,64);
    const transform = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...object.rotation));
    transform.setPosition(new THREE.Vector3(...object.position));
    const positions = mesh.getAttribute('position');
    const vertex = new THREE.Vector3();
    vertexBudget += positions.count;
    if (vertexBudget > MAX_VERTICES) { mesh.dispose(); throw new RangeError('OBJ vertex budget exceeded'); }
    lines.push('o ' + object.id);
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(transform);
      lines.push('v ' + [vertex.x, vertex.y, vertex.z].map(n => Number(n.toPrecision(12))).join(' '));
    }
    if (mesh.index) {
      const index = mesh.index;
      for (let i = 0; i < index.count; i += 3) {
        lines.push('f ' + [0,1,2].map(j => index.getX(i+j) + offset).join(' '));
      }
    } else {
      for (let i = 0; i < positions.count; i += 3) lines.push('f ' + [offset+i,offset+i+1,offset+i+2].join(' '));
    }
    offset += positions.count;
    mesh.dispose();
  }
  return lines.join('\n') + '\n';
}
