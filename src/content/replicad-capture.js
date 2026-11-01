// Trusted execution-side adapter: accepts an *already evaluated* Replicad shape.
// Does not eval source or initialize OpenCascade. Use only in a sandboxed CAD worker.
import {REPLICAD_SCHEMA, inspectReplicadArtifact} from './replicad-artifact.js';
const bytesOf=async (input,limit)=>{
 const declaredSize=typeof input==='string'?new TextEncoder().encode(input).byteLength:(input?.size??input?.byteLength);
 if(typeof declaredSize==='number' && declaredSize>limit) throw Error('input exceeds byte limit');
 if(input instanceof Uint8Array)return input;
 if(typeof input==='string')return new TextEncoder().encode(input);
 if(input && typeof input.arrayBuffer==='function')return new Uint8Array(await input.arrayBuffer());
 throw Error('source/export must be UTF-8 text or bytes');
};
const digest=async bytes=>{
 if(typeof crypto==='undefined'||!crypto.subtle)throw Error('WebCrypto SHA-256 unavailable');
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(result)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
export async function captureReplicadShape({name,shape,source,step=null,stl=null}){
 if(!shape||typeof shape.mesh!=='function')throw Error('already evaluated Replicad shape required');
 const sourceBytes=await bytesOf(source,1_000_000);
 if(sourceBytes.byteLength>1_000_000)throw Error('model source exceeds 1 MB');
 const faces=shape.mesh({tolerance:0.05,angularTolerance:30});
 if(!faces || !faces.vertices || !faces.triangles || faces.vertices.length > 30000 || faces.triangles.length > 30000) throw Error('Replicad preview mesh exceeds bounds');
 const exports=[];
 for(const [format,blob] of [['step',step],['stl',stl]]){
  if(blob===null)continue;
  const bytes=await bytesOf(blob,1_000_000_000);
  if(bytes.byteLength>1_000_000_000)throw Error('export too large');
  exports.push({format,sha256:await digest(bytes),bytes:bytes.byteLength});
 }
 return inspectReplicadArtifact({
  schema:REPLICAD_SCHEMA,name,source:{language:'javascript',sha256:await digest(sourceBytes)},
  preview:{format:'triangle-mesh/1',positions:Array.from(faces.vertices??[]),triangles:Array.from(faces.triangles??[])},
  exports
 });
}
