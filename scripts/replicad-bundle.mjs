#!/usr/bin/env node
// Package already-computed Replicad meshes, never execute submitted model code.
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {captureReplicadShape} from '../src/content/replicad-capture.js';

const LIMITS={source:1_000_000,mesh:600_000,step:64_000_000,stl:64_000_000};
function parse(argv){
 const flags=new Map();
 for(let i=0;i<argv.length;i+=2){
  const k=argv[i],v=argv[i+1];
  if(!['--mesh','--source','--name','--step','--stl','--output'].includes(k)||!v||flags.has(k))throw Error('Usage: node scripts/replicad-bundle.mjs --name MODEL --source model.js --mesh mesh.json [--step model.step] [--stl model.stl] --output artifact.json');
  flags.set(k,v);
 }
 for(const k of ['--name','--source','--mesh','--output'])if(!flags.has(k))throw Error('Missing '+k);
 return flags;
}
async function readBounded(path,max){
 const full=resolve(path);
 const stat=await lstat(full);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw Error('Refused nonregular, linked or oversized input: '+path);
 const bytes=await readFile(full);
 if(bytes.byteLength>max)throw Error('Input exceeds limit: '+path);
 return bytes;
}
export async function bundleReplicadFiles(flags){
 const source=await readBounded(flags.get('--source'),LIMITS.source);
 const meshData=await readBounded(flags.get('--mesh'),LIMITS.mesh);
 const mesh=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(meshData));
 if(!mesh||Array.isArray(mesh)||!Array.isArray(mesh.vertices)||!Array.isArray(mesh.triangles))throw Error('Expected Replicad mesh JSON with vertices and triangles arrays');
 const step=flags.has('--step')?await readBounded(flags.get('--step'),LIMITS.step):null;
 const stl=flags.has('--stl')?await readBounded(flags.get('--stl'),LIMITS.stl):null;
 const artifact=await captureReplicadShape({
  name:flags.get('--name'),
  source,step,stl,
  shape:{mesh:()=>mesh}
 });
 const target=resolve(flags.get('--output'));
 // Exclusive creation rejects overwrites and destination symlinks.
 await writeFile(target,JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
 return artifact;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 bundleReplicadFiles(parse(process.argv.slice(2))).then(x=>console.log('Wrote '+x.schema+' (unverified; source and export digest claims are locally computed)')).catch(e=>{console.error('Replicad bundle refused:',e.message);process.exitCode=1;});
}
