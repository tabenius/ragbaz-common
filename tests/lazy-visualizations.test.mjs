import test from 'node:test';
import assert from 'node:assert/strict';
import {createLazyVisualizationHost,visualizationFormats} from '../demo/markdoc-ragbaz/lazy-visualizations.js';

const root = formats => ({
  isConnected:true,
  querySelectorAll(){return formats.map(format=>({dataset:{format}}));}
});
test('lazy host does not load dependencies for prose-only pages',async()=>{
  let count=0;
  const host=createLazyVisualizationHost({load:()=>{count++;throw Error('must not load');}});
  assert.equal(await host.mount(root([])),false);
  assert.equal(count,0);
});
test('lazy host loads only for recognized visualizations and reuses one adapter',async()=>{
  let calls=0,mounts=0,disposes=0;
  const adapter={mountVisualizations(){mounts++;},disposeVisualizations(){disposes++;}};
  const host=createLazyVisualizationHost({load:async()=>{calls++;return adapter;}});
  assert.deepEqual(visualizationFormats(root(['bogus','chartjs','chartjs','cad-model'])),['chartjs','cad-model']);
  assert.equal(await host.mount(root(['chartjs'])),true);
  assert.equal(await host.mount(root(['cytoscape'])),true);
  await host.dispose(root([]));
  assert.equal(calls,1);assert.equal(mounts,2);assert.equal(disposes,1);
});
test('disposed generation does not mount a stale asynchronous renderer',async()=>{
  let release,mounts=0;
  const host=createLazyVisualizationHost({load:()=>new Promise(r=>{release=r;})});
  const page=root(['three-scene']);
  const pending=host.mount(page);
  await Promise.resolve();
  const disposal=host.dispose(page);
  release({mountVisualizations(){mounts++;},disposeVisualizations(){}});
  assert.equal(await pending,false);
  await disposal;
  assert.equal(mounts,0);
});
