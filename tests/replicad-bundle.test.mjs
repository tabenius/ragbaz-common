import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {bundleReplicadFiles} from '../scripts/replicad-bundle.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'replicad-bundle-'));
 try{
  const source=join(dir,'source.js'),mesh=join(dir,'mesh.json'),step=join(dir,'shape.step'),out=join(dir,'result.json');
  const original='const main = () => makeBaseBox(10,20,30);\n';
  const bytes=Buffer.from('ISO-10303-21;\nEND-ISO-10303-21;\n');
  await writeFile(source,original);await writeFile(step,bytes);
  await writeFile(mesh,JSON.stringify({vertices:[0,0,0,10,0,0,0,20,0],triangles:[0,1,2]}));
  const flags=new Map([['--name','Sample box'],['--source',source],['--mesh',mesh],['--step',step],['--output',out]]);
  await fn({source,mesh,step,out,flags,original,bytes,dir});
 }finally{await rm(dir,{recursive:true,force:true})}
}
test('bundle hashes exact source and STEP bytes, and remains unverified',async()=>fixture(async ({flags,out,original,bytes})=>{
 const result=await bundleReplicadFiles(flags);
 const stored=JSON.parse(await readFile(out,'utf8'));
 assert.equal(stored.schema,'ragbaz.replicad-artifact/1');
 assert.equal(stored.source.sha256,sha(original));
 assert.equal(stored.exports[0].sha256,sha(bytes));
 assert.equal(stored.exports[0].bytes,bytes.length);
 assert.equal(stored.verification,'unverified');
 assert.equal(stored.release_ready,false);
 await assert.rejects(()=>bundleReplicadFiles(flags),/EEXIST/);
}));
test('refuse source symlink before reading',async()=>fixture(async ({flags,source,dir})=>{
 const link=join(dir,'alias.js');await symlink(source,link);
 flags.set('--source',link);
 await assert.rejects(()=>bundleReplicadFiles(flags),/linked/);
}));
test('reject unbounded or invalid geometry',async()=>fixture(async ({flags,mesh})=>{
 await writeFile(mesh,JSON.stringify({vertices:[0,0,0],triangles:[0,1,8]}));
 await assert.rejects(()=>bundleReplicadFiles(flags),/triangle index/);
}));
