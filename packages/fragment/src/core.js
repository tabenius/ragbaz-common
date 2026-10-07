import { parseDocument, visit, stringify } from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../schema.json' with { type: 'json' };
import themes from '../themes.json' with { type: 'json' };
const ajv = new Ajv({allErrors:true,strict:false}); addFormats(ajv);
const check=ajv.compile(schema);
export { themes, schema };
export function parse(source) {
  if(new TextEncoder().encode(source).length>1_000_000) throw Error('Input exceeds 1 MB');
  // YAML core scalars are useful for unquoted human text, but JSON types remain mandatory.
  const yamlDoc=parseDocument(source,{schema:'core',uniqueKeys:true,strict:true});
  if(yamlDoc.errors.length) throw Error(yamlDoc.errors.map(x=>x.message).join('\n'));
  visit(yamlDoc,{Pair(_,p){if(typeof p.key?.value!=='string')throw Error('Mapping keys must be strings');},Alias(){throw Error('Aliases are not supported');},Node(_,n){if(n.tag||n.anchor)throw Error('Explicit YAML tags are not supported');}});
  const value=yamlDoc.toJS({maxAliasCount:0}); checkTree(value); return value;
}
function checkTree(x,depth=0){
  if(depth>64)throw Error('Maximum depth is 64');
  if(typeof x==='number'&&(!Number.isFinite(x)||(Number.isInteger(x)&&!Number.isSafeInteger(x))))throw Error('Numbers must be finite and integers JSON-safe');
  if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){
    if(['__proto__','constructor','prototype','<<'].includes(k))throw Error('Reserved key: '+k);
    checkTree(v,depth+1);
  }
}
export function validate(m){
  checkTree(m);
  const errors=[];
  if(!check(m))return check.errors.map(e=>({path:e.instancePath,code:'schema',message:e.message}));
  const push=(path,code,message)=>errors.push({path,code,message});
  try{const d=new Date(m.meta.created);const f=new Intl.DateTimeFormat('en-CA',{timeZone:m.meta.timezone,timeZoneName:'longOffset'});const zone=f.formatToParts(d).find(x=>x.type==='timeZoneName').value.replace('GMT','')||'+00:00';const offset=m.meta.created.endsWith('Z')?'+00:00':m.meta.created.slice(-6);if(zone!==offset)push('/meta/created','timezone-offset','Timestamp offset does not match timezone at this instant');}catch{push('/meta/timezone','timezone','Unknown timezone');}
  for(const target of ['screen','print']){
    const req=m.constraints.filter(c=>c.level==='require'&&(c.scope==='all'||c.scope===target)).map(c=>c.capability);
    for(const [a,b] of [['color','monochrome'],['portrait','landscape']])if(req.includes(a)&&req.includes(b))push('/constraints','conflict',`${a} and ${b} conflict for ${target}`);
  }
  const ids=new Set();for(const b of m.blocks){if(ids.has(b.id))push('/blocks','duplicate-id',b.id);ids.add(b.id);if(b.type==='quiz'&&(!b.options?.length||b.answer===undefined||b.answer>=b.options.length))push('/blocks/'+b.id,'quiz','Quiz needs options and an in-range answer');if(b.type==='figure-group'&&!b.figures?.length)push('/blocks/'+b.id,'figures','Figure group needs figures');}
  const nodes=new Set();for(const n of m.graph.nodes){if(nodes.has(n.id))push('/graph/nodes','duplicate-id',n.id);nodes.add(n.id);}for(const e of m.graph.edges)if(!nodes.has(e.source)||!nodes.has(e.target))push('/graph/edges','missing-node','Edge endpoint is missing');
  if(m.kind==='document'&&unresolved(m).length)push('/bindings','unbound','Documents must bind all placeholders');
  return errors;
}
export function assertValid(m){const errors=validate(m);if(errors.length)throw Error(errors.map(e=>`${e.path}: ${e.message}`).join('\n'));return m;}
const pattern=/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
export function bindText(text,bindings){return text.replace(pattern,(match,key)=>Object.hasOwn(bindings,key)&&bindings[key]!==null?String(bindings[key]):`⟦${key} · unbound⟧`);}
export function unresolved(m){const keys=new Set();for(const b of m.blocks){const texts=[b.title,b.text,...(b.figures||[]).flatMap(f=>[f.label,f.value,f.explanation]),...(b.options||[])];for(const text of texts)for(const match of text.matchAll(pattern))if(!Object.hasOwn(m.bindings,match[1])||m.bindings[match[1]]===null)keys.add(match[1]);}return [...keys].sort();}
export function evaluate(m,environment,target='screen'){
  const issues=m.constraints.filter(c=>c.scope==='all'||c.scope===target).filter(c=>environment[c.capability]!==true).map(c=>({...c,observed:environment[c.capability]===false?'absent':'unknown',severity:c.level==='require'?'blocked':'degraded'}));
  return {status:issues.some(i=>i.severity==='blocked')?'blocked':issues.length?'degraded':'ready',issues};
}
export function resolveTheme(slug){
  const exact=themes.find(t=>t.resolved===slug);if(exact)return structuredClone(exact);
  const terms=slug.split('-');
  const ranked=themes.map((t,index)=>({t,index,score:terms.reduce((s,k,i)=>s+(t.resolved.split('-').includes(k)?2**(-i):0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  return {...structuredClone(ranked[0].t),requested:slug,provenance:'Approximate weighted token match; registry order breaks ties. Inspect resolved slug and tokens.'};
}
export function ast(value,path=''){
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  return {path,type,...(value&&typeof value==='object'?{children:Object.entries(value).map(([k,v])=>ast(v,path+'/'+k.replaceAll('~','~0').replaceAll('/','~1')))}:{value})};
}
export function exportModel(m,format='json'){assertValid(m);return format==='yaml'?stringify(m):JSON.stringify(m,null,2)+'\n';}
