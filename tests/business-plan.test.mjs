import assert from 'node:assert/strict';
import {evaluateBusinessPlan,formatUSD} from '../src/content/business-plan.js';
const input={
 schema:'ragbaz.business/1',currency:'USD',overlap_policy:'unknown',
 claims:[{id:'cohorts',kind:'assumed',statement:'Illustrative user cohorts, not independently surveyed.'}],
 segments:[
  {id:'freelance',population:200000,adoption_ppm:150000,annual_price_cents:30000,claim_ids:['cohorts']},
  {id:'smb',population:600000,adoption_ppm:200000,annual_price_cents:60000,claim_ids:['cohorts']},
  {id:'enterprise',population:600000,adoption_ppm:120000,annual_price_cents:120000,claim_ids:['cohorts']},
  {id:'hobby',population:4000000,adoption_ppm:20000,annual_price_cents:6000,claim_ids:['cohorts']}
 ]};
const out=evaluateBusinessPlan(input);
assert.equal(out.annual_spend_cents,17220000000);
assert.equal(out.total_is_additive,false);
assert.equal(out.segments[0].annual_spend_cents,900000000);
assert.equal(formatUSD(123456),'$1,234.56');
assert.throws(()=>evaluateBusinessPlan({...input,foo:1}),/unknown model property/);
assert.throws(()=>evaluateBusinessPlan({...input,claims:[{id:'bad',kind:'observed',statement:'No provenance'}]}),/requires source and as_of/);
assert.throws(()=>evaluateBusinessPlan({...input,segments:[{...input.segments[0],claim_ids:['missing']}]}),/unknown claim ref/);
assert.throws(()=>evaluateBusinessPlan({...input,segments:[input.segments[0],input.segments[0]]}),/duplicate segment/);
assert.throws(()=>evaluateBusinessPlan({...input,segments:[{...input.segments[0],population:-1}]}),/population/);
assert.throws(()=>evaluateBusinessPlan({...input,segments:[{...input.segments[0],adoption_ppm:1000001}]}),/adoption_ppm/);
console.log('business-plan model v1: tests passed');
