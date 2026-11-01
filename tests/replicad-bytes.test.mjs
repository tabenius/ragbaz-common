import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyReplicadBytes,REPLICAD_SCHEMA} from '../src/content/replicad-artifact.js';
const h=s=>createHash('sha256').update(s).digest('hex');
const make=()=>({schema:REPLICAD_SCHEMA,name:'Cube',source:{language:'javascript',sha256:h('source')},preview:{format:'triangle-mesh/1',positions:[0,0,0,1,0,0,0,1,0],triangles:[0,1,2]},exports:[{format:'step',sha256:h('STEP'),bytes:4}]});
test('verified bytes are separate from release and signer trust',async()=>{
 const r=await verifyReplicadBytes(make(),{source:'source',outputs:{step:'STEP'}});
 assert.equal(r.source_digest_match,true);assert.equal(r.exports[0].digest_match,true);assert.equal(r.authorization,'not-evaluated');assert.equal(r.signature_validity,'not-evaluated');
});
test('tampered bytes never inherit supplied digest claims',async()=>{
 const r=await verifyReplicadBytes(make(),{source:'tampered',outputs:{step:'changed'}});
 assert.equal(r.source_digest_match,false);assert.equal(r.exports[0].digest_match,false);
});
test('missing bytes remain unevaluated rather than verified',async()=>{
 const r=await verifyReplicadBytes(make());
 assert.equal(r.source_digest_match,null);assert.equal(r.exports[0].digest_match,null);
});

test('export with correct digest but false declared byte length is rejected',async()=>{
 const input=make();input.exports[0].bytes=999;
 const result=await verifyReplicadBytes(input,{source:'source',outputs:{step:'STEP'}});
 assert.equal(result.exports[0].digest_match,false);
});
