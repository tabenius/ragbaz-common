// Read-only Replicad artifact contract. No evaluation of submitted JavaScript.
// Mesh is a derived preview; never treat it as exact B-Rep or verified STEP bytes.
const HASH=/^[a-f0-9]{64}$/;
export const REPLICAD_SCHEMA='ragbaz.replicad-artifact/1';
export function inspectReplicadArtifact(value){
 if(!value || typeof value!=='object'||Array.isArray(value)||value.schema!==REPLICAD_SCHEMA) throw Error('unsupported Replicad artifact');
 if(typeof value.name!=='string'||!value.name.trim()||value.name.length>100||/[\x00-\x1f]/.test(value.name))throw Error('invalid model name');
 if(!value.source||typeof value.source!=='object'||value.source.language!=='javascript'||!HASH.test(value.source.sha256))throw Error('invalid source reference');
 const mesh=value.preview;
 if(!mesh||mesh.format!=='triangle-mesh/1'||!Array.isArray(mesh.positions)||!Array.isArray(mesh.triangles)||mesh.positions.length>30000||mesh.positions.length%3||mesh.triangles.length>30000||mesh.triangles.length%3)throw Error('invalid preview mesh');
 if(mesh.positions.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e6))throw Error('invalid vertex');
 const n=mesh.positions.length/3;
 if(mesh.triangles.some(i=>!Number.isSafeInteger(i)||i<0||i>=n))throw Error('invalid triangle index');
 const exports=value.exports??[];
 if(!Array.isArray(exports)||exports.length>16)throw Error('invalid exports');
 const seenFormats=new Set();
 const outputs=exports.map(o=>{
  if(!o||!['step','stl'].includes(o.format)||!HASH.test(o.sha256)||typeof o.bytes!=='number'||!Number.isSafeInteger(o.bytes)||o.bytes<0||o.bytes>1e9)throw Error('invalid export');
  if(seenFormats.has(o.format)) throw Error('duplicate export format');
  seenFormats.add(o.format);
  return Object.freeze({format:o.format,sha256:o.sha256,bytes:o.bytes});
 });
 return Object.freeze({schema:REPLICAD_SCHEMA,name:value.name,source:Object.freeze({language:'javascript',sha256:value.source.sha256}),preview:Object.freeze({format:'triangle-mesh/1',positions:Object.freeze([...mesh.positions]),triangles:Object.freeze([...mesh.triangles])}),exports:Object.freeze(outputs),verification:'unverified',release_ready:false});
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function replicadPreviewSVG(input,{size=420}={}){
 const doc=inspectReplicadArtifact(input);
 if(!Number.isInteger(size)||size<128||size>1024)throw Error('invalid preview size');
 const p=doc.preview.positions,t=doc.preview.triangles;
 const xy=[];
 for(let i=0;i<p.length;i+=3)xy.push([p[i]*0.85+p[i+1]*0.30,p[i+2]*0.9-p[i+1]*0.35]);
 const xs=xy.map(v=>v[0]),ys=xy.map(v=>v[1]);
 let minx=0,maxx=1,miny=0,maxy=1;
 for(const x of xs){if(x<minx)minx=x;if(x>maxx)maxx=x;}
 for(const y of ys){if(y<miny)miny=y;if(y>maxy)maxy=y;}
 const scale=Math.min((size-40)/(maxx-minx||1),(size-40)/(maxy-miny||1));
 const project=i=>[(20+(xy[i][0]-minx)*scale).toFixed(2),(size-20-(xy[i][1]-miny)*scale).toFixed(2)].join(',');
 const edges=new Set();
 for(let i=0;i<t.length;i+=3)for(const [a,b] of [[t[i],t[i+1]],[t[i+1],t[i+2]],[t[i+2],t[i]]])edges.add(Math.min(a,b)+':'+Math.max(a,b));
 const lines=[...edges].slice(0,30000).map(s=>{const [a,b]=s.split(':').map(Number);return '<polyline points="'+project(a)+' '+project(b)+'"/>';}).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unverified Replicad mesh preview: '+esc(doc.name)+'" viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'"><g fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round">'+lines+'</g></svg>';
}

/** Independently rehash supplied source/STEP/STL bytes. Never grants signer trust or release approval. */
export async function verifyReplicadBytes(input,{source,outputs={}}={}){
 const artifact=inspectReplicadArtifact(input);
 if(typeof crypto==='undefined'||!crypto.subtle)throw Error('SHA-256 WebCrypto is required');
 const digest=async bytes=>{
  let raw;
  if(bytes instanceof Uint8Array)raw=bytes;
  else if(typeof bytes==='string')raw=new TextEncoder().encode(bytes);
  else if(bytes&&typeof bytes.arrayBuffer==='function')raw=new Uint8Array(await bytes.arrayBuffer());
  else throw Error('explicit source or export bytes required');
  if(raw.byteLength>1_000_000_000)throw Error('bytes exceed verification limit');
  return {sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(n=>n.toString(16).padStart(2,'0')).join(''),bytes:raw.byteLength};
 };
 const sourceMatch=source===undefined?null:(await digest(source)).sha256===artifact.source.sha256;
 const exports=await Promise.all(artifact.exports.map(async entry=>{
  const supplied=outputs[entry.format];
  const calculated=supplied===undefined?null:await digest(supplied);
  const match=calculated===null?null:calculated.sha256===entry.sha256 && calculated.bytes===entry.bytes;
  return {format:entry.format,digest_match:match};
 }));
 return Object.freeze({source_digest_match:sourceMatch,exports:Object.freeze(exports),authorization:'not-evaluated',signature_validity:'not-evaluated'});
}
