import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisualization, visualizationGraphic, VISUALIZATION_FORMATS } from '../src/content/visualizations.js';
const source = JSON.stringify({ version:'ragbaz.geometry/1', profile:'three-scene', units:'mm', objects:[{id:'ring',type:'torus',size:[3,0.8],color:'#5e9bb5'}] });
test('3D profile is available and projects exact values', () => {
 assert.ok(VISUALIZATION_FORMATS.includes('three-scene'));
 const record = parseVisualization('three-scene', source, {alt:'A ring'});
 assert.equal(record.fallback.rows[0][0], 'ring');
 assert.equal(record.fallback.rows[0][2], '3 × 0.8 mm');
 const tree = visualizationGraphic(record);
 assert.equal(tree.name, 'svg');
 assert.ok(tree.children.some(child => child.name === 'text'));
});
test('CAD profile requires matching declared profile', () => {
 assert.throws(() => parseVisualization('cad-model', source, {alt:'A ring'}), /profile mismatch/);
});
test('3D profile refuses executable and unreviewed properties', () => {
 for (const extra of [{url:'https://example.invalid'}, {shader:'void main(){}'}, {callback:'alert(1)'}]) {
  const bad = JSON.stringify({...JSON.parse(source), objects:[{...JSON.parse(source).objects[0],...extra}]});
  assert.throws(() => parseVisualization('three-scene', bad, {alt:'A ring'}));
 }
});
