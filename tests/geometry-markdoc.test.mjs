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

test('geometry interactive host opt-in emits a bounded inert specification', async () => {
 const markdown = '# Geometry\n\n```three-scene\n' + payload + '\n```';
 const staticResult = await renderDocument(markdown, {visualizations:{descriptions:{1:'A torus'}}});
 assert.doesNotMatch(staticResult.html, /visualization-interactive/);
 const interactive = await renderDocument(markdown, {visualizations:{descriptions:{1:'A torus'},interactive:['three-scene']}});
 assert.match(interactive.html, /visualization-interactive/);
 assert.match(interactive.html, /data-format="three-scene"/);
 assert.match(interactive.html, /<table/);
 assert.match(interactive.html, /<svg/);
 assert.equal(interactive.visualizations.length,1);
});
test('document cannot enable arbitrary interactive adapters', async () => {
 const markdown = '# Geometry\n\n```three-scene\n' + payload + '\n```';
 const result = await renderDocument(markdown, {visualizations:{descriptions:{1:'A torus'},interactive:['three-scene','javascript']}});
 assert.ok(result.diagnostics.some(message => message.includes('Interactive visualization formats refused')));
 assert.doesNotMatch(result.html,/visualization-interactive/);
});
