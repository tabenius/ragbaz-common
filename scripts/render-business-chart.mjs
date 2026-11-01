// Trusted publisher CLI: generate an SVG from the validated scenario fixture.
// No authored Markdoc or remote data is executed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { renderSegmentChartSVG } from '../src/content/business-chart.js';
import { evaluateBusinessPlan } from '../src/content/business-plan.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/render-business-chart.mjs MODEL.json OUTPUT.svg');
const model=JSON.parse(await readFile(resolve(input),'utf8'));
const evaluated=evaluateBusinessPlan(model);
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(resolve(output),renderSegmentChartSVG(model),'utf8');
console.log(JSON.stringify({output,annual_spend_cents:evaluated.annual_spend_cents,additive:evaluated.total_is_additive}));
