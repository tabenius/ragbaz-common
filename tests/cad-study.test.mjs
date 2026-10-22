import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScene,CAD_SCHEMA} from '../src/cad-study/schema.js';
const fixture=()=>({schema:CAD_SCHEMA,id:'fixture',name:'Synthetic assembly',description:'No product data.',parts:[{id:'body',label:'Body',shape:'box',pos:[0,0,0],size:[10,10,10],color:'#607060'}],groups:[],hotspots:[]});
test('bounded scene returns an explicit data projection',()=>{assert.deepEqual(validateScene(fixture()),fixture());});
test('refuses executable/remote attributes, oversized and non-finite geometry, and unknown groups',()=>{
  for(const mutate of [x=>x.script='alert(1)',x=>x.url='https://example.test',x=>x.parts[0].shape='script',x=>x.parts[0].pos[0]=Infinity,x=>x.parts[0].size[0]=-1,x=>x.parts[0].color='url(https://example.test)',x=>x.parts[0].group='missing',x=>x.parts.push({...x.parts[0]}),x=>x.parts=Array(257).fill(x.parts[0])]){const x=fixture();mutate(x);assert.throws(()=>validateScene(x));}
});
test('refuses unsafe phase and spline contracts',()=>{
  const valid={id:'moving',label:'Moving',pivot:[0,0,0],stage:[0,1],path:[[0,0,0],[1,0,0],[2,0,0]]};
  for(const change of [{stage:[1,0]},{axis:[2,0,0],angle:1},{path:[[1,0,0],[2,0,0],[3,0,0]]},{path:Array(17).fill([0,0,0])}]){const x=fixture();x.groups=[{...valid,...change}];assert.throws(()=>validateScene(x));}
  const x=fixture();x.groups=[valid];x.parts[0].group='moving';x.hotspots=[{label:'Inspect',anchor:[0,0,0],groups:['moving'],text:'Plain text'}];assert.equal(validateScene(x).groups.length,1);
});
