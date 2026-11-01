import test from 'node:test';import assert from 'node:assert/strict';
import {inspectReplicadArtifact,replicadPreviewSVG,REPLICAD_SCHEMA} from '../src/content/replicad-artifact.js';
const A='a'.repeat(64);
const fixture=()=>({schema:REPLICAD_SCHEMA,name:'Box <script>',source:{language:'javascript',sha256:A},preview:{format:'triangle-mesh/1',positions:[0,0,0,1,0,0,0,1,0],triangles:[0,1,2]},exports:[{format:'step',sha256:A,bytes:128}]});
test('render static preview without executing model script',()=>{const doc=inspectReplicadArtifact(fixture());assert.equal(doc.verification,'unverified');assert.equal(doc.release_ready,false);const svg=replicadPreviewSVG(doc);assert.match(svg,/polyline/);assert.match(svg,/&lt;script&gt;/);assert.doesNotMatch(svg,/<script>/);});
test('reject unsafe preview data and forged exports',()=>{for(const change of [x=>x.preview.triangles[0]=99,x=>x.preview.positions[0]=Infinity,x=>x.exports[0].format='exe',x=>x.source.sha256='bad']){const v=fixture();change(v);assert.throws(()=>inspectReplicadArtifact(v));}});
test('reject invalid sizes',()=>assert.throws(()=>replicadPreviewSVG(fixture(),{size:100000})));

test('reject ambiguous duplicated STEP export references',()=>{
 const v=fixture();
 v.exports.push({...v.exports[0]});
 assert.throws(()=>inspectReplicadArtifact(v),/duplicate export format/);
});
