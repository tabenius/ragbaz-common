import test from 'node:test';
import assert from 'node:assert/strict';
import { exportSceneOBJ } from '../src/content/geometry-obj.js';
class Vector3 {
 constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
 fromBufferAttribute(attr,i) { [this.x,this.y,this.z] = attr.vertices[i]; return this; }
 applyMatrix4(m) { this.x += m.position.x; this.y += m.position.y; this.z += m.position.z; return this; }
}
class Matrix4 {
 makeRotationFromEuler() { return this; }
 setPosition(v) { assert.ok(v instanceof Vector3); this.position=v; return this; }
}
class Euler { constructor(...angles) { this.angles=angles; } }
class BoxGeometry {
 getAttribute() { return { count:3, vertices:[[0,0,0],[1,0,0],[0,1,0]] }; }
 get index() { return null; }
 dispose() { this.disposed=true; }
}
const THREE={Vector3,Matrix4,Euler,BoxGeometry};
test('OBJ export emits positioned vertices and indexed faces without network',()=>{
 const doc={version:'ragbaz.geometry/1',profile:'cad-model',units:'mm',objects:[{id:'block',type:'box',size:[1,1,1],position:[2,3,4]}]};
 const obj=exportSceneOBJ(doc,THREE);
 assert.match(obj,/# units: mm/);
 assert.match(obj,/o block/);
 assert.match(obj,/v 2 3 4/);
 assert.match(obj,/f 1 2 3/);
});
