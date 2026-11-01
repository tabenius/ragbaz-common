// Business-plan data model v1. Independent of DOM, network, and Markdoc render state.
// Money is calculated in integer minor units; rates use integer parts per million.
export const BUSINESS_MODEL_VERSION = 'ragbaz.business/1';
const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const TYPES = new Set(['observed','assumed','derived','target','forecast']);
const MAX_ROWS = 250;
function fail(message){throw new Error('business@1: '+message);}
function validId(s){return typeof s==='string'&&ID.test(s);}
function int(x,min,max,label){if(!Number.isSafeInteger(x)||x<min||x>max)fail(label+' must be an integer in range');return x;}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function keys(obj,allowed,label){if(!plain(obj))fail(label+' must be a plain object');for(const k of Object.keys(obj))if(!allowed.includes(k))fail('unknown '+label+' property: '+k);}
function text(x,label,max=300){if(typeof x!=='string'||!x.trim()||x.length>max)fail(label+' must be nonempty text');return x;}
function rate(x,label){return int(x,0,1000000,label);}
function usd(x,label){return int(x,0,100000000000,label);}
function claim(c){
 keys(c,['id','kind','statement','source','as_of','limitations'],'claim');
 if(!validId(c.id))fail('invalid claim id');
 if(!TYPES.has(c.kind))fail('invalid claim kind');
 text(c.statement,'claim statement',1500);
 if(c.kind==='observed'&&(!c.source||!c.as_of))fail('observed claim requires source and as_of');
 if(c.source!==undefined)text(c.source,'source');
 if(c.as_of!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(c.as_of))fail('as_of must be ISO date');
 if(c.limitations!==undefined)text(c.limitations,'limitations',1500);
 return Object.freeze({...c});
}
function segment(s){
 keys(s,['id','population','adoption_ppm','annual_price_cents','claim_ids'],'segment');
 if(!validId(s.id))fail('invalid segment id');
 const population=int(s.population,0,1000000000,'population');
 const adoption_ppm=rate(s.adoption_ppm,'adoption_ppm');
 const annual_price_cents=usd(s.annual_price_cents,'annual_price_cents');
 if(!Array.isArray(s.claim_ids)||s.claim_ids.length===0||s.claim_ids.some(x=>!validId(x)))fail('segment needs claim_ids');
 const numerator=BigInt(population)*BigInt(adoption_ppm)*BigInt(annual_price_cents);
 const annual_spend_cents=(numerator+500000n)/1000000n;
 if(annual_spend_cents>BigInt(Number.MAX_SAFE_INTEGER))fail('estimated spend overflow');
 return Object.freeze({...s,claim_ids:[...s.claim_ids],annual_spend_cents:Number(annual_spend_cents)});
}
export function evaluateBusinessPlan(data){
 keys(data,['schema','currency','segments','claims','overlap_policy'],'model');
 if(data.schema!==BUSINESS_MODEL_VERSION)fail('unsupported schema');
 if(data.currency!=='USD')fail('v1 supports USD only');
 if(!['disjoint','unknown'].includes(data.overlap_policy))fail('overlap_policy required');
 if(!Array.isArray(data.segments)||data.segments.length>MAX_ROWS)fail('invalid segments');
 if(!Array.isArray(data.claims)||data.claims.length>MAX_ROWS)fail('invalid claims');
 const claims=data.claims.map(claim);
 const claimedIds=new Set();
 for(const c of claims){if(claimedIds.has(c.id))fail('duplicate claim '+c.id);claimedIds.add(c.id);}
 const segments=data.segments.map(segment);
 const segmentIds=new Set();
 for(const s of segments){
   if(segmentIds.has(s.id))fail('duplicate segment '+s.id);
   segmentIds.add(s.id);
   for(const id of s.claim_ids)if(!claimedIds.has(id))fail('unknown claim ref '+id);
 }
 const total=segments.reduce((n,s)=>n+BigInt(s.annual_spend_cents),0n);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('total overflow');
 return Object.freeze({
  schema:data.schema,currency:data.currency,overlap_policy:data.overlap_policy,
  segments:Object.freeze(segments),claims:Object.freeze(claims),
  annual_spend_cents:Number(total),
  total_is_additive:data.overlap_policy==='disjoint',
  qualification:data.overlap_policy==='unknown'?'Segment sum is non-deduplicated; not a market-size estimate.':'Illustrative modeled spend; not a market forecast.'
 });
}
export function formatUSD(cents){usd(cents,'cents');return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);}
