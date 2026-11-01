import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDocument} from '../src/content/markdoc-ragbaz.js';
import {evaluateBusinessPlan} from '../src/content/business-plan.js';
import {parseVisualization} from '../src/content/visualizations.js';
const model={schema:'ragbaz.business/1',currency:'USD',overlap_policy:'unknown',claims:[{id:'estimate',kind:'assumed',statement:'Planning assumption'}],segments:[{id:'freelance',population:200000,adoption_ppm:150000,annual_price_cents:30000,claim_ids:['estimate']}]};
test('business scenario and Markdoc native chart publish together, offline',async()=>{
 const evaluated=evaluateBusinessPlan(model);
 const chart={type:'bar',data:{labels:model.segments.map(s=>s.id),datasets:[{label:'Modeled USD millions',data:evaluated.segments.map(s=>s.annual_spend_cents/100000000)}]}};
 const spec=JSON.stringify(chart);
 assert.deepEqual(parseVisualization('chartjs',spec,{alt:'Illustrative, non-deduplicated spending scenario.'}).fallback.rows,[['freelance',9]]);
 const md='---\nschema: ragbaz.document/1\ndocument:\n  title: Business evidence\n  visualizations:\n    descriptions:\n      1: Illustrative, non-deduplicated spending scenario.\n---\n# Business evidence\n\n\`\`\`chartjs\n'+spec+'\n\`\`\`';
 const result=await renderDocument(md,{visualizations:{interactive:[]}});
 assert.equal(result.clean,true,result.diagnostics.join('; '));
 assert.match(result.html,/<svg\b/);
 assert.match(result.html,/Modeled USD millions/);
 assert.match(result.html,/<table>/);
 assert.doesNotMatch(result.html,/<script\b|<iframe\b/);
});
