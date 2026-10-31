import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeometryDocument, geometrySummary, geometrySvg } from '../src/content/geometry3d.js';
const valid = { version:'ragbaz.geometry/1', profile:'cad-model', units:'mm', objects:[{id:'ring',type:'torus',size:[3,1]}] };
test('validates and freezes a bounded CAD document', () => {
 const doc = validateGeometryDocument(valid);
 assert.equal(doc.objects[0].type, 'torus');
 assert.equal(geometrySummary(doc)[0].dimensions, '3 × 1 mm');
 assert.match(geometrySvg(doc), /<svg/);
 assert.ok(Object.isFrozen(doc.objects[0]));
});
test('rejects executable and malformed geometry', () => {
 for (const o of [{id:'bad',type:'script',size:[1]}, {id:'bad',type:'sphere',size:[Infinity]}, {id:'bad',type:'torus',size:[1,2]}]) {
   assert.throws(() => validateGeometryDocument({...valid,objects:[o]}));
 }
 assert.throws(() => validateGeometryDocument({...valid, objects: Array(129).fill(valid.objects[0])}));
});
