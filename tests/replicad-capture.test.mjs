import test from 'node:test';import assert from 'node:assert/strict';
import {captureReplicadShape} from '../src/content/replicad-capture.js';
test('capture already evaluated Replicad mesh + exact source/export byte digests',async()=>{
 const artifact=await captureReplicadShape({name:'Cube',shape:{mesh:()=>({vertices:new Float32Array([0,0,0,1,0,0,0,1,0]),triangles:new Uint32Array([0,1,2])})},source:'const main = () => 1',step:new Uint8Array([1,2,3])});
 assert.equal(artifact.preview.positions.length,9);
 assert.equal(artifact.exports[0].format,'step');
 assert.match(artifact.source.sha256,/^[a-f0-9]{64}$/);
 assert.equal(artifact.verification,'unverified');
});
test('capture refuses script execution bypass or overly large source',async()=>{
 await assert.rejects(()=>captureReplicadShape({name:'Bad',shape:{},source:'abc'}));
 await assert.rejects(()=>captureReplicadShape({name:'Huge',shape:{mesh:()=>({vertices:[],triangles:[]})},source:'x'.repeat(1_000_001)}));
});

test('reject oversized Replicad mesh before copying untrusted arrays',async()=>{
 const shape={mesh:()=>({vertices:new Float32Array(30003),triangles:new Uint32Array([0,1,2])})};
 await assert.rejects(()=>captureReplicadShape({name:'Huge',shape,source:'test'}),/exceeds bounds/);
});
