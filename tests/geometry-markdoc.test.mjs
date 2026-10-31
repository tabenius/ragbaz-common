import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument } from '../src/content/markdoc-ragbaz.js';
const payload = JSON.stringify({version:'ragbaz.geometry/1',profile:'three-scene',units:'mm',objects:[{id:'ring',type:'torus',size:[3,0.8]}]});
test('Markdoc consumes geometry fence with exact fallback', async () => {
 const markdown = '# Geometry\n\n```three-scene\n' + payload + '\n```';
 const result = await renderDocument(markdown,{visualizations:{descriptions:{1:'A torus'}}});
 assert.equal(result.visualizations.length,1);
 assert.equal(result.visualizations[0].format,'three-scene');
 assert.equal(result.visualizations[0].fallback.rows[0][2],'3 × 0.8 mm');
});
